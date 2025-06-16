import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserWithoutPassword } from '../../../domain/entities';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserWithoutPassword => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
