import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ImageCategory } from '../../common/enums/image-category.enum';
import { Lot } from './lot.entity';

@Entity('lot_images')
export class LotImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lot, (lot) => lot.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @Column({ name: 'lot_id' })
  lotId: string;

  @Column()
  url: string;

  @Column({ name: 'original_url', type: 'varchar', nullable: true })
  originalUrl: string | null;

  @Column({ name: 'source_image_id', type: 'varchar', nullable: true })
  sourceImageId: string | null;

  @Column({ type: 'enum', enum: ImageCategory, default: ImageCategory.EXTERIOR })
  category: ImageCategory;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
