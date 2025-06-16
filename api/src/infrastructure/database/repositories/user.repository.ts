import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUserRepository, PaginationOptions, PaginatedResult } from '../../../domain/interfaces';
import { User, EntityId } from '../../../domain/entities';
import { User as UserSchema, UserDocument } from '../models/user.schema';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(UserSchema.name) private userModel: Model<UserDocument>,
  ) {}

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user = new this.userModel(userData);
    const savedUser = await user.save();
    return this.mapToEntity(savedUser);
  }

  async findById(id: EntityId): Promise<User | null> {
    const user = await this.userModel.findById(id).exec();
    return user ? this.mapToEntity(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userModel.findOne({ email, deletedAt: null }).exec();
    return user ? this.mapToEntity(user) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.userModel.findOne({ username, deletedAt: null }).exec();
    return user ? this.mapToEntity(user) : null;
  }

  async update(id: EntityId, userData: Partial<User>): Promise<User | null> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { ...userData, updatedAt: new Date() }, { new: true })
      .exec();
    return user ? this.mapToEntity(user) : null;
  }

  async delete(id: EntityId): Promise<boolean> {
    const result = await this.userModel
      .findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
      .exec();
    return !!result;
  }
  async findMany(options: Partial<PaginationOptions> = {}): Promise<PaginatedResult<User>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel
        .find({ deletedAt: null })
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments({ deletedAt: null }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map(user => this.mapToEntity(user)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
  async findOnlineUsers(roomId?: EntityId): Promise<User[]> {
    const filter: any = { 
      isOnline: true, 
      deletedAt: null 
    };
    
    // Note: Room filtering would be implemented when Room entity is fully developed
    // For now, we ignore roomId as we're implementing a single-room chat
    
    const users = await this.userModel
      .find(filter)
      .exec();
    
    return users.map(user => this.mapToEntity(user));
  }

  async updateLastSeen(id: EntityId): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { 
        lastSeen: new Date(),
        updatedAt: new Date() 
      })
      .exec();
  }
  async setOnlineStatus(id: EntityId, isOnline: boolean): Promise<void> {
    const updateData: any = { 
      isOnline, 
      updatedAt: new Date() 
    };
    
    if (!isOnline) {
      updateData.lastSeen = new Date();
    }

    await this.userModel
      .findByIdAndUpdate(id, updateData)
      .exec();
  }

  async updateStatus(
    id: EntityId,
    status: User['status'],
    isOnline: boolean,
  ): Promise<boolean> {
    const result = await this.userModel
      .findByIdAndUpdate(id, { 
        status, 
        isOnline, 
        updatedAt: new Date(),
        ...(isOnline ? {} : { lastSeen: new Date() })
      })
      .exec();
    
    return !!result;
  }
  private mapToEntity(userDoc: UserDocument): User {
    return {
      id: (userDoc._id as any).toString(),
      username: userDoc.username,
      email: userDoc.email,
      password: userDoc.password,
      avatar: userDoc.avatar,
      avatarUrl: userDoc.avatarUrl,
      textColor: userDoc.textColor as `#${string}`,
      backgroundColor: userDoc.backgroundColor as `#${string}`,
      isOnline: userDoc.isOnline,      lastSeen: userDoc.lastSeen,
      status: userDoc.status,
      metadata: userDoc.metadata,
      isAdmin: userDoc.isAdmin || false,
      role: userDoc.role || 'user',
      createdAt: (userDoc as any).createdAt || new Date(),
      updatedAt: (userDoc as any).updatedAt || new Date(),
      deletedAt: userDoc.deletedAt,
    };
  }
}
