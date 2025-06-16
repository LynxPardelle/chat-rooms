import { Injectable } from '@nestjs/common';
import { MessageRepository } from '../../infrastructure/database/repositories/message.repository';
import { Message } from '../../domain/entities';
import { 
  AdvancedSearchMessagesDto, 
  DetailedMessageSearchResultDto, 
  PaginatedSearchResultDto 
} from '../dtos';

@Injectable()
export class MessageSearchService {
  private searchCache = new Map<string, { results: DetailedMessageSearchResultDto[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(private readonly messageRepository: MessageRepository) {}

  /**
   * Advanced search for messages with scoring and filtering
   */  async searchMessages(searchDto: AdvancedSearchMessagesDto): Promise<PaginatedSearchResultDto> {
    // Set defaults for optional fields
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const searchDtoWithDefaults = { ...searchDto, page, limit };
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(searchDtoWithDefaults);
      // Check cache first
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return this.paginateCachedResults(cached, page, limit);
    }    // Build MongoDB aggregation pipeline
    const pipeline = this.buildSearchPipeline(searchDtoWithDefaults);

    // Track execution time
    const startTime = Date.now();

    // Execute search
    const [results, total] = await Promise.all([
      this.messageRepository.aggregate(pipeline),
      this.messageRepository.aggregate([
        ...pipeline.slice(0, -2), // Remove skip and limit for count
        { $count: "total" }
      ])
    ]);    // Transform results with highlighting
    const transformedResults = await this.transformSearchResults(results, searchDtoWithDefaults.query);

    // Cache results
    this.setCachedResult(cacheKey, transformedResults);

    const totalCount = total[0]?.total || 0;

    return {
      results: transformedResults,
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page * limit < totalCount,
      hasPrevious: page > 1,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(partialQuery: string, roomId?: string): Promise<string[]> {
    if (partialQuery.length < 2) return [];

    const pipeline = [
      {
        $match: {
          ...(roomId && { roomId }),
          deletedAt: { $exists: false },
          $text: { $search: `"${partialQuery}"` }
        }
      },
      {
        $project: {
          content: 1,
          score: { $meta: "textScore" }
        }
      },
      { $sort: { score: { $meta: "textScore" } } },
      { $limit: 10 }
    ];

    const results = await this.messageRepository.aggregate(pipeline);
    
    // Extract unique words that start with the partial query
    const suggestions = new Set<string>();
    results.forEach((result: any) => {
      const words = result.content.toLowerCase().split(/\s+/);
      words.forEach((word: string) => {
        if (word.startsWith(partialQuery.toLowerCase()) && word.length > partialQuery.length) {
          suggestions.add(word);
        }
      });
    });

    return Array.from(suggestions).slice(0, 5);
  }

  /**
   * Search for hashtags and mentions
   */
  async searchHashtagsAndMentions(query: string, type: 'hashtag' | 'mention'): Promise<string[]> {
    const regex = type === 'hashtag' ? /#(\w+)/g : /@(\w+)/g;
    const pattern = type === 'hashtag' ? `#${query}` : `@${query}`;

    const pipeline = [
      {
        $match: {
          content: { $regex: new RegExp(pattern, 'i') },
          deletedAt: { $exists: false }
        }
      },
      {
        $project: {
          content: 1,
          matches: {
            $regexFindAll: {
              input: "$content",
              regex: regex.source,
              options: "i"
            }
          }
        }
      },
      { $unwind: "$matches" },
      {
        $group: {
          _id: "$matches.captures.0",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ];

    const results = await this.messageRepository.aggregate(pipeline);
    return results.map((result: any) => `${type === 'hashtag' ? '#' : '@'}${result._id}`);
  }

  /**
   * Build MongoDB aggregation pipeline for search
   */
  private buildSearchPipeline(searchDto: AdvancedSearchMessagesDto): any[] {
    const pipeline: any[] = [];

    // Match stage
    const matchStage: any = {
      deletedAt: { $exists: false }
    };

    // Text search
    if (searchDto.query) {
      matchStage.$text = { $search: searchDto.query };
    }

    // Room filter
    if (searchDto.roomId) {
      matchStage.roomId = searchDto.roomId;
    }

    // User filter
    if (searchDto.userId) {
      matchStage.userId = searchDto.userId;
    }

    // Date range filter
    if (searchDto.startDate || searchDto.endDate) {
      matchStage.createdAt = {};
      if (searchDto.startDate) {
        matchStage.createdAt.$gte = new Date(searchDto.startDate);
      }
      if (searchDto.endDate) {
        matchStage.createdAt.$lte = new Date(searchDto.endDate);
      }
    }

    pipeline.push({ $match: matchStage });

    // Add score for text search
    if (searchDto.query) {
      pipeline.push({
        $addFields: {
          score: { $meta: "textScore" }
        }
      });
    }

    // Lookup user data
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'author',
        pipeline: [
          {
            $project: {
              username: 1,
              textColor: 1,
              backgroundColor: 1,
              avatarUrl: 1
            }
          }
        ]
      }
    });

    // Lookup room data
    pipeline.push({
      $lookup: {
        from: 'rooms',
        localField: 'roomId',
        foreignField: '_id',
        as: 'room',
        pipeline: [
          {
            $project: {
              name: 1
            }
          }
        ]
      }
    });

    // Sort stage
    const sortStage: any = {};
    if (searchDto.query) {
      sortStage.score = { $meta: "textScore" };
    }
    
    switch (searchDto.sort) {
      case 'newest':
        sortStage.createdAt = -1;
        break;
      case 'oldest':
        sortStage.createdAt = 1;
        break;
      case 'relevance':
      default:
        if (!searchDto.query) {
          sortStage.createdAt = -1;
        }
        break;
    }

    pipeline.push({ $sort: sortStage });    // Pagination
    pipeline.push({ $skip: (searchDto.page! - 1) * searchDto.limit! });
    pipeline.push({ $limit: searchDto.limit! });

    return pipeline;
  }

  /**
   * Transform search results with highlighting
   */  private async transformSearchResults(
    results: any[], 
    query?: string
  ): Promise<DetailedMessageSearchResultDto[]> {
    return results.map(result => {
      const highlightedContent = query ? this.highlightText(result.content, query) : result.content;
      const highlightedTerms = query ? this.extractHighlightedTerms(result.content, query) : [];
      
      return {
        id: result._id.toString(),
        content: highlightedContent,
        originalContent: result.content,
        author: {
          id: result.author[0]?._id?.toString() || '',
          username: result.author[0]?.username || 'Unknown',
          avatar: result.author[0]?.avatarUrl
        },
        room: {
          id: result.room[0]?._id?.toString() || '',
          name: result.room[0]?.name || 'Unknown',
          type: result.room[0]?.type
        },
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        score: result.score || 0,
        context: this.extractContext(result.content, query),
        highlightedTerms,
        attachments: result.attachments || [],
        reactions: result.reactions || {},
        thread: result.thread ? {
          id: result.thread.id,
          replyCount: result.thread.replyCount || 0
        } : undefined,
        isEdited: result.isEdited || false,
        isDeleted: result.deletedAt ? true : false
      };
    });
  }

  /**
   * Highlight search terms in text
   */
  private highlightText(text: string, query: string): string {
    if (!query) return text;

    const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    let highlightedText = text;

    words.forEach(word => {
      const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });

    return highlightedText;
  }

  /**
   * Extract highlighted terms from content
   */
  private extractHighlightedTerms(content: string, query: string): string[] {
    if (!query) return [];
    
    const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const highlightedTerms: string[] = [];
    
    for (const term of terms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        highlightedTerms.push(...matches.map(match => match.toLowerCase()));
      }
    }
    
    return [...new Set(highlightedTerms)]; // Remove duplicates
  }
  /**
   * Extract context around search terms
   */
  private extractContext(text: string, query?: string, contextLength: number = 50): string[] {
    if (!query || text.length <= contextLength * 2) return [text];

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const contexts: string[] = [];
    
    // Find all occurrences of the query terms
    const terms = query.split(/\s+/).filter(term => term.length > 0);
    
    for (const term of terms) {
      const index = lowerText.indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - contextLength);
        const end = Math.min(text.length, index + term.length + contextLength);

        let context = text.substring(start, end);
        
        if (start > 0) context = '...' + context;
        if (end < text.length) context = context + '...';
        
        contexts.push(context);
      }
    }

