import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { ScraperRunStatus } from '../../common/enums/scraper-run-status.enum';

@Entity('scraper_runs')
export class ScraperRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ScraperRunStatus, default: ScraperRunStatus.RUNNING })
  status: ScraperRunStatus;

  @Column({ name: 'total_pages', type: 'int', default: 0 })
  totalPages: number;

  @Column({ name: 'pages_scraped', type: 'int', default: 0 })
  pagesScraped: number;

  @Column({ name: 'lots_found', type: 'int', default: 0 })
  lotsFound: number;

  @Column({ name: 'lots_created', type: 'int', default: 0 })
  lotsCreated: number;

  @Column({ name: 'lots_updated', type: 'int', default: 0 })
  lotsUpdated: number;

  @Column({ name: 'images_downloaded', type: 'int', default: 0 })
  imagesDownloaded: number;

  @Column({ name: 'errors_count', type: 'int', default: 0 })
  errorsCount: number;

  @Column({ name: 'error_log', type: 'text', nullable: true })
  errorLog: string | null;

  @Column({ name: 'triggered_by', default: 'cron' })
  triggeredBy: string;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
