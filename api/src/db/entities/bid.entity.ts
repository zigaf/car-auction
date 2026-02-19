import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Lot } from './lot.entity';
import { User } from './user.entity';

@Index(['lotId', 'amount'])
@Entity('bids')
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lot, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @Index()
  @Column({ name: 'lot_id', type: 'uuid' })
  lotId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'is_pre_bid', type: 'boolean', default: false })
  isPreBid: boolean;

  @Column({
    name: 'max_auto_bid',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  maxAutoBid: number | null;

  @Column({ name: 'idempotency_key', type: 'varchar', unique: true })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
