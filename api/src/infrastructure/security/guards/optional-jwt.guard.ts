import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  // Override handleRequest to allow requests without tokens
  handleRequest(err: any, user: any) {
    // If there's an error or no user, just return null instead of throwing
    if (err || !user) {
      return null;
    }
    return user;
  }

  // Always return true to allow the request to proceed
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
