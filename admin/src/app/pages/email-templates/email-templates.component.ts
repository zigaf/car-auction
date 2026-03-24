import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import {
  EmailAdminService,
  EmailSetting,
  EmailTemplate,
  EVENT_LABELS,
  EVENT_VARIABLES,
} from '../../core/services/email.service';

interface EventRow {
  setting: EmailSetting;
  label: string;
  description: string;
  variables: string[];
  expanded: boolean;
  templates: EmailTemplate[];
  activeLanguage: string;
  editSubject: string;
  editBodyHtml: string;
  previewHtml: string | null;
  saving: boolean;
  loadingTemplates: boolean;
}

const EVENT_DESCRIPTIONS: Record<string, string> = {
  EMAIL_VERIFICATION: 'Отправляется при регистрации для подтверждения email адреса',
  PASSWORD_RESET: 'Отправляется при запросе восстановления пароля',
  AUCTION_WON: 'Отправляется победителю после завершения аукциона',
  AUCTION_STARTING: 'Отправляется подписчикам перед началом аукциона',
  ORDER_STATUS_CHANGED: 'Отправляется при изменении статуса заказа (оплата, доставка и т.д.)',
  BALANCE_TOPPED_UP: 'Отправляется при зачислении средств на баланс',
  BALANCE_WITHDRAWN: 'Отправляется при списании средств с баланса',
  CUSTOM: 'Ручная рассылка — произвольное письмо пользователям',
};

const AVAILABLE_LANGUAGES = ['ru', 'en', 'ua'];

@Component({
  selector: 'app-email-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSlideToggleModule,
    MatButtonModule,
  ],
  templateUrl: './email-templates.component.html',
  styleUrl: './email-templates.component.scss',
})
export class EmailTemplatesComponent implements OnInit {
  private readonly emailService = inject(EmailAdminService);

  rows: EventRow[] = [];
  availableLanguages = AVAILABLE_LANGUAGES;

  ngOnInit(): void {
    this.emailService.getSettings().subscribe((settings) => {
      this.rows = settings.map((s) => ({
        setting: s,
        label: EVENT_LABELS[s.eventType] ?? s.eventType,
        description: EVENT_DESCRIPTIONS[s.eventType] ?? '',
        variables: EVENT_VARIABLES[s.eventType] ?? [],
        expanded: false,
        templates: [],
        activeLanguage: 'ru',
        editSubject: '',
        editBodyHtml: '',
        previewHtml: null,
        saving: false,
        loadingTemplates: false,
      }));
    });
  }

  toggleExpand(row: EventRow): void {
    row.expanded = !row.expanded;
    if (row.expanded && row.templates.length === 0) {
      this.loadTemplates(row);
    }
  }

  loadTemplates(row: EventRow): void {
    row.loadingTemplates = true;
    this.emailService.getTemplates(row.setting.eventType).subscribe({
      next: (templates) => {
        row.templates = templates;
        row.loadingTemplates = false;
        this.switchLanguage(row, row.activeLanguage);
      },
      error: () => { row.loadingTemplates = false; },
    });
  }

  switchLanguage(row: EventRow, lang: string): void {
    row.activeLanguage = lang;
    row.previewHtml = null;
    const tpl = row.templates.find((t) => t.language === lang);
    row.editSubject = tpl?.subject ?? '';
    row.editBodyHtml = tpl?.bodyHtml ?? '';
  }

  hasTemplate(row: EventRow, lang: string): boolean {
    return row.templates.some((t) => t.language === lang);
  }

  onToggle(row: EventRow): void {
    this.emailService.toggleSetting(row.setting.eventType, row.setting.isEnabled).subscribe();
  }

  save(row: EventRow): void {
    row.saving = true;
    this.emailService
      .upsertTemplate(row.setting.eventType, row.activeLanguage, row.editSubject, row.editBodyHtml)
      .subscribe({
        next: (tpl) => {
          const idx = row.templates.findIndex((t) => t.language === row.activeLanguage);
          if (idx >= 0) row.templates[idx] = tpl;
          else row.templates.push(tpl);
          row.saving = false;
        },
        error: () => { row.saving = false; },
      });
  }

  deleteTemplate(row: EventRow): void {
    if (!confirm('Удалить шаблон для этого языка?')) return;
    this.emailService.deleteTemplate(row.setting.eventType, row.activeLanguage).subscribe(() => {
      row.templates = row.templates.filter((t) => t.language !== row.activeLanguage);
      row.editSubject = '';
      row.editBodyHtml = '';
      row.previewHtml = null;
    });
  }

  preview(row: EventRow): void {
    this.emailService
      .preview(row.setting.eventType, row.editSubject, row.editBodyHtml)
      .subscribe((res) => {
        row.previewHtml = res.html;
      });
  }
}
