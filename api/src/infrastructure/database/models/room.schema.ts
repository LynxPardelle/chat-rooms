import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({
  timestamps: true, // Automatically add createdAt and updatedAt fields
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v; // Remove version key
      return ret;
    },
  },
})
export class Room {
  @Prop({ required: true, index: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ default: 100, min: 2, max: 1000 })
  maxUsers: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: MongooseSchema.Types.ObjectId;

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'User' }])
  activeUsers: MongooseSchema.Types.ObjectId[];

  @Prop()
  deletedAt?: Date;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Add indexes for better performance
RoomSchema.index({ name: 1 });
RoomSchema.index({ isPrivate: 1 });
RoomSchema.index({ createdBy: 1 });
RoomSchema.index({ deletedAt: 1 });
