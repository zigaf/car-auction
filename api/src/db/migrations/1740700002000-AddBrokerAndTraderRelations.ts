import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrokerAndTraderRelations1740700002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add broker_id to users (self-referential FK)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "broker_id" uuid NULL,
      ADD CONSTRAINT "FK_users_broker_id"
        FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // Add trader_id to bids (no FK — trader may be deleted independently)
    await queryRunner.query(`
      ALTER TABLE "bids"
      ADD COLUMN "trader_id" uuid NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bids_trader_id" ON "bids" ("trader_id")
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
