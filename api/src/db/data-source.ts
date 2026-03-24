import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

const baseOptions: DataSourceOptions = url
  ? {
      type: 'postgres',
      url,
      ssl: url.includes('railway') ? { rejectUnauthorized: false } : false,
      entities: [__dirname + '/entities/*.entity{.ts,.js}'],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: false,
    }
  : {
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'car_auction',
      password: process.env.DATABASE_PASSWORD || 'car_auction_dev',
      database: process.env.DATABASE_NAME || 'car_auction',
      entities: [__dirname + '/entities/*.entity{.ts,.js}'],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: false,
    };

export default new DataSource(baseOptions);
