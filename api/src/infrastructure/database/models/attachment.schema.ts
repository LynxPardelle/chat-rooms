import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AttachmentDocument = Attachment & Document;

@Schema({
  timestamps: true, // Automatically add createdAt and updatedAt fields
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v; // Remove version key
      return ret;
    },
  },
})
export class Attachment {
  @Prop({ required: true, index: true })
  filename: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true, min: 0 })
  size: number;

  @Prop({ required: true })
  url: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  uploadedBy: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message' })
  messageId?: MongooseSchema.Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

// Add indexes for better performance
AttachmentSchema.index({ filename: 1 });
AttachmentSchema.index({ uploadedBy: 1 });
AttachmentSchema.index({ messageId: 1 });
AttachmentSchema.index({ mimeType: 1 });
AttachmentSchema.index({ createdAt: -1 });
AttachmentSchema.index({ deletedAt: 1 });
