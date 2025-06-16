import { IsOptional, IsString, IsNumber, IsDateString, IsArray, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdvancedSearchMessagesDto {
  @ApiProperty({ 
    description: 'Search query text',
    example: 'hello world'
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({ 
    description: 'Page number for pagination',
    example: 1,
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Number of results per page',
    example: 20,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
  @ApiPropertyOptional({ 
    description: 'Sort order for results',
    example: 'relevance',
    enum: ['relevance', 'newest', 'oldest']
  })
  @IsOptional()
  @IsString()
  sort?: 'relevance' | 'newest' | 'oldest' = 'relevance';

  @ApiPropertyOptional({ 
    description: 'Filter by specific user ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  userId?: string;
  @ApiPropertyOptional({ 
    description: 'Filter by channel ID',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ 
    description: 'Search messages after this date',
    example: '2023-01-01T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ 
    description: 'Search messages before this date',
    example: '2023-12-31T23:59:59.999Z'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ 
    description: 'Include messages with attachments only',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasAttachments?: boolean;

  @ApiPropertyOptional({ 
    description: 'Search for specific hashtags',
    example: ['#javascript', '#nodejs']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional({ 
    description: 'Search for specific mentions',
    example: ['@john', '@jane']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @ApiPropertyOptional({ 
    description: 'Include edited messages in search',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeEdited?: boolean = true;

  @ApiPropertyOptional({ 
    description: 'Include deleted messages in search (admin only)',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean = false;
}

export class DetailedMessageSearchResultDto {
  @ApiProperty({ 
    description: 'Message ID',
    example: '507f1f77bcf86cd799439011'
  })
  id: string;

  @ApiProperty({ 
    description: 'Message content with highlighted search terms',
    example: 'Hello <mark>world</mark>, this is a test message'
  })
  content: string;

  @ApiProperty({ 
    description: 'Original message content without highlighting',
    example: 'Hello world, this is a test message'
  })
  originalContent: string;

  @ApiProperty({ 
    description: 'Message author information',
    example: {
      id: '507f1f77bcf86cd799439013',
      username: 'john_doe',
      avatar: 'https://example.com/avatar.jpg'
    }
  })
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  @ApiProperty({ 
    description: 'Channel information',
    example: {
      id: '507f1f77bcf86cd799439012',
      name: 'general',
      type: 'public'
    }
  })
  room: {
    id: string;
    name: string;
    type?: string;
  };

  @ApiProperty({ 
    description: 'Message creation timestamp',
    example: '2023-06-15T10:30:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({ 
    description: 'Message last edit timestamp',
    example: '2023-06-15T10:35:00.000Z'
  })
  updatedAt?: Date;

  @ApiProperty({ 
    description: 'Search relevance score',
    example: 0.85
  })
  score: number;

  @ApiProperty({ 
    description: 'Context snippets around search terms',
    example: ['...previous context...', '...next context...']
  })
  context: string[];

  @ApiProperty({ 
    description: 'Highlighted search terms found in the message',
    example: ['world', 'test']
  })
  highlightedTerms: string[];

  @ApiProperty({ 
    description: 'Message attachments if any',
    example: [{
      id: '507f1f77bcf86cd799439014',
      filename: 'document.pdf',
      url: 'https://example.com/files/document.pdf',
      type: 'application/pdf'
    }]
  })
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    type: string;
  }>;

  @ApiProperty({ 
    description: 'Message reactions count',
    example: { '👍': 5, '❤️': 2 }
  })
  reactions?: Record<string, number>;

  @ApiProperty({ 
    description: 'Thread information if message is part of a thread',
    example: {
      id: '507f1f77bcf86cd799439015',
      replyCount: 3
    }
  })
  thread?: {
    id: string;
    replyCount: number;
  };

  @ApiProperty({ 
    description: 'Whether the message has been edited',
    example: false
  })
  isEdited: boolean;

  @ApiProperty({ 
    description: 'Whether the message has been deleted (visible to admins)',
    example: false
  })
  isDeleted: boolean;
}

export class PaginatedSearchResultDto {
  @ApiProperty({ 
    description: 'Array of search results',
    type: [DetailedMessageSearchResultDto]
  })
  results: DetailedMessageSearchResultDto[];

  @ApiProperty({ 
    description: 'Current page number',
    example: 1
  })
  page: number;

  @ApiProperty({ 
    description: 'Number of results per page',
    example: 20
  })
  limit: number;

  @ApiProperty({ 
    description: 'Total number of matching messages',
    example: 156
  })
  total: number;

  @ApiProperty({ 
    description: 'Total number of pages',
    example: 8
  })
  totalPages: number;

  @ApiProperty({ 
    description: 'Whether there are more results available',
    example: true
  })
  hasNext: boolean;

  @ApiProperty({ 
    description: 'Whether there are previous results available',
    example: false
  })
  hasPrevious: boolean;

  @ApiProperty({ 
    description: 'Search execution time in milliseconds',
    example: 127
  })
  executionTime: number;

  @ApiProperty({ 
    description: 'Search suggestions for improved results',
    example: ['hello', 'world', 'test message']
  })
  suggestions?: string[];

  @ApiProperty({ 
    description: 'Faceted search results for filters',
    example: {
      channels: [
        { id: '507f1f77bcf86cd799439012', name: 'general', count: 45 },
        { id: '507f1f77bcf86cd799439016', name: 'random', count: 23 }
      ],
      authors: [
        { id: '507f1f77bcf86cd799439013', username: 'john_doe', count: 12 },
        { id: '507f1f77bcf86cd799439017', username: 'jane_smith', count: 8 }
      ],
      dateRanges: [
        { range: 'today', count: 15 },
        { range: 'this_week', count: 67 },
        { range: 'this_month', count: 156 }
      ]
    }
  })
  facets?: {
    channels?: Array<{ id: string; name: string; count: number }>;
    authors?: Array<{ id: string; username: string; count: number }>;
    dateRanges?: Array<{ range: string; count: number }>;
  };
}

export class SearchSuggestionsDto {
  @ApiProperty({ 
    description: 'Search query for suggestions',
    example: 'hel'
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({ 
    description: 'Maximum number of suggestions',
    example: 10,
    minimum: 1,
    maximum: 20
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}

export class SearchSuggestionResultDto {
  @ApiProperty({ 
    description: 'Suggested search term',
    example: 'hello'
  })
  suggestion: string;

  @ApiProperty({ 
    description: 'Type of suggestion',
    example: 'content',
    enum: ['content', 'hashtag', 'mention', 'channel']
  })
  type: 'content' | 'hashtag' | 'mention' | 'channel';

  @ApiProperty({ 
    description: 'Number of matching messages',
    example: 25
  })
  count: number;

  @ApiProperty({ 
    description: 'Suggestion score/relevance',
    example: 0.92
  })
  score: number;
}
