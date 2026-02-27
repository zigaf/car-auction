import { IsString, MaxLength } from 'class-validator';

export class SendEmailDto {
  @IsString()
  @MaxLength(255)
  subject: string;

  @IsString()
  message: string;
}
