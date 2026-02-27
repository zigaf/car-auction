import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const EMAIL = process.env.ADMIN_EMAIL || 'admin@autobid.de';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!';

async function main() {
  const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

  const ds = new DataSource(
    url
      ? {
          type: 'postgres',
          url,
          ssl: url.includes('railway') ? { rejectUnauthorized: false } : false,
          entities: [path.join(__dirname, '../db/entities/*.entity{.ts,.js}')],
          synchronize: false,
        }
      : {
          type: 'postgres',
          host: process.env.DATABASE_HOST || 'localhost',
          port: parseInt(process.env.DATABASE_PORT || '5432', 10),
          username: process.env.DATABASE_USER || 'car_auction',
          password: process.env.DATABASE_PASSWORD || 'car_auction_dev',
          database: process.env.DATABASE_NAME || 'car_auction',
          entities: [path.join(__dirname, '../db/entities/*.entity{.ts,.js}')],
          synchronize: false,
        },
  );

  await ds.initialize();

  const repo = ds.getRepository('users');

  const existing = await repo.findOne({ where: { email: EMAIL } });
  if (existing) {
    console.log(`User ${EMAIL} already exists. Updating role to admin...`);
    await repo.update({ email: EMAIL }, { role: 'admin' });
    console.log('Done.');
    await ds.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await repo.insert({
    email: EMAIL,
    passwordHash,
    firstName: 'Admin',
    lastName: 'AutoBid',
    role: 'admin',
    status: 'active',
    isVerified: true,
    preferredLanguage: 'ru',
    preferredCurrency: 'EUR',
    countryFlag: '🇩🇪',
    referralCode: randomUUID().slice(0, 8).toUpperCase(),
  });

  console.log(`Admin created: ${EMAIL} / ${PASSWORD}`);
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
