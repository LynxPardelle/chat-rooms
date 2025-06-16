import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class WsJwtGuard extends AuthGuard('ws-jwt') {
  getRequest(context: ExecutionContext) {
    // For WebSocket connections, we need to extract the client
    return context.switchToWs().getClient().handshake;
  }
}
