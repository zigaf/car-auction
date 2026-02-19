import {
  Entity,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Lot } from './lot.entity';

@Entity('favorites')
export class Favorite {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'lot_id', type: 'uuid' })
  lotId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Lot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
