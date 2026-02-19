import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Lot } from './lot.entity';

@Entity('watchlist')
export class WatchlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Lot, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot | null;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
