import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Language } from '../../common/enums/language.enum';
import { Currency } from '../../common/enums/currency.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'google_id', type: 'varchar', nullable: true, unique: true })
  googleId: string | null;

  @Column({ name: 'yandex_id', type: 'varchar', nullable: true, unique: true })
  yandexId: string | null;

  @Column({ name: 'vk_id', type: 'varchar', nullable: true, unique: true })
  vkId: string | null;

  @Column({ name: 'telegram_id', type: 'varchar', nullable: true, unique: true })
  telegramId: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'country_flag', default: '' })
  countryFlag: string;

  @Column({ type: 'enum', enum: Role, default: Role.CLIENT })
  role: Role;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({
    name: 'preferred_language',
    type: 'enum',
    enum: Language,
    default: Language.RU,
  })
  preferredLanguage: Language;

  @Column({
    name: 'preferred_currency',
    type: 'enum',
    enum: Currency,
    default: Currency.EUR,
  })
  preferredCurrency: Currency;

  @Column({ name: 'referral_code', unique: true })
  referralCode: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'referred_by' })
  referredBy: User | null;

  @Column({ name: 'referred_by', type: 'uuid', nullable: true })
  referredById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
