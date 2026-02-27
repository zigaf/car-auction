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
import { Lot } from './lot.entity';
import { User } from './user.entity';

export enum BotPattern {
  AGGRESSIVE = 'AGGRESSIVE',
  STEADY = 'STEADY',
  SNIPER = 'SNIPER',
  RANDOM = 'RANDOM',
}

@Entity('auction_bot_configs')
@Unique(['lotId', 'botUserId'])
export class AuctionBotConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lot_id', type: 'uuid' })
  lotId: string;

  @ManyToOne(() => Lot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @Column({ name: 'bot_user_id', type: 'uuid' })
  botUserId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bot_user_id' })
  botUser: User;

  @Column({ name: 'max_price', type: 'decimal', precision: 12, scale: 2 })
  maxPrice: number;

  @Column({ type: 'enum', enum: BotPattern, default: BotPattern.AGGRESSIVE })
  pattern: BotPattern;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'min_delay_sec', type: 'int', default: 2 })
  minDelaySec: number;

  @Column({ name: 'max_delay_sec', type: 'int', default: 10 })
  maxDelaySec: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
