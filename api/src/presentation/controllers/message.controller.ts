import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '../../infrastructure/security';
import { ParseObjectIdPipe } from '../../infrastructure/pipes/parse-objectid.pipe';
import { UserWithoutPassword } from '../../domain/entities';
import { MessageService, MessageSearchService } from '../../application/services';
import {
  CreateMessageDto,
  UpdateMessageDto,
  MessageSearchDto,
  PaginationDto,
  MessageResponseDto,
  PaginatedMessagesDto,
} from '../../application/dtos/message.dto';
import {
  AdvancedSearchMessagesDto,
  DetailedMessageSearchResultDto,
  PaginatedSearchResultDto,
} from '../../application/dtos/search.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly messageSearchService: MessageSearchService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMessage(
    @Body() createMessageDto: CreateMessageDto,
    @CurrentUser() user: UserWithoutPassword,
  ): Promise<MessageResponseDto> {
    return this.messageService.createMessage(createMessageDto, user);
  }

  @Get()
  async getMessages(
    @Query() pagination: PaginationDto,
    @Query() searchDto?: MessageSearchDto,
  ): Promise<PaginatedMessagesDto> {
    return this.messageService.getMessages(pagination, searchDto);
  }

  @Get('recent')
  async getRecentMessages(
    @Query('roomId') roomId?: string,
    @Query('limit') limit: number = 50,
  ): Promise<MessageResponseDto[]> {
    return this.messageService.getRecentMessages(roomId, limit);
  }
  @Get('search')
  async searchMessages(
    @Query() searchDto: MessageSearchDto,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedMessagesDto> {
    return this.messageService.searchMessages(searchDto, pagination);
  }

  @Get('search/suggestions')
  async getSearchSuggestions(
    @Query('query') query: string,
    @CurrentUser() user: UserWithoutPassword,
    @Query('roomId') roomId?: string,
  ): Promise<string[]> {
    return this.messageSearchService.getSearchSuggestions(query, roomId);
  }

  @Get(':id')
  async getMessageById(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<MessageResponseDto> {
    return this.messageService.getMessageById(id);
  }
  @Put(':id')
  async updateMessage(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @CurrentUser() user: UserWithoutPassword,
  ): Promise<MessageResponseDto> {
    return this.messageService.updateMessage(id, updateMessageDto, user);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: UserWithoutPassword,
  ): Promise<{ message: string }> {
    return this.messageService.deleteMessage(id, user);
  }

  @Post('search/advanced')
  @HttpCode(HttpStatus.OK)
  async advancedSearchMessages(    @Body() searchDto: AdvancedSearchMessagesDto,
    @CurrentUser() user: UserWithoutPassword,
  ): Promise<PaginatedSearchResultDto> {
    return this.messageSearchService.searchMessages(searchDto);
  }
}
