import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { EmailTemplate } from './email-template.entity';

@Entity('email_settings')
export class EmailSettings {
  @PrimaryColumn({ name: 'event_type' })
  eventType: EmailEventType;

  @Column({ name: 'is_enabled', default: true })
  isEnabled: boolean;

  @OneToMany(() => EmailTemplate, (t) => t.settings)
  templates: EmailTemplate[];
}
