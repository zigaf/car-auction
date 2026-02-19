import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeOrmConfig = (): TypeOrmModuleOptions => {
  // Support Railway DATABASE_URL or individual PG* / DATABASE_* vars
  const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

  if (url) {
    return {
      type: 'postgres',
      url,
      ssl: url.includes('railway') ? { rejectUnauthorized: false } : false,
      entities: [__dirname + '/../db/entities/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../db/migrations/*{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    };
  }

  return {
    type: 'postgres',
    host: process.env.PGHOST || process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.PGPORT || process.env.DATABASE_PORT || '5432', 10),
    username: process.env.PGUSER || process.env.DATABASE_USER || 'car_auction',
    password: process.env.PGPASSWORD || process.env.DATABASE_PASSWORD || 'car_auction_dev',
    database: process.env.PGDATABASE || process.env.DATABASE_NAME || 'car_auction',
    entities: [__dirname + '/../db/entities/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../db/migrations/*{.ts,.js}'],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  };
};
