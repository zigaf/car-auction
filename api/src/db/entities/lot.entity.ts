import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LotStatus } from '../../common/enums/lot-status.enum';
import { FuelType } from '../../common/enums/fuel-type.enum';
import { AuctionType } from '../../common/enums/auction-type.enum';
import { LotImage } from './lot-image.entity';
import { User } from './user.entity';

@Entity('lots')
export class Lot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Source deduplication keys
  @Column({ name: 'source_id', type: 'varchar', nullable: true, unique: true })
  sourceId: string | null;

  @Column({ name: 'source_vehicle_id', type: 'varchar', nullable: true })
  sourceVehicleId: string | null;

  @Column({ name: 'source', type: 'varchar', nullable: true, default: 'autobid' })
  source: string | null;

  // Core vehicle data
  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  brand: string;

  @Column({ type: 'varchar', nullable: true })
  model: string;

  @Column({ type: 'varchar', nullable: true })
  derivative: string;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @Column({ type: 'int', nullable: true })
  mileage: number | null;

  @Column({ name: 'fuel_type', type: 'enum', enum: FuelType, nullable: true })
  fuelType: FuelType | null;

  @Column({ name: 'engine_power_kw', type: 'int', nullable: true })
  enginePowerKw: number | null;

  @Column({ name: 'engine_power_ps', type: 'int', nullable: true })
  enginePowerPs: number | null;

  @Column({ name: 'registration_date', type: 'date', nullable: true })
  registrationDate: Date | null;

  @Column({ name: 'registration_number', type: 'varchar', nullable: true })
  registrationNumber: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  vin: string;

  @Column({ name: 'exterior_color', type: 'varchar', nullable: true })
  exteriorColor: string | null;

  @Column({ name: 'vehicle_type', type: 'varchar', nullable: true })
  vehicleType: string | null;

  // Sale/auction data
  @Column({ name: 'sale_location', type: 'varchar', nullable: true })
  saleLocation: string | null;

  @Column({ name: 'vehicle_location', type: 'varchar', nullable: true })
  vehicleLocation: string | null;

  @Column({ name: 'sale_country', type: 'varchar', nullable: true })
  saleCountry: string | null;

  @Column({ name: 'sale_name', type: 'varchar', nullable: true })
  saleName: string | null;

  @Column({ name: 'sale_date', type: 'timestamp', nullable: true })
  saleDate: Date | null;

  @Column({ name: 'sale_end_date', type: 'timestamp', nullable: true })
  saleEndDate: Date | null;

  @Column({ name: 'sale_channel', type: 'varchar', nullable: true })
  saleChannel: string | null;

  @Column({ name: 'sale_type', type: 'varchar', nullable: true })
  saleType: string | null;

  // Pricing
  @Column({ name: 'starting_bid', type: 'decimal', precision: 12, scale: 2, nullable: true })
  startingBid: number | null;

  @Column({ name: 'buy_now_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  buyNowPrice: number | null;

  @Column({ name: 'original_currency', type: 'varchar', nullable: true })
  originalCurrency: string | null;

  @Column({ name: 'vat_type_code', type: 'varchar', nullable: true })
  vatTypeCode: string | null;

  @Column({ name: 'original_vat_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  originalVatRate: number | null;

  // Condition
  @Column({ name: 'cosmetic_grade', type: 'varchar', nullable: true })
  cosmeticGrade: string | null;

  @Column({ name: 'mechanical_grade', type: 'varchar', nullable: true })
  mechanicalGrade: string | null;

  @Column({ name: 'damage_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  damageCost: number | null;

  @Column({ name: 'condition_report_url', type: 'varchar', nullable: true })
  conditionReportUrl: string | null;

  // Metadata
  @Column({ name: 'source_image_url', type: 'varchar', nullable: true })
  sourceImageUrl: string | null;

  @Column({ name: 'source_url', type: 'varchar', nullable: true })
  sourceUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  specs: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: LotStatus, default: LotStatus.IMPORTED })
  status: LotStatus;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'lot_number', type: 'varchar', nullable: true })
  lotNumber: string | null;

  // Auction fields
  @Column({
    name: 'auction_type',
    type: 'enum',
    enum: AuctionType,
    nullable: true,
  })
  auctionType: AuctionType | null;

  @Column({
    name: 'reserve_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  reservePrice: number | null;

  @Column({
    name: 'bid_step',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 100,
  })
  bidStep: number;

  @Column({ name: 'auction_start_at', type: 'timestamp', nullable: true })
  auctionStartAt: Date | null;

  @Column({ name: 'auction_end_at', type: 'timestamp', nullable: true })
  auctionEndAt: Date | null;

  @Column({
    name: 'current_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  currentPrice: number | null;

  // Relations
  @OneToMany(() => LotImage, (image) => image.lot, { cascade: true })
  images: LotImage[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'winner_id' })
  winner: User | null;

  @Column({ name: 'winner_id', type: 'uuid', nullable: true })
  winnerId: string | null;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