    return contexts.length > 0 ? contexts : [text.substring(0, contextLength * 2)];
  }

  /**
   * Generate cache key for search parameters
   */
  private generateCacheKey(searchDto: AdvancedSearchMessagesDto): string {
    return JSON.stringify({
      query: searchDto.query,
      roomId: searchDto.roomId,
      userId: searchDto.userId,
      startDate: searchDto.startDate,
      endDate: searchDto.endDate,
      sort: searchDto.sort
    });
  }

  /**
   * Get cached search result
   */
  private getCachedResult(cacheKey: string): DetailedMessageSearchResultDto[] | null {
    const cached = this.searchCache.get(cacheKey);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    return cached.results;
  }

  /**
   * Set cached search result
   */
  private setCachedResult(cacheKey: string, results: DetailedMessageSearchResultDto[]): void {
    // Clean expired cache entries
    this.cleanExpiredCache();

    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.searchCache.delete(key);
      }
    }
  }
  /**
   * Paginate cached results
   */
  private paginateCachedResults(
    results: DetailedMessageSearchResultDto[], 
    page: number, 
    limit: number
  ): PaginatedSearchResultDto {
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedResults = results.slice(start, end);

    return {
      results: paginatedResults,
      page,
      limit,
      total: results.length,
      totalPages: Math.ceil(results.length / limit),
      hasNext: end < results.length,
      hasPrevious: page > 1,      executionTime: 0 // Cached results have no execution time
    };
  }

  /**
   * Escape special regex characters
   */  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
