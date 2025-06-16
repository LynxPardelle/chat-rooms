import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  ValidationPipe,
  UsePipes
} from '@nestjs/common';
import { JwtAuthGuard } from '../../infrastructure/security';
import { CurrentUser, Public } from '../../infrastructure/security';
import { UserWithoutPassword } from '../../domain/entities';
import { AuthService } from '../../application/services';
import { 
  LoginDto, 
  RegisterDto, 
  RefreshTokenDto, 
  TokenResponseDto,
  SimpleTestDto 
} from '../../application/dtos';

@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<TokenResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string }> {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: UserWithoutPassword): Promise<UserWithoutPassword> {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: UserWithoutPassword): Promise<{ message: string }> {
    return this.authService.logout(user.id);
  }

  @Public()
  @Get('test')
  getTest(): { message: string; timestamp: string } {
    return {
      message: 'Auth controller is working',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post('test-register')
  @HttpCode(HttpStatus.CREATED)
  async testRegister(@Body() testDto: SimpleTestDto): Promise<TokenResponseDto> {
    // Simple test without full validation - create a basic register DTO
    const registerDto: RegisterDto = {
      username: testDto.username,
      email: testDto.email,
      password: 'testpassword',
    };

    return this.authService.register(registerDto);
  }

  @Public()
  @Get('test-token')
  async testToken(): Promise<TokenResponseDto> {
    // Create a test user directly using the auth service
    const registerDto: RegisterDto = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'testpassword',
    };

    return this.authService.register(registerDto);
  }
}
