import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { MessageType } from '../../../domain/entities';

export type MessageDocument = Message & Document;

// Reaction subdocument
@Schema({ _id: false })
export class Reaction {
  @Prop({ required: true })
  emoji: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;
}

// Message metadata subdocument
@Schema({ _id: false })
export class MessageMetadata {
  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop([
    {
      content: String,
      editedAt: { type: Date, default: Date.now },
    },
  ])
  editHistory?: Array<{
    content: string;
    editedAt: Date;
  }>;
}

@Schema({
  timestamps: true, // Automatically add createdAt and updatedAt fields
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v; // Remove version key
      return ret;
    },
  },
})
export class Message {
  @Prop({ required: true })
  content: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true,
  })
  roomId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.TEXT,
  })
  messageType: MessageType;

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'Attachment' }])
  attachments: MongooseSchema.Types.ObjectId[];

  @Prop({ type: MessageMetadata, default: () => ({}) })
  metadata: MessageMetadata;

  @Prop([{ type: Reaction }])
  reactions: Reaction[];

  @Prop({ default: false })
  isEdited: boolean;

  @Prop()
  editedAt?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message' })
  replyToId?: MongooseSchema.Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Add text index for search functionality
MessageSchema.index({ content: 'text' });

// Add compound indexes for better performance
MessageSchema.index({ roomId: 1, createdAt: -1 });
MessageSchema.index({ userId: 1, createdAt: -1 });
MessageSchema.index({ messageType: 1 });
MessageSchema.index({ deletedAt: 1 });
