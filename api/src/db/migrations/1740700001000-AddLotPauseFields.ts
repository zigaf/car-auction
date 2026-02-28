import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLotPauseFields1740700001000 implements MigrationInterface {
  name = 'AddLotPauseFields1740700001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lots"
        ADD COLUMN "is_paused" boolean NOT NULL DEFAULT false,
        ADD COLUMN "paused_remaining_ms" bigint NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lots"
        DROP COLUMN "paused_remaining_ms",
        DROP COLUMN "is_paused"
    `);
  }
}
