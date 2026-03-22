import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailTables1740700003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_settings" (
        "event_type" VARCHAR PRIMARY KEY,
        "is_enabled" BOOLEAN NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "email_templates" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_type" VARCHAR NOT NULL,
        "language" VARCHAR NOT NULL,
        "subject" VARCHAR NOT NULL,
        "body_html" TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_email_templates_event_type"
          FOREIGN KEY ("event_type") REFERENCES "email_settings"("event_type")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_email_templates_event_language"
          UNIQUE ("event_type", "language")
      )
    `);

    const events = [
      'EMAIL_VERIFICATION',
      'PASSWORD_RESET',
      'AUCTION_WON',
      'AUCTION_STARTING',
      'ORDER_STATUS_CHANGED',
      'BALANCE_TOPPED_UP',
      'BALANCE_WITHDRAWN',
      'CUSTOM',
    ];

    for (const event of events) {
      await queryRunner.query(
        `INSERT INTO "email_settings" ("event_type", "is_enabled") VALUES ($1, true)`,
        [event],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "email_templates"`);
    await queryRunner.query(`DROP TABLE "email_settings"`);
  }
}
