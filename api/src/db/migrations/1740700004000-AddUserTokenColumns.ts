import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTokenColumns1740700004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "email_verification_token" VARCHAR NULL,
        ADD COLUMN IF NOT EXISTS "email_verification_expires" TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "password_reset_token" VARCHAR NULL,
        ADD COLUMN IF NOT EXISTS "password_reset_expires" TIMESTAMP NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_email_verification_token"
        ON "users" ("email_verification_token")
        WHERE "email_verification_token" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_password_reset_token"
        ON "users" ("password_reset_token")
        WHERE "password_reset_token" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_password_reset_token"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email_verification_token"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "email_verification_token",
        DROP COLUMN "email_verification_expires",
        DROP COLUMN "password_reset_token",
        DROP COLUMN "password_reset_expires"
    `);
  }
}
