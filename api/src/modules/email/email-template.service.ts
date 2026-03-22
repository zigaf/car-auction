import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailSettings } from '../../db/entities/email-settings.entity';
import { EmailTemplate } from '../../db/entities/email-template.entity';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { UpsertTemplateDto } from './dto/upsert-template.dto';

@Injectable()
export class EmailTemplateService {
  constructor(
    @InjectRepository(EmailSettings)
    private readonly settingsRepo: Repository<EmailSettings>,
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
  ) {}

  async getAllSettings(): Promise<EmailSettings[]> {
    return this.settingsRepo.find();
  }

  async toggleSetting(eventType: EmailEventType, isEnabled: boolean): Promise<EmailSettings> {
    const settings = await this.settingsRepo.findOneBy({ eventType });
    if (!settings) throw new NotFoundException('Event type not found');
    settings.isEnabled = isEnabled;
    return this.settingsRepo.save(settings);
  }

  async getTemplatesForEvent(eventType: EmailEventType): Promise<EmailTemplate[]> {
    return this.templateRepo.find({ where: { eventType } });
  }

  async getTemplate(eventType: EmailEventType, language: string): Promise<EmailTemplate | null> {
    return this.templateRepo.findOne({ where: { eventType, language } });
  }

  async upsertTemplate(
    eventType: EmailEventType,
    language: string,
    dto: UpsertTemplateDto,
  ): Promise<EmailTemplate> {
    let template = await this.templateRepo.findOne({ where: { eventType, language } });

    if (template) {
      template.subject = dto.subject;
      template.bodyHtml = dto.bodyHtml;
    } else {
      template = this.templateRepo.create({
        eventType,
        language,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
      });
    }

    return this.templateRepo.save(template);
  }

  async deleteTemplate(eventType: EmailEventType, language: string): Promise<void> {
    const result = await this.templateRepo.delete({ eventType, language });
    if (result.affected === 0) throw new NotFoundException('Template not found');
  }
}
