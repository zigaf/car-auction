import {
  Controller,
  Get,
  Patch,
  Put,
  Delete,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { EmailTemplateService } from './email-template.service';
import { EmailService } from './email.service';
import { UpsertTemplateDto } from './dto/upsert-template.dto';
import { ToggleSettingDto } from './dto/toggle-setting.dto';
import { EmailEventType } from '../../common/enums/email-event-type.enum';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BROKER)
export class EmailController {
  constructor(
    private readonly templateService: EmailTemplateService,
    private readonly emailService: EmailService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.templateService.getAllSettings();
  }

  @Patch('settings/:eventType')
  @HttpCode(HttpStatus.OK)
  toggleSetting(
    @Param('eventType') eventType: EmailEventType,
    @Body() dto: ToggleSettingDto,
  ) {
    return this.templateService.toggleSetting(eventType, dto.isEnabled);
  }

  @Get('templates/:eventType')
  getTemplates(@Param('eventType') eventType: EmailEventType) {
    return this.templateService.getTemplatesForEvent(eventType);
  }

  @Get('templates/:eventType/:language')
  getTemplate(
    @Param('eventType') eventType: EmailEventType,
    @Param('language') language: string,
  ) {
    return this.templateService.getTemplate(eventType, language);
  }

  @Put('templates/:eventType/:language')
  upsertTemplate(
    @Param('eventType') eventType: EmailEventType,
    @Param('language') language: string,
    @Body() dto: UpsertTemplateDto,
  ) {
    return this.templateService.upsertTemplate(eventType, language, dto);
  }

  @Delete('templates/:eventType/:language')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTemplate(
    @Param('eventType') eventType: EmailEventType,
    @Param('language') language: string,
  ) {
    return this.templateService.deleteTemplate(eventType, language);
  }

  @Post('templates/:eventType/preview')
  @HttpCode(HttpStatus.OK)
  previewTemplate(
    @Param('eventType') eventType: EmailEventType,
    @Body() body: { subject: string; bodyHtml: string },
  ) {
    const testVars: Record<string, string> = {
      firstName: 'Иван',
      verificationLink: 'https://example.com/verify?token=test',
      resetLink: 'https://example.com/reset?token=test',
      lotTitle: 'BMW 3 Series 2020',
      finalPrice: '15 000',
      auctionStartTime: '2026-03-22 15:00',
      lotLink: 'https://example.com/catalog/123',
      orderId: 'ORD-12345678',
      statusLabel: 'Заказ подтверждён',
      amount: '500',
      currency: 'EUR',
      newBalance: '2 500',
      subject: 'Тестовая тема',
      message: 'Тестовое сообщение от менеджера',
    };
    const html = this.emailService.renderPreview(body.subject, body.bodyHtml, testVars);
    return { html };
  }
}
