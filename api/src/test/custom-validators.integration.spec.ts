import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { IsRoomNameConstraint } from '../infrastructure/pipes/custom-validators/is-room-name.validator';
import { IsHexColorConstraint } from '../infrastructure/pipes/custom-validators/is-hex-color.validator';
import { validate } from 'class-validator';
import { IsRoomName, IsHexColor } from '../infrastructure/pipes/custom-validators';

class TestDto {
  @IsRoomName({
    allowSpaces: true,
    allowSpecialChars: true,
    forbidReservedWords: true
  })
  roomName: string;

  @IsHexColor({
    allowShorthand: true,
    allowNamedColors: true
  })
  color: string;
}

describe('Custom Validators Integration Test', () => {
  let validationPipe: ValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IsRoomNameConstraint, IsHexColorConstraint],
    }).compile();

    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  describe('IsRoomName Validator', () => {
    it('should accept valid room names', async () => {
      const dto = new TestDto();
      dto.roomName = 'general-chat';
      dto.color = '#FF0000';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject inappropriate room names', async () => {
      const dto = new TestDto();
      dto.roomName = 'admin-secret';
      dto.color = '#FF0000';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('roomName');
    });

    it('should reject room names that are too long', async () => {
      const dto = new TestDto();
      dto.roomName = 'a'.repeat(51); // Exceeds 50 character limit
      dto.color = '#FF0000';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('roomName');
    });
  });

  describe('IsHexColor Validator', () => {    it('should accept valid hex colors', async () => {
      const validColors = ['#FF0000', '#00FF00', '#0000FF', '#123456', '#ABC'];
      
      for (const color of validColors) {
        const dto = new TestDto();
        dto.roomName = 'developers-chat';
        dto.color = color;

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should accept valid CSS named colors', async () => {
      const validColors = ['red', 'blue', 'green', 'black', 'white'];
      
      for (const color of validColors) {
        const dto = new TestDto();
        dto.roomName = 'developers-chat';
        dto.color = color;

        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should reject invalid color formats', async () => {
      const invalidColors = ['not-a-color', '#GGG', 'rgb(255,0,0)', '123456'];
      
      for (const color of invalidColors) {
        const dto = new TestDto();
        dto.roomName = 'developers-chat';
        dto.color = color;

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('color');
      }
    });
  });

  describe('Combined Validation', () => {
    it('should validate multiple fields correctly', async () => {
      const dto = new TestDto();
      dto.roomName = 'valid-room-name';
      dto.color = '#FF5733';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should report errors for all invalid fields', async () => {
      const dto = new TestDto();
      dto.roomName = 'admin-secret'; // Invalid room name
      dto.color = 'not-a-color'; // Invalid color

      const errors = await validate(dto);
      expect(errors.length).toBe(2);
      
      const propertyNames = errors.map(error => error.property);
      expect(propertyNames).toContain('roomName');
      expect(propertyNames).toContain('color');
    });
  });
});
