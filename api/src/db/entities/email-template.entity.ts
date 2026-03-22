import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { EmailSettings } from './email-settings.entity';

@Entity('email_templates')
@Unique(['eventType', 'language'])
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_type' })
  eventType: EmailEventType;

  @ManyToOne(() => EmailSettings, (s) => s.templates)
  @JoinColumn({ name: 'event_type' })
  settings: EmailSettings;

  @Column()
  language: string;

  @Column()
  subject: string;

  @Column({ name: 'body_html', type: 'text' })
  bodyHtml: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
