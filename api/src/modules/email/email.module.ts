import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSettings } from '../../db/entities/email-settings.entity';
import { EmailTemplate } from '../../db/entities/email-template.entity';
import { User } from '../../db/entities/user.entity';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailController } from './email.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailSettings, EmailTemplate, User])],
  providers: [EmailService, EmailTemplateService],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule {}
