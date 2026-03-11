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

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'author_name', type: 'varchar', length: 100 })
  authorName: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text' })
  text: string;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
