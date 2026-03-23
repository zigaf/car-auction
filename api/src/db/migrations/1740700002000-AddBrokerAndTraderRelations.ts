import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrokerAndTraderRelations1740700002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "broker_id" uuid NULL`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_users_broker_id' AND table_name = 'users'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "FK_users_broker_id"
            FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);

    await queryRunner.query(`ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "trader_id" uuid NULL`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bids_trader_id" ON "bids" ("trader_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bids_trader_id"`);
    await queryRunner.query(`ALTER TABLE "bids" DROP COLUMN "trader_id"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT "FK_users_broker_id",
      DROP COLUMN "broker_id"
    `);
  }
}
