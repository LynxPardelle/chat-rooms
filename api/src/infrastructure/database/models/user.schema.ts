import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserStatus } from '../../../domain/entities';

export type UserDocument = User & Document;

// User metadata subdocument
@Schema({ _id: false })
export class UserMetadata {
  @Prop()
  lastLoginIp?: string;

  @Prop()
  lastUserAgent?: string;

  @Prop({ default: 0 })
  loginCount: number;
}

@Schema({
  timestamps: true, // Automatically add createdAt and updatedAt fields
  toJSON: {
    transform: (doc, ret) => {
      delete ret.password; // Remove password from JSON response
      delete ret.__v; // Remove version key
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  avatar?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: '#000000', match: /^#[0-9A-Fa-f]{6}$/ })
  textColor: string;

  @Prop({ default: '#ffffff', match: /^#[0-9A-Fa-f]{6}$/ })
  backgroundColor: string;

  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.OFFLINE,
  })
  status: UserStatus;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({ default: Date.now })
  lastSeen: Date;

  @Prop({ type: UserMetadata, default: () => ({}) })
  metadata: UserMetadata;

  @Prop()
  deletedAt?: Date;
  
  @Prop({ default: false })
  isAdmin: boolean;
  
  @Prop({ default: 'user' })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes for better performance (unique indexes replace the automatic ones from @Prop decorators)
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ isOnline: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ deletedAt: 1 });
