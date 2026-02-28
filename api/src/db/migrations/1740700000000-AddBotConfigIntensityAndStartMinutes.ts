import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBotConfigIntensityAndStartMinutes1740700000000
  implements MigrationInterface
{
  name = 'AddBotConfigIntensityAndStartMinutes1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "auction_bot_configs"
        ADD COLUMN "intensity" numeric(4,2) NOT NULL DEFAULT 1.0,
        ADD COLUMN "start_minutes_before_end" integer NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "auction_bot_configs"
        DROP COLUMN "start_minutes_before_end",
        DROP COLUMN "intensity"
    `);
  }
}
