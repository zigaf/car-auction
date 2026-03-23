import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import { EmailSettings } from '../../db/entities/email-settings.entity';
import { EmailTemplate } from '../../db/entities/email-template.entity';
import { User } from '../../db/entities/user.entity';
import { EmailEventType } from '../../common/enums/email-event-type.enum';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from = 'RB Import <support@rbimport.com>';

  constructor(
    @InjectRepository(EmailSettings)
    private readonly settingsRepo: Repository<EmailSettings>,
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    } else {
      this.logger.warn('RESEND_API_KEY is not set — email sending is disabled');
    }
  }

  async send(
    eventType: EmailEventType,
    to: string,
    preferredLanguage: string,
    variables: Record<string, string>,
  ): Promise<void> {
    try {
      const settings = await this.settingsRepo.findOneBy({ eventType });
      if (!settings?.isEnabled) return;

      let template = await this.templateRepo.findOne({
        where: { eventType, language: preferredLanguage },
      });

      if (!template) {
        template = await this.templateRepo.findOne({
          where: { eventType, language: 'ru' },
        });
      }

      if (!template) {
        this.logger.warn(`No email template found for event=${eventType} lang=${preferredLanguage}`);
        return;
      }

      const subject = Handlebars.compile(template.subject)(variables);
      const html = Handlebars.compile(template.bodyHtml)(variables);

      if (!this.resend) {
        this.logger.warn(`Email skipped (no RESEND_API_KEY): event=${eventType} to=${to}`);
        return;
      }
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.warn(`Email send failed event=${eventType} to=${to}: ${err?.message}`);
    }
  }

  async sendToUser(
    userId: string,
    eventType: EmailEventType,
    variables: Record<string, string>,
  ): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) return;
    await this.send(eventType, user.email, user.preferredLanguage, {
      firstName: user.firstName,
      ...variables,
    });
  }

  renderPreview(subject: string, bodyHtml: string, variables: Record<string, string>): string {
    const compiledSubject = Handlebars.compile(subject)(variables);
    const compiledHtml = Handlebars.compile(bodyHtml)(variables);
    return `<html><head><title>${compiledSubject}</title></head><body>${compiledHtml}</body></html>`;
  }
}
