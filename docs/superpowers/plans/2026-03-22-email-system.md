# Email System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a configurable transactional email system using Resend + Handlebars DB-stored templates with admin UI for managing templates and client-side email verification / password reset flows.

**Architecture:** `EmailModule` (NestJS) provides `EmailService` (Resend SDK + Handlebars rendering) and `EmailTemplateService` (DB CRUD). All email sends are fire-and-forget injected into existing services. Admin Angular page manages templates per event/language. Client gets two new pages: `/verify-email` and `/reset-password`.

**Tech Stack:** `resend` SDK, `handlebars`, TypeORM migrations, Angular 20 standalone components, Angular Material (MatSlideToggle, MatTabs)

> **IMPORTANT — spec typo:** The spec mentions language value `uk`, but the actual `Language` enum in the codebase uses `ua`. Always use `ua` everywhere in this implementation — migrations, entities, admin UI, EmailService fallback. Ignore `uk` in the spec.

**Spec:** `docs/superpowers/specs/2026-03-22-email-system-design.md`

---

## File Map

### API — New files
- `api/src/common/enums/email-event-type.enum.ts` — enum of 8 event types
- `api/src/db/entities/email-settings.entity.ts` — EmailSettings TypeORM entity
- `api/src/db/entities/email-template.entity.ts` — EmailTemplate TypeORM entity
- `api/src/db/migrations/1740700003000-CreateEmailTables.ts` — create tables + seed settings
- `api/src/db/migrations/1740700004000-AddUserTokenColumns.ts` — add 4 token columns to users
- `api/src/modules/email/email.service.ts` — Resend + Handlebars core send
- `api/src/modules/email/email-template.service.ts` — CRUD for templates
- `api/src/modules/email/email.controller.ts` — admin REST endpoints
- `api/src/modules/email/email.module.ts` — module wiring
- `api/src/modules/email/dto/upsert-template.dto.ts`
- `api/src/modules/email/dto/toggle-setting.dto.ts`
- `api/src/modules/auth/dto/verify-email.dto.ts`
- `api/src/modules/auth/dto/forgot-password.dto.ts`
- `api/src/modules/auth/dto/reset-password.dto.ts`
- `api/src/modules/auth/dto/resend-verification.dto.ts`

### API — Modified files
- `api/src/db/entities/user.entity.ts` — add 4 token columns
- `api/src/modules/auth/auth.service.ts` — signup sends email, new methods for verify/reset/resend
- `api/src/modules/auth/auth.controller.ts` — 4 new endpoints
- `api/src/modules/auth/auth.module.ts` — import EmailModule
- `api/src/modules/auction/auction-scheduler.service.ts` — AUCTION_WON + AUCTION_STARTING emails
- `api/src/modules/auction/auction.module.ts` — import EmailModule + WatchlistItem
- `api/src/modules/order/order.service.ts` — ORDER_STATUS_CHANGED email
- `api/src/modules/order/order.module.ts` — import EmailModule + User
- `api/src/modules/balance/balance.service.ts` — BALANCE_TOPPED_UP / WITHDRAWN emails
- `api/src/modules/balance/balance.module.ts` — import EmailModule + User
- `api/src/modules/notification/notification.service.ts` — CUSTOM email wire
- `api/src/modules/notification/notification.module.ts` — import EmailModule + User
- `api/src/app.module.ts` — import EmailModule

### Admin — New files
- `admin/src/app/pages/email-templates/email-templates.component.ts`
- `admin/src/app/pages/email-templates/email-templates.component.html`
- `admin/src/app/pages/email-templates/email-templates.component.scss`
- `admin/src/app/core/services/email.service.ts`

### Admin — Modified files
- `admin/src/app/app.routes.ts` — add `/email-templates` route
- `admin/src/app/layout/admin-layout/admin-layout.ts` — add sidebar nav item
- `admin/src/app/core/services/api.service.ts` — add `put` method

### Client — New files
- `client/src/app/pages/auth/verify-email/verify-email.ts`
- `client/src/app/pages/auth/verify-email/verify-email.html`
- `client/src/app/pages/auth/verify-email/verify-email.scss`
- `client/src/app/pages/auth/reset-password/reset-password.ts`
- `client/src/app/pages/auth/reset-password/reset-password.html`
- `client/src/app/pages/auth/reset-password/reset-password.scss`

### Client — Modified files
- `client/src/app/app.routes.ts` — add 2 new routes
- `client/src/app/pages/auth/login/login.ts` — forgot-password form + PENDING banner
- `client/src/app/pages/auth/login/login.html` — UI for above

---

## Task 1: Install packages and create email event enum

**Files:**
- Create: `api/src/common/enums/email-event-type.enum.ts`

- [ ] **Step 1: Install packages in api/**

```bash
cd api && npm install resend handlebars && npm install --save-dev @types/handlebars
```

Expected: packages added to `api/package.json` dependencies.

- [ ] **Step 2: Create the email event type enum**

Create `api/src/common/enums/email-event-type.enum.ts`:

```typescript
export enum EmailEventType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  AUCTION_WON = 'AUCTION_WON',
  AUCTION_STARTING = 'AUCTION_STARTING',
  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  BALANCE_TOPPED_UP = 'BALANCE_TOPPED_UP',
  BALANCE_WITHDRAWN = 'BALANCE_WITHDRAWN',
  CUSTOM = 'CUSTOM',
}
```

- [ ] **Step 3: Commit**

```bash
cd api && git add package.json package-lock.json ../api/src/common/enums/email-event-type.enum.ts
git commit -m "feat(email): install resend/handlebars, add EmailEventType enum"
```

---

## Task 2: Create DB entities

**Files:**
- Create: `api/src/db/entities/email-settings.entity.ts`
- Create: `api/src/db/entities/email-template.entity.ts`

- [ ] **Step 1: Create EmailSettings entity**

Create `api/src/db/entities/email-settings.entity.ts`:

```typescript
import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { EmailTemplate } from './email-template.entity';

@Entity('email_settings')
export class EmailSettings {
  @PrimaryColumn({ name: 'event_type' })
  eventType: EmailEventType;

  @Column({ name: 'is_enabled', default: true })
  isEnabled: boolean;

  @OneToMany(() => EmailTemplate, (t) => t.settings)
  templates: EmailTemplate[];
}
```

- [ ] **Step 2: Create EmailTemplate entity**

Create `api/src/db/entities/email-template.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { EmailSettings } from './email-settings.entity';

@Entity('email_templates')
@Unique(['eventType', 'language'])
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_type' })
  eventType: EmailEventType;

  @ManyToOne(() => EmailSettings, (s) => s.templates)
  @JoinColumn({ name: 'event_type' })
  settings: EmailSettings;

  @Column()
  language: string;

  @Column()
  subject: string;

  @Column({ name: 'body_html', type: 'text' })
  bodyHtml: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 3: Commit**

```bash
git add api/src/db/entities/email-settings.entity.ts api/src/db/entities/email-template.entity.ts
git commit -m "feat(email): add EmailSettings and EmailTemplate entities"
```

---

## Task 3: Migration 1 — create email tables

**Files:**
- Create: `api/src/db/migrations/1740700003000-CreateEmailTables.ts`

- [ ] **Step 1: Create migration file**

Create `api/src/db/migrations/1740700003000-CreateEmailTables.ts`:

```typescript
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

    // Seed all 8 event types with is_enabled=true
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
```

- [ ] **Step 2: Run migration**

```bash
cd api && npm run migration:run
```

Expected: `CreateEmailTables1740700003000 has been executed successfully.`

- [ ] **Step 3: Commit**

```bash
git add api/src/db/migrations/1740700003000-CreateEmailTables.ts
git commit -m "feat(email): migration — create email_settings and email_templates tables"
```

---

## Task 4: Migration 2 — add token columns to users + update User entity

**Files:**
- Create: `api/src/db/migrations/1740700004000-AddUserTokenColumns.ts`
- Modify: `api/src/db/entities/user.entity.ts`

- [ ] **Step 1: Create migration**

Create `api/src/db/migrations/1740700004000-AddUserTokenColumns.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTokenColumns1740700004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "email_verification_token" VARCHAR NULL,
        ADD COLUMN "email_verification_expires" TIMESTAMP NULL,
        ADD COLUMN "password_reset_token" VARCHAR NULL,
        ADD COLUMN "password_reset_expires" TIMESTAMP NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_email_verification_token"
        ON "users" ("email_verification_token")
        WHERE "email_verification_token" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_password_reset_token"
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
```

- [ ] **Step 2: Add token columns to User entity**

Open `api/src/db/entities/user.entity.ts`. After the `referralCode` column (around line 79), add:

```typescript
  @Column({ name: 'email_verification_token', type: 'varchar', nullable: true })
  emailVerificationToken: string | null;

  @Column({ name: 'email_verification_expires', type: 'timestamp', nullable: true })
  emailVerificationExpires: Date | null;

  @Column({ name: 'password_reset_token', type: 'varchar', nullable: true })
  passwordResetToken: string | null;

  @Column({ name: 'password_reset_expires', type: 'timestamp', nullable: true })
  passwordResetExpires: Date | null;
```

- [ ] **Step 3: Run migration**

```bash
cd api && npm run migration:run
```

Expected: `AddUserTokenColumns1740700004000 has been executed successfully.`

- [ ] **Step 4: Commit**

```bash
git add api/src/db/migrations/1740700004000-AddUserTokenColumns.ts api/src/db/entities/user.entity.ts
git commit -m "feat(email): add token columns to users table and entity"
```

---

## Task 5: Create EmailService

**Files:**
- Create: `api/src/modules/email/email.service.ts`

- [ ] **Step 1: Write the service**

Create `api/src/modules/email/email.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import { EmailSettings } from '../../db/entities/email-settings.entity';
import { EmailTemplate } from '../../db/entities/email-template.entity';
import { User } from '../../db/entities/user.entity';
import { EmailEventType } from '../../common/enums/email-event-type.enum';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from = 'RB Import <support@rbimport.com>';

  constructor(
    @InjectRepository(EmailSettings)
    private readonly settingsRepo: Repository<EmailSettings>,
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async send(
    eventType: EmailEventType,
    to: string,
    preferredLanguage: string,
    variables: Record<string, string>,
  ): Promise<void> {
    try {
      const settings = await this.settingsRepo.findOneBy({ eventType });
      if (!settings?.isEnabled) return;

      let template = await this.templateRepo.findOne({
        where: { eventType, language: preferredLanguage },
      });

      if (!template) {
        template = await this.templateRepo.findOne({
          where: { eventType, language: 'ru' },
        });
      }

      if (!template) {
        this.logger.warn(`No email template found for event=${eventType} lang=${preferredLanguage}`);
        return;
      }

      const subject = Handlebars.compile(template.subject)(variables);
      const html = Handlebars.compile(template.bodyHtml)(variables);

      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.warn(`Email send failed event=${eventType} to=${to}: ${err?.message}`);
    }
  }

  async sendToUser(
    userId: string,
    eventType: EmailEventType,
    variables: Record<string, string>,
  ): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) return;
    await this.send(eventType, user.email, user.preferredLanguage, {
      firstName: user.firstName,
      ...variables,
    });
  }

  renderPreview(subject: string, bodyHtml: string, variables: Record<string, string>): string {
    const compiledSubject = Handlebars.compile(subject)(variables);
    const compiledHtml = Handlebars.compile(bodyHtml)(variables);
    return `<html><head><title>${compiledSubject}</title></head><body>${compiledHtml}</body></html>`;
  }
}
```

- [ ] **Step 2: Verify the service compiles**

```bash
cd api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/src/modules/email/email.service.ts
git commit -m "feat(email): add EmailService with Resend + Handlebars rendering"
```

---

## Task 6: Create EmailTemplateService and DTOs

**Files:**
- Create: `api/src/modules/email/email-template.service.ts`
- Create: `api/src/modules/email/dto/upsert-template.dto.ts`
- Create: `api/src/modules/email/dto/toggle-setting.dto.ts`

- [ ] **Step 1: Create DTOs**

Create `api/src/modules/email/dto/upsert-template.dto.ts`:

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class UpsertTemplateDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  bodyHtml: string;
}
```

Create `api/src/modules/email/dto/toggle-setting.dto.ts`:

```typescript
import { IsBoolean } from 'class-validator';

export class ToggleSettingDto {
  @IsBoolean()
  isEnabled: boolean;
}
```

- [ ] **Step 2: Create EmailTemplateService**

Create `api/src/modules/email/email-template.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailSettings } from '../../db/entities/email-settings.entity';
import { EmailTemplate } from '../../db/entities/email-template.entity';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { UpsertTemplateDto } from './dto/upsert-template.dto';

@Injectable()
export class EmailTemplateService {
  constructor(
    @InjectRepository(EmailSettings)
    private readonly settingsRepo: Repository<EmailSettings>,
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
  ) {}

  async getAllSettings(): Promise<EmailSettings[]> {
    return this.settingsRepo.find();
  }

  async toggleSetting(eventType: EmailEventType, isEnabled: boolean): Promise<EmailSettings> {
    const settings = await this.settingsRepo.findOneBy({ eventType });
    if (!settings) throw new NotFoundException('Event type not found');
    settings.isEnabled = isEnabled;
    return this.settingsRepo.save(settings);
  }

  async getTemplatesForEvent(eventType: EmailEventType): Promise<EmailTemplate[]> {
    return this.templateRepo.find({ where: { eventType } });
  }

  async getTemplate(eventType: EmailEventType, language: string): Promise<EmailTemplate | null> {
    return this.templateRepo.findOne({ where: { eventType, language } });
  }

  async upsertTemplate(
    eventType: EmailEventType,
    language: string,
    dto: UpsertTemplateDto,
  ): Promise<EmailTemplate> {
    let template = await this.templateRepo.findOne({ where: { eventType, language } });

    if (template) {
      template.subject = dto.subject;
      template.bodyHtml = dto.bodyHtml;
    } else {
      template = this.templateRepo.create({
        eventType,
        language,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
      });
    }

    return this.templateRepo.save(template);
  }

  async deleteTemplate(eventType: EmailEventType, language: string): Promise<void> {
    const result = await this.templateRepo.delete({ eventType, language });
    if (result.affected === 0) throw new NotFoundException('Template not found');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add api/src/modules/email/dto/ api/src/modules/email/email-template.service.ts
git commit -m "feat(email): add EmailTemplateService and DTOs"
```

---

## Task 7: Create EmailController and EmailModule

**Files:**
- Create: `api/src/modules/email/email.controller.ts`
- Create: `api/src/modules/email/email.module.ts`

- [ ] **Step 1: Create EmailController**

Create `api/src/modules/email/email.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Patch,
  Put,
  Delete,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { EmailTemplateService } from './email-template.service';
import { EmailService } from './email.service';
import { UpsertTemplateDto } from './dto/upsert-template.dto';
import { ToggleSettingDto } from './dto/toggle-setting.dto';
import { EmailEventType } from '../../common/enums/email-event-type.enum';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BROKER)
export class EmailController {
  constructor(
    private readonly templateService: EmailTemplateService,
    private readonly emailService: EmailService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.templateService.getAllSettings();
  }

  @Patch('settings/:eventType')
  @HttpCode(HttpStatus.OK)
  toggleSetting(
    @Param('eventType') eventType: EmailEventType,
    @Body() dto: ToggleSettingDto,
  ) {
    return this.templateService.toggleSetting(eventType, dto.isEnabled);
  }

  @Get('templates/:eventType')
  getTemplates(@Param('eventType') eventType: EmailEventType) {
    return this.templateService.getTemplatesForEvent(eventType);
  }

  @Get('templates/:eventType/:language')
  getTemplate(
    @Param('eventType') eventType: EmailEventType,
    @Param('language') language: string,
  ) {
    return this.templateService.getTemplate(eventType, language);
  }

  @Put('templates/:eventType/:language')
  upsertTemplate(
    @Param('eventType') eventType: EmailEventType,
    @Param('language') language: string,
    @Body() dto: UpsertTemplateDto,
  ) {
    return this.templateService.upsertTemplate(eventType, language, dto);
  }

  @Delete('templates/:eventType/:language')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTemplate(
    @Param('eventType') eventType: EmailEventType,
    @Param('language') language: string,
  ) {
    return this.templateService.deleteTemplate(eventType, language);
  }

  @Post('templates/:eventType/preview')
  @HttpCode(HttpStatus.OK)
  previewTemplate(
    @Param('eventType') eventType: EmailEventType,
    @Body() body: { subject: string; bodyHtml: string },
  ) {
    const testVars: Record<string, string> = {
      firstName: 'Иван',
      verificationLink: 'https://example.com/verify?token=test',
      resetLink: 'https://example.com/reset?token=test',
      lotTitle: 'BMW 3 Series 2020',
      finalPrice: '15 000',
      auctionStartTime: '2026-03-22 15:00',
      lotLink: 'https://example.com/catalog/123',
      orderId: 'ORD-12345678',
      statusLabel: 'Заказ подтверждён',
      amount: '500',
      currency: 'EUR',
      newBalance: '2 500',
      subject: 'Тестовая тема',
      message: 'Тестовое сообщение от менеджера',
    };
    const html = this.emailService.renderPreview(body.subject, body.bodyHtml, testVars);
    return { html };
  }
}
```

- [ ] **Step 2: Create EmailModule**

Create `api/src/modules/email/email.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSettings } from '../../db/entities/email-settings.entity';
import { EmailTemplate } from '../../db/entities/email-template.entity';
import { User } from '../../db/entities/user.entity';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailController } from './email.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailSettings, EmailTemplate, User])],
  providers: [EmailService, EmailTemplateService],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule {}
```

- [ ] **Step 3: Register EmailModule in AppModule**

Open `api/src/app.module.ts`. Add `EmailModule` to the imports array and add the import statement:

```typescript
import { EmailModule } from './modules/email/email.module';
// add EmailModule to imports array
```

- [ ] **Step 4: Verify compilation**

```bash
cd api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add api/src/modules/email/ api/src/app.module.ts
git commit -m "feat(email): add EmailController, EmailModule, register in AppModule"
```

---

## Task 8: Auth — email verification flow

**Files:**
- Create: `api/src/modules/auth/dto/verify-email.dto.ts`
- Create: `api/src/modules/auth/dto/resend-verification.dto.ts`
- Modify: `api/src/modules/auth/auth.service.ts`
- Modify: `api/src/modules/auth/auth.controller.ts`
- Modify: `api/src/modules/auth/auth.module.ts`

- [ ] **Step 1: Create DTOs**

Create `api/src/modules/auth/dto/verify-email.dto.ts`:
```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
```

Create `api/src/modules/auth/dto/resend-verification.dto.ts`:
```typescript
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  email: string;
}
```

- [ ] **Step 2: Update AuthService — inject EmailService + add methods**

Open `api/src/modules/auth/auth.service.ts`.

Add `EmailService` and `randomBytes` import at the top:
```typescript
import { randomBytes } from 'crypto';
// (createHash and randomUUID already imported)
import { EmailService } from '../email/email.service';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
```

Add `EmailService` to constructor:
```typescript
constructor(
  @InjectRepository(User) private readonly userRepository: Repository<User>,
  @InjectRepository(RefreshToken) private readonly refreshTokenRepository: Repository<RefreshToken>,
  private readonly jwtService: JwtService,
  private readonly emailService: EmailService,
) {}
```

Replace the entire `signup()` method body so it returns a simple message instead of tokens. Email/password signups create a PENDING user and send a verification email — **they do NOT get a session**. OAuth users (handled via `findOrCreateOAuthUser`) remain unaffected.

```typescript
async signup(dto: SignupDto) {
  const existing = await this.userRepository.findOneBy({ email: dto.email });
  if (existing) {
    throw new ConflictException('Email already registered');
  }

  const passwordHash = await bcrypt.hash(dto.password, 12);
  const referralCode = randomUUID().slice(0, 8).toUpperCase();
  const verificationToken = randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = this.userRepository.create({
    email: dto.email,
    passwordHash,
    firstName: dto.firstName,
    lastName: dto.lastName,
    phone: dto.phone ?? undefined,
    referralCode,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
    // status defaults to PENDING, isVerified defaults to false — confirmed by entity defaults
  });
  await this.userRepository.save(user);

  const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
  this.emailService.send(
    EmailEventType.EMAIL_VERIFICATION,
    user.email,
    user.preferredLanguage,
    { firstName: user.firstName, verificationLink },
  ).catch(() => {});

  return { message: 'Registration successful. Please check your email to verify your account.' };
}
```

**Also update `client/src/app/pages/auth/register/register.ts`:** After a successful signup call, instead of saving tokens and navigating to `/cabinet`, show a message like "Проверьте email для подтверждения" and navigate to `/login`. Read `register.ts` first to understand the current flow.

In `login()`, after `isValid` check and before `generateTokens`, add PENDING check:
```typescript
if (user.status === UserStatus.PENDING) {
  throw new ForbiddenException({ message: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
}
```

Add new methods to `AuthService`:
```typescript
async verifyEmail(token: string): Promise<void> {
  const user = await this.userRepository.findOneBy({ emailVerificationToken: token });
  if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
    throw new BadRequestException('Invalid or expired verification token');
  }
  user.isVerified = true;
  user.status = UserStatus.ACTIVE;
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await this.userRepository.save(user);
}

async resendVerification(email: string): Promise<void> {
  const user = await this.userRepository.findOneBy({ email });
  if (!user) return; // silent no-op for unknown emails

  if (user.status !== UserStatus.PENDING) {
    throw new BadRequestException('Account is already verified or not eligible for resend');
  }

  if (!user.passwordHash) {
    throw new BadRequestException('This account uses social login');
  }

  const token = randomBytes(32).toString('hex');
  user.emailVerificationToken = token;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await this.userRepository.save(user);

  const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  this.emailService.send(
    EmailEventType.EMAIL_VERIFICATION,
    user.email,
    user.preferredLanguage,
    { firstName: user.firstName, verificationLink },
  ).catch(() => {});
}
```

- [ ] **Step 3: Also auto-verify OAuth users in findOrCreateOAuthUser**

In `findOrCreateOAuthUser`, when creating a new user (step 3), add to the `newUser` create call:
```typescript
isVerified: true,
status: UserStatus.ACTIVE,
```

Also add the same two fields when linking an OAuth provider to an existing email user (step 2):
```typescript
existingByEmail.isVerified = true;
existingByEmail.status = UserStatus.ACTIVE;
```

- [ ] **Step 4: Add new endpoints to AuthController**

Open `api/src/modules/auth/auth.controller.ts`. Add these imports and endpoints:

```typescript
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
```

```typescript
@Post('verify-email')
@HttpCode(HttpStatus.OK)
async verifyEmail(@Body() dto: VerifyEmailDto) {
  await this.authService.verifyEmail(dto.token);
  return { message: 'Email verified successfully' };
}

@Post('resend-verification')
@HttpCode(HttpStatus.OK)
async resendVerification(@Body() dto: ResendVerificationDto) {
  await this.authService.resendVerification(dto.email);
  return { message: 'Verification email sent if account exists' };
}
```

- [ ] **Step 5: Import EmailModule in AuthModule**

Open `api/src/modules/auth/auth.module.ts`. Add:
```typescript
import { EmailModule } from '../email/email.module';
// add EmailModule to imports array
```

- [ ] **Step 6: Verify compilation**

```bash
cd api && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add api/src/modules/auth/
git commit -m "feat(auth): add email verification flow (signup sends token, verify-email endpoint, auto-verify OAuth)"
```

---

## Task 9: Auth — password reset flow

**Files:**
- Create: `api/src/modules/auth/dto/forgot-password.dto.ts`
- Create: `api/src/modules/auth/dto/reset-password.dto.ts`
- Modify: `api/src/modules/auth/auth.service.ts`
- Modify: `api/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Create DTOs**

Create `api/src/modules/auth/dto/forgot-password.dto.ts`:
```typescript
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
```

Create `api/src/modules/auth/dto/reset-password.dto.ts`:
```typescript
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

- [ ] **Step 2: Add methods to AuthService**

Add to `api/src/modules/auth/auth.service.ts`:

```typescript
async forgotPassword(email: string): Promise<void> {
  const user = await this.userRepository.findOneBy({ email });
  if (!user) return; // silent no-op for unknown emails

  if (!user.passwordHash) {
    throw new BadRequestException('This account uses social login. Password reset is not available.');
  }

  const token = randomBytes(32).toString('hex');
  user.passwordResetToken = token;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await this.userRepository.save(user);

  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  this.emailService.send(
    EmailEventType.PASSWORD_RESET,
    user.email,
    user.preferredLanguage,
    { firstName: user.firstName, resetLink },
  ).catch(() => {});
}

async resetPassword(token: string, newPassword: string): Promise<void> {
  const user = await this.userRepository.findOneBy({ passwordResetToken: token });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw new BadRequestException('Invalid or expired reset token');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await this.userRepository.save(user);
}
```

- [ ] **Step 3: Add endpoints to AuthController**

Add to `api/src/modules/auth/auth.controller.ts`:

```typescript
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
```

```typescript
@Post('forgot-password')
@HttpCode(HttpStatus.OK)
async forgotPassword(@Body() dto: ForgotPasswordDto) {
  await this.authService.forgotPassword(dto.email);
  return { message: 'Reset email sent if account exists' };
}

@Post('reset-password')
@HttpCode(HttpStatus.OK)
async resetPassword(@Body() dto: ResetPasswordDto) {
  await this.authService.resetPassword(dto.token, dto.newPassword);
  return { message: 'Password reset successfully' };
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd api && npx tsc --noEmit
git add api/src/modules/auth/
git commit -m "feat(auth): add forgot-password and reset-password flow"
```

---

## Task 10: Wire email into AuctionSchedulerService

**Files:**
- Modify: `api/src/modules/auction/auction-scheduler.service.ts`
- Modify: `api/src/modules/auction/auction.module.ts`

- [ ] **Step 1: Add EmailService to AuctionSchedulerService**

Open `api/src/modules/auction/auction-scheduler.service.ts`.

Add import:
```typescript
import { EmailService } from '../email/email.service';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { WatchlistItem } from '../../db/entities/watchlist.entity';
```

Add `EmailService` and `WatchlistItem` repository to constructor:
```typescript
constructor(
  @InjectRepository(Lot) private readonly lotRepository: Repository<Lot>,
  @InjectRepository(Bid) private readonly bidRepository: Repository<Bid>,
  @InjectRepository(WatchlistItem) private readonly watchlistRepository: Repository<WatchlistItem>,
  private readonly dataSource: DataSource,
  private readonly auctionGateway: AuctionGateway,
  private readonly balanceService: BalanceService,
  private readonly emailService: EmailService,
) {}
```

In `handleAuctionStart()`, after `this.auctionGateway.server?.to('feed:global').emit(...)`, add:
```typescript
// Send AUCTION_STARTING emails to users who watchlisted this lot
const watchers = await this.watchlistRepository.find({ where: { lotId: lot.id } });
for (const watcher of watchers) {
  this.emailService.sendToUser(watcher.userId, EmailEventType.AUCTION_STARTING, {
    lotTitle: lot.title || `Лот #${lot.id.slice(0, 8)}`,
    auctionStartTime: lot.auctionStartAt?.toLocaleString('ru-RU') || '',
    lotLink: `${process.env.CLIENT_URL}/catalog/${lot.id}`,
  }).catch(() => {});
}
```

In `processAuctionEnd()`, after `this.auctionGateway.emitAuctionEnded(lot.id, winningBid.userId, finalPrice)` (in the winner block), add:
```typescript
this.emailService.sendToUser(winningBid.userId, EmailEventType.AUCTION_WON, {
  lotTitle: lockedLot.title || `Лот #${lot.id.slice(0, 8)}`,
  finalPrice: `${finalPrice}`,
}).catch(() => {});
```

- [ ] **Step 2: Update AuctionModule**

Open `api/src/modules/auction/auction.module.ts`. Add:
```typescript
import { WatchlistItem } from '../../db/entities/watchlist.entity';
import { EmailModule } from '../email/email.module';

// Add WatchlistItem to TypeOrmModule.forFeature([...])
// Add EmailModule to imports array
```

- [ ] **Step 3: Verify and commit**

```bash
cd api && npx tsc --noEmit
git add api/src/modules/auction/
git commit -m "feat(email): wire AUCTION_WON and AUCTION_STARTING emails into scheduler"
```

---

## Task 11: Wire email into OrderService and BalanceService

**Files:**
- Modify: `api/src/modules/order/order.service.ts`
- Modify: `api/src/modules/order/order.module.ts`
- Modify: `api/src/modules/balance/balance.service.ts`
- Modify: `api/src/modules/balance/balance.module.ts`

- [ ] **Step 1: Add email to OrderService**

Open `api/src/modules/order/order.service.ts`.

Add import:
```typescript
import { EmailService } from '../email/email.service';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
```

Add `EmailService` to constructor:
```typescript
constructor(
  @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
  @InjectRepository(OrderStatusHistory) private readonly historyRepository: Repository<OrderStatusHistory>,
  private readonly dataSource: DataSource,
  private readonly notificationService: NotificationService,
  private readonly emailService: EmailService,
) {}
```

In `updateStatus()`, the existing code already computes `const label = ORDER_STATUS_LABELS[status]` and `const lotTitle = ...`. After the existing `this.notificationService.create(...).catch(() => {})` call, reuse `label`:
```typescript
this.emailService.sendToUser(updatedOrder.userId, EmailEventType.ORDER_STATUS_CHANGED, {
  orderId: orderId.slice(0, 8).toUpperCase(),
  statusLabel: label,
}).catch(() => {});
```

- [ ] **Step 2: Update OrderModule**

Open `api/src/modules/order/order.module.ts`. Add `EmailModule` to imports.

- [ ] **Step 3: Add email to BalanceService**

Open `api/src/modules/balance/balance.service.ts`.

Add import:
```typescript
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; // already imported via DataSource
import { User } from '../../db/entities/user.entity';
import { EmailService } from '../email/email.service';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
import { BalanceTransactionType } from '../../common/enums/balance-transaction-type.enum';
```

Add to constructor:
```typescript
constructor(
  @InjectRepository(BalanceTransaction) private readonly transactionRepository: Repository<BalanceTransaction>,
  @InjectRepository(User) private readonly userRepository: Repository<User>,
  private readonly dataSource: DataSource,
  private readonly emailService: EmailService,
) {}
```

In `adjustBalance()`, the method has a `try/catch/finally` block. `commitTransaction()` is called inside `try`, followed immediately by `return saved`. You must capture `saved` before committing, then add the email call after commit but before return. Replace the end of the `try` block:

```typescript
      const saved = await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();

      // Fire-and-forget email notification (outside transaction)
      const user = await this.userRepository.findOneBy({ id: userId });
      if (user) {
        const eventType = amount > 0 ? EmailEventType.BALANCE_TOPPED_UP : EmailEventType.BALANCE_WITHDRAWN;
        this.emailService.send(eventType, user.email, user.preferredLanguage, {
          firstName: user.firstName,
          amount: Math.abs(amount).toString(),
          currency: 'EUR',
          newBalance: balanceAfter.toString(),
        }).catch(() => {});
      }

      return saved;
```

- [ ] **Step 4: Update BalanceModule**

Open `api/src/modules/balance/balance.module.ts`. Add:
```typescript
import { User } from '../../db/entities/user.entity';
import { EmailModule } from '../email/email.module';

// Add User to TypeOrmModule.forFeature([...])
// Add EmailModule to imports array
```

- [ ] **Step 5: Verify and commit**

```bash
cd api && npx tsc --noEmit
git add api/src/modules/order/ api/src/modules/balance/
git commit -m "feat(email): wire ORDER_STATUS_CHANGED and BALANCE emails into services"
```

---

## Task 12: Wire CUSTOM email into NotificationService

**Files:**
- Modify: `api/src/modules/notification/notification.service.ts`
- Modify: `api/src/modules/notification/notification.module.ts`

- [ ] **Step 1: Update NotificationService**

Open `api/src/modules/notification/notification.service.ts`.

Add imports:
```typescript
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../db/entities/user.entity';
import { EmailService } from '../email/email.service';
import { EmailEventType } from '../../common/enums/email-event-type.enum';
```

Add to constructor:
```typescript
constructor(
  @InjectRepository(Notification) private readonly notificationRepository: Repository<Notification>,
  @InjectRepository(User) private readonly userRepository: Repository<User>,
  private readonly emailService: EmailService,
) {}
```

Replace the body of `sendCustomEmail()` with:
```typescript
async sendCustomEmail(userId: string, subject: string, message: string): Promise<Notification> {
  this.logger.log(
    `[CustomEmail] to=${userId} subject="${subject}" message="${message.slice(0, 80)}..."`,
  );

  const user = await this.userRepository.findOneBy({ id: userId });
  if (user) {
    this.emailService.send(EmailEventType.CUSTOM, user.email, user.preferredLanguage, {
      firstName: user.firstName,
      subject,
      message,
    }).catch(() => {});
  }

  return this.create({
    userId,
    type: NotificationType.CUSTOM_EMAIL,
    title: subject,
    message,
    data: { channel: 'email' },
  });
}
```

- [ ] **Step 2: Update NotificationModule**

Open `api/src/modules/notification/notification.module.ts`. Add:
```typescript
import { User } from '../../db/entities/user.entity';
import { EmailModule } from '../email/email.module';

// Add User to TypeOrmModule.forFeature([...])
// Add EmailModule to imports array
// Do NOT re-export EmailModule from NotificationModule
```

- [ ] **Step 3: Verify and commit**

```bash
cd api && npx tsc --noEmit
git add api/src/modules/notification/
git commit -m "feat(email): wire CUSTOM email into NotificationService.sendCustomEmail"
```

---

## Task 13: Admin — EmailService + email-templates page

**Files:**
- Create: `admin/src/app/core/services/email.service.ts`
- Create: `admin/src/app/pages/email-templates/email-templates.component.ts`
- Create: `admin/src/app/pages/email-templates/email-templates.component.html`
- Create: `admin/src/app/pages/email-templates/email-templates.component.scss`
- Modify: `admin/src/app/core/services/api.service.ts`
- Modify: `admin/src/app/app.routes.ts`
- Modify: `admin/src/app/layout/admin-layout/admin-layout.ts`

- [ ] **Step 1: Add `put` and `delete` methods to ApiService**

Open `admin/src/app/core/services/api.service.ts`. Add after the `patch` method:

```typescript
put<T>(path: string, body: unknown = {}): Observable<T> {
  return this.http.put<T>(`${this.baseUrl}${path}`, body);
}
```

(The `delete` method already exists.)

- [ ] **Step 2: Create admin EmailService**

Create `admin/src/app/core/services/email.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface EmailSetting {
  eventType: string;
  isEnabled: boolean;
}

export interface EmailTemplate {
  id: string;
  eventType: string;
  language: string;
  subject: string;
  bodyHtml: string;
}

export const EVENT_LABELS: Record<string, string> = {
  EMAIL_VERIFICATION: 'Подтверждение email',
  PASSWORD_RESET: 'Сброс пароля',
  AUCTION_WON: 'Победа в аукционе',
  AUCTION_STARTING: 'Аукцион начинается',
  ORDER_STATUS_CHANGED: 'Изменение статуса заказа',
  BALANCE_TOPPED_UP: 'Пополнение баланса',
  BALANCE_WITHDRAWN: 'Списание баланса',
  CUSTOM: 'Кастомное письмо',
};

export const EVENT_VARIABLES: Record<string, string[]> = {
  EMAIL_VERIFICATION: ['firstName', 'verificationLink'],
  PASSWORD_RESET: ['firstName', 'resetLink'],
  AUCTION_WON: ['firstName', 'lotTitle', 'finalPrice'],
  AUCTION_STARTING: ['firstName', 'lotTitle', 'auctionStartTime', 'lotLink'],
  ORDER_STATUS_CHANGED: ['firstName', 'orderId', 'statusLabel'],
  BALANCE_TOPPED_UP: ['firstName', 'amount', 'currency', 'newBalance'],
  BALANCE_WITHDRAWN: ['firstName', 'amount', 'currency', 'newBalance'],
  CUSTOM: ['firstName', 'subject', 'message'],
};

@Injectable({ providedIn: 'root' })
export class EmailAdminService {
  constructor(private readonly api: ApiService) {}

  getSettings(): Observable<EmailSetting[]> {
    return this.api.get<EmailSetting[]>('/email/settings');
  }

  toggleSetting(eventType: string, isEnabled: boolean): Observable<EmailSetting> {
    return this.api.patch<EmailSetting>(`/email/settings/${eventType}`, { isEnabled });
  }

  getTemplates(eventType: string): Observable<EmailTemplate[]> {
    return this.api.get<EmailTemplate[]>(`/email/templates/${eventType}`);
  }

  upsertTemplate(eventType: string, language: string, subject: string, bodyHtml: string): Observable<EmailTemplate> {
    return this.api.put<EmailTemplate>(`/email/templates/${eventType}/${language}`, { subject, bodyHtml });
  }

  deleteTemplate(eventType: string, language: string): Observable<void> {
    return this.api.delete<void>(`/email/templates/${eventType}/${language}`);
  }

  preview(eventType: string, subject: string, bodyHtml: string): Observable<{ html: string }> {
    return this.api.post<{ html: string }>(`/email/templates/${eventType}/preview`, { subject, bodyHtml });
  }
}
```

- [ ] **Step 3: Create email-templates component TS**

Create `admin/src/app/pages/email-templates/email-templates.component.ts`:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import {
  EmailAdminService,
  EmailSetting,
  EmailTemplate,
  EVENT_LABELS,
  EVENT_VARIABLES,
} from '../../core/services/email.service';

interface EventRow {
  setting: EmailSetting;
  label: string;
  variables: string[];
  expanded: boolean;
  templates: EmailTemplate[];
  activeLanguage: string;
  editSubject: string;
  editBodyHtml: string;
  previewHtml: string | null;
  saving: boolean;
  loadingTemplates: boolean;
}

const AVAILABLE_LANGUAGES = ['ru', 'en', 'ua'];

@Component({
  selector: 'app-email-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSlideToggleModule,
    MatButtonModule,
  ],
  templateUrl: './email-templates.component.html',
  styleUrl: './email-templates.component.scss',
})
export class EmailTemplatesComponent implements OnInit {
  private readonly emailService = inject(EmailAdminService);

  rows: EventRow[] = [];
  availableLanguages = AVAILABLE_LANGUAGES;

  ngOnInit(): void {
    this.emailService.getSettings().subscribe((settings) => {
      this.rows = settings.map((s) => ({
        setting: s,
        label: EVENT_LABELS[s.eventType] ?? s.eventType,
        variables: EVENT_VARIABLES[s.eventType] ?? [],
        expanded: false,
        templates: [],
        activeLanguage: 'ru',
        editSubject: '',
        editBodyHtml: '',
        previewHtml: null,
        saving: false,
        loadingTemplates: false,
      }));
    });
  }

  toggleExpand(row: EventRow): void {
    row.expanded = !row.expanded;
    if (row.expanded && row.templates.length === 0) {
      this.loadTemplates(row);
    }
  }

  loadTemplates(row: EventRow): void {
    row.loadingTemplates = true;
    this.emailService.getTemplates(row.setting.eventType).subscribe({
      next: (templates) => {
        row.templates = templates;
        row.loadingTemplates = false;
        this.switchLanguage(row, row.activeLanguage);
      },
      error: () => { row.loadingTemplates = false; },
    });
  }

  switchLanguage(row: EventRow, lang: string): void {
    row.activeLanguage = lang;
    row.previewHtml = null;
    const tpl = row.templates.find((t) => t.language === lang);
    row.editSubject = tpl?.subject ?? '';
    row.editBodyHtml = tpl?.bodyHtml ?? '';
  }

  hasTemplate(row: EventRow, lang: string): boolean {
    return row.templates.some((t) => t.language === lang);
  }

  onToggle(row: EventRow): void {
    this.emailService.toggleSetting(row.setting.eventType, row.setting.isEnabled).subscribe();
  }

  save(row: EventRow): void {
    row.saving = true;
    this.emailService
      .upsertTemplate(row.setting.eventType, row.activeLanguage, row.editSubject, row.editBodyHtml)
      .subscribe({
        next: (tpl) => {
          const idx = row.templates.findIndex((t) => t.language === row.activeLanguage);
          if (idx >= 0) row.templates[idx] = tpl;
          else row.templates.push(tpl);
          row.saving = false;
        },
        error: () => { row.saving = false; },
      });
  }

  deleteTemplate(row: EventRow): void {
    if (!confirm('Удалить шаблон для этого языка?')) return;
    this.emailService.deleteTemplate(row.setting.eventType, row.activeLanguage).subscribe(() => {
      row.templates = row.templates.filter((t) => t.language !== row.activeLanguage);
      row.editSubject = '';
      row.editBodyHtml = '';
      row.previewHtml = null;
    });
  }

  preview(row: EventRow): void {
    this.emailService
      .preview(row.setting.eventType, row.editSubject, row.editBodyHtml)
      .subscribe((res) => {
        // Store as plain string — bound via [attr.srcdoc] on iframe (not [srcdoc])
        row.previewHtml = res.html;
      });
  }
}
```

- [ ] **Step 4: Create HTML template**

Create `admin/src/app/pages/email-templates/email-templates.component.html`:

```html
<div class="email-templates">
  <h2 class="email-templates__title">Email Templates</h2>

  <div class="email-templates__list">
    @for (row of rows; track row.setting.eventType) {
      <div class="event-row" [class.event-row--expanded]="row.expanded">
        <div class="event-row__header">
          <span class="event-row__label">{{ row.label }}</span>
          <div class="event-row__actions">
            <mat-slide-toggle
              [(ngModel)]="row.setting.isEnabled"
              (change)="onToggle(row)"
            ></mat-slide-toggle>
            <button class="event-row__edit-btn" (click)="toggleExpand(row)">
              {{ row.expanded ? 'Закрыть' : 'Редактировать' }}
            </button>
          </div>
        </div>

        @if (row.expanded) {
          <div class="event-row__editor">
            <div class="lang-tabs">
              @for (lang of availableLanguages; track lang) {
                <button
                  class="lang-tab"
                  [class.lang-tab--active]="row.activeLanguage === lang"
                  [class.lang-tab--missing]="!hasTemplate(row, lang)"
                  (click)="switchLanguage(row, lang)"
                >
                  {{ lang.toUpperCase() }}
                  @if (!hasTemplate(row, lang)) { ⚠ }
                </button>
              }
            </div>

            <div class="editor-fields">
              <label class="editor-label">
                Тема письма
                <input
                  class="editor-input"
                  [(ngModel)]="row.editSubject"
                  placeholder="Тема: {{'{{'}}firstName{{'}}'}}"
                />
              </label>

              <label class="editor-label">
                HTML тело
                <textarea
                  class="editor-textarea"
                  [(ngModel)]="row.editBodyHtml"
                  rows="10"
                  placeholder="<p>Привет, {{'{{'}}firstName{{'}}'}}!</p>"
                ></textarea>
              </label>

              <div class="editor-vars">
                Переменные:
                @for (v of row.variables; track v) {
                  <code class="var-chip">{{'{{'}}{{ v }}{{'}}'}}</code>
                }
              </div>

              <div class="editor-actions">
                <button class="btn btn--secondary" (click)="preview(row)">Предпросмотр</button>
                @if (hasTemplate(row, row.activeLanguage)) {
                  <button class="btn btn--danger" (click)="deleteTemplate(row)">Удалить</button>
                }
                <button class="btn btn--primary" [disabled]="row.saving" (click)="save(row)">
                  {{ row.saving ? 'Сохранение...' : 'Сохранить' }}
                </button>
              </div>

              @if (row.previewHtml) {
                <div class="preview-wrapper">
                  <iframe class="preview-frame" [attr.srcdoc]="row.previewHtml"></iframe>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  </div>
</div>
```

- [ ] **Step 5: Create SCSS**

Create `admin/src/app/pages/email-templates/email-templates.component.scss`:

```scss
.email-templates {
  padding: 24px;

  &__title {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 24px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.event-row {
  border: 1px solid #2a3a4a;
  border-radius: 8px;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: #121e2a;
    cursor: pointer;
  }

  &__label {
    font-weight: 500;
    font-size: 14px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__edit-btn {
    background: transparent;
    border: 1px solid #0066ff;
    color: #0066ff;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;

    &:hover { background: rgba(0, 102, 255, 0.1); }
  }

  &__editor {
    padding: 20px;
    background: #0c1926;
    border-top: 1px solid #2a3a4a;
  }
}

.lang-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.lang-tab {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid #2a3a4a;
  background: transparent;
  color: #fff;
  font-size: 13px;
  cursor: pointer;

  &--active { border-color: #0066ff; background: rgba(0, 102, 255, 0.15); color: #0066ff; }
  &--missing { border-color: #f59e0b; color: #f59e0b; }
}

.editor-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #94a3b8;
}

.editor-input,
.editor-textarea {
  background: #121e2a;
  border: 1px solid #2a3a4a;
  border-radius: 6px;
  color: #fff;
  padding: 10px 12px;
  font-size: 13px;
  font-family: monospace;
  resize: vertical;

  &:focus { outline: none; border-color: #0066ff; }
}

.editor-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: #94a3b8;
}

.var-chip {
  background: #1e2d3d;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  color: #60a5fa;
}

.editor-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;

  &--primary { background: #0066ff; color: #fff; &:hover { background: #0052cc; } }
  &--secondary { background: #1e2d3d; color: #fff; border: 1px solid #2a3a4a; }
  &--danger { background: #ef4444; color: #fff; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.preview-wrapper {
  margin-top: 16px;
  border: 1px solid #2a3a4a;
  border-radius: 6px;
  overflow: hidden;
}

.preview-frame {
  width: 100%;
  height: 500px;
  border: none;
  background: #fff;
}
```

- [ ] **Step 6: Add route and nav item**

Open `admin/src/app/app.routes.ts`. Add inside the children array:
```typescript
{
  path: 'email-templates',
  loadComponent: () =>
    import('./pages/email-templates/email-templates.component').then(
      (m) => m.EmailTemplatesComponent,
    ),
},
```

Open `admin/src/app/layout/admin-layout/admin-layout.ts`. Add to `navItems` array:
```typescript
{ label: 'Email', icon: 'mail', path: '/email-templates' },
```

- [ ] **Step 7: Build admin to check for errors**

```bash
cd admin && npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Application bundle generation complete.`

- [ ] **Step 8: Commit**

```bash
git add admin/src/app/pages/email-templates/ admin/src/app/core/services/email.service.ts admin/src/app/core/services/api.service.ts admin/src/app/app.routes.ts admin/src/app/layout/
git commit -m "feat(admin): add email templates management page"
```

---

## Task 14: Client — /verify-email page

**Files:**
- Create: `client/src/app/pages/auth/verify-email/verify-email.ts`
- Create: `client/src/app/pages/auth/verify-email/verify-email.html`
- Create: `client/src/app/pages/auth/verify-email/verify-email.scss`
- Modify: `client/src/app/app.routes.ts`

- [ ] **Step 1: Create VerifyEmailComponent**

Create `client/src/app/pages/auth/verify-email/verify-email.ts`:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

type State = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  state: State = 'loading';
  resendEmail = '';
  resendSent = false;
  resendError = '';

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state = 'error';
      return;
    }

    try {
      const res = await fetch(`${environment.apiUrl}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        this.state = 'success';
        setTimeout(() => this.router.navigate(['/cabinet']), 3000);
      } else {
        this.state = 'error';
      }
    } catch {
      this.state = 'error';
    }
  }

  async resend(): Promise<void> {
    if (!this.resendEmail) return;
    try {
      await fetch(`${environment.apiUrl}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.resendEmail }),
      });
      this.resendSent = true;
    } catch {
      this.resendError = 'Ошибка при отправке письма.';
    }
  }
}
```

- [ ] **Step 2: Create HTML**

Create `client/src/app/pages/auth/verify-email/verify-email.html`:

```html
<div class="verify-email">
  @if (state === 'loading') {
    <div class="verify-email__box">
      <p>Подтверждаем ваш email...</p>
    </div>
  }

  @if (state === 'success') {
    <div class="verify-email__box verify-email__box--success">
      <div class="verify-email__icon">✓</div>
      <h2>Email подтверждён!</h2>
      <p>Аккаунт активирован. Перенаправляем в личный кабинет...</p>
    </div>
  }

  @if (state === 'error') {
    <div class="verify-email__box verify-email__box--error">
      <h2>Ссылка недействительна</h2>
      <p>Ссылка для подтверждения недействительна или истекла.</p>

      @if (!resendSent) {
        <div class="verify-email__resend">
          <p>Отправить письмо повторно:</p>
          <input
            class="verify-email__input"
            type="email"
            [(ngModel)]="resendEmail"
            placeholder="Введите ваш email"
          />
          <button class="verify-email__btn" (click)="resend()">Отправить</button>
          @if (resendError) { <p class="verify-email__err">{{ resendError }}</p> }
        </div>
      } @else {
        <p class="verify-email__success-msg">Письмо отправлено, проверьте почту.</p>
      }
    </div>
  }
</div>
```

- [ ] **Step 3: Create SCSS**

Create `client/src/app/pages/auth/verify-email/verify-email.scss`:

```scss
.verify-email {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 40px 16px;

  &__box {
    background: #121e2a;
    border: 1px solid #2a3a4a;
    border-radius: 12px;
    padding: 48px 40px;
    text-align: center;
    max-width: 480px;
    width: 100%;

    &--success { border-color: #22c55e; }
    &--error { border-color: #ef4444; }
  }

  &__icon {
    font-size: 48px;
    color: #22c55e;
    margin-bottom: 16px;
  }

  h2 { font-size: 22px; font-weight: 600; margin-bottom: 12px; }
  p { color: #94a3b8; font-size: 14px; }

  &__resend {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }

  &__input {
    width: 100%;
    background: #0c1926;
    border: 1px solid #2a3a4a;
    border-radius: 8px;
    color: #fff;
    padding: 10px 14px;
    font-size: 14px;
    box-sizing: border-box;

    &:focus { outline: none; border-color: #0066ff; }
  }

  &__btn {
    background: #0066ff;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-size: 14px;
    cursor: pointer;
    width: 100%;

    &:hover { background: #0052cc; }
  }

  &__err { color: #ef4444; font-size: 13px; }
  &__success-msg { color: #22c55e; margin-top: 16px; }
}
```

- [ ] **Step 4: Add route**

Open `client/src/app/app.routes.ts`. Add before the `'**'` catch-all:

```typescript
{
  path: 'verify-email',
  loadComponent: () =>
    import('./pages/auth/verify-email/verify-email').then((m) => m.VerifyEmailComponent),
},
```

- [ ] **Step 5: Commit**

```bash
git add client/src/app/pages/auth/verify-email/ client/src/app/app.routes.ts
git commit -m "feat(client): add /verify-email page"
```

---

## Task 15: Client — /reset-password page

**Files:**
- Create: `client/src/app/pages/auth/reset-password/reset-password.ts`
- Create: `client/src/app/pages/auth/reset-password/reset-password.html`
- Create: `client/src/app/pages/auth/reset-password/reset-password.scss`
- Modify: `client/src/app/app.routes.ts`

- [ ] **Step 1: Create ResetPasswordComponent**

Create `client/src/app/pages/auth/reset-password/reset-password.ts`:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  token = '';
  newPassword = '';
  confirmPassword = '';
  isLoading = false;
  tokenInvalid = false;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.tokenInvalid = true;
  }

  async onSubmit(): Promise<void> {
    if (this.newPassword !== this.confirmPassword) {
      this.toastService.error('Пароли не совпадают');
      return;
    }
    if (this.newPassword.length < 8) {
      this.toastService.error('Минимум 8 символов');
      return;
    }

    this.isLoading = true;
    try {
      const res = await fetch(`${environment.apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token, newPassword: this.newPassword }),
      });

      if (res.ok) {
        this.toastService.success('Пароль изменён. Войдите в аккаунт.');
        this.router.navigate(['/login']);
      } else {
        const err = await res.json().catch(() => null);
        this.toastService.error(err?.message || 'Ссылка недействительна или истекла.');
        this.tokenInvalid = true;
      }
    } catch {
      this.toastService.error('Ошибка сети. Попробуйте снова.');
    } finally {
      this.isLoading = false;
    }
  }
}
```

- [ ] **Step 2: Create HTML**

Create `client/src/app/pages/auth/reset-password/reset-password.html`:

```html
<div class="reset-password">
  <div class="reset-password__box">
    @if (tokenInvalid) {
      <h2>Ссылка недействительна</h2>
      <p>Ссылка для сброса пароля устарела или уже была использована.</p>
      <a routerLink="/login" class="reset-password__link">Запросить новую ссылку</a>
    } @else {
      <h2>Новый пароль</h2>
      <div class="reset-password__form">
        <input
          class="reset-password__input"
          type="password"
          [(ngModel)]="newPassword"
          placeholder="Новый пароль (мин. 8 символов)"
        />
        <input
          class="reset-password__input"
          type="password"
          [(ngModel)]="confirmPassword"
          placeholder="Повторите пароль"
        />
        <button
          class="reset-password__btn"
          [disabled]="isLoading"
          (click)="onSubmit()"
        >
          {{ isLoading ? 'Сохранение...' : 'Сохранить пароль' }}
        </button>
      </div>
    }
  </div>
</div>
```

- [ ] **Step 3: Create SCSS**

Create `client/src/app/pages/auth/reset-password/reset-password.scss`:

```scss
.reset-password {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 40px 16px;

  &__box {
    background: #121e2a;
    border: 1px solid #2a3a4a;
    border-radius: 12px;
    padding: 48px 40px;
    text-align: center;
    max-width: 440px;
    width: 100%;

    h2 { font-size: 22px; font-weight: 600; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 14px; margin-bottom: 20px; }
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 24px;
  }

  &__input {
    background: #0c1926;
    border: 1px solid #2a3a4a;
    border-radius: 8px;
    color: #fff;
    padding: 12px 14px;
    font-size: 14px;
    box-sizing: border-box;
    width: 100%;

    &:focus { outline: none; border-color: #0066ff; }
  }

  &__btn {
    background: #0066ff;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    width: 100%;
    margin-top: 4px;

    &:hover { background: #0052cc; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  &__link {
    color: #0066ff;
    text-decoration: none;
    font-size: 14px;
    &:hover { text-decoration: underline; }
  }
}
```

- [ ] **Step 4: Add route**

Open `client/src/app/app.routes.ts`. Add:

```typescript
{
  path: 'reset-password',
  loadComponent: () =>
    import('./pages/auth/reset-password/reset-password').then((m) => m.ResetPasswordComponent),
},
```

- [ ] **Step 5: Commit**

```bash
git add client/src/app/pages/auth/reset-password/ client/src/app/app.routes.ts
git commit -m "feat(client): add /reset-password page"
```

---

## Task 16: Client — login page modifications

**Files:**
- Modify: `client/src/app/pages/auth/login/login.ts`
- Modify: `client/src/app/pages/auth/login/login.html`

- [ ] **Step 1: Update LoginComponent**

Open `client/src/app/pages/auth/login/login.ts`. Read the full file first.

Add new state properties and methods:
```typescript
// Forgot password state
showForgotForm = false;
forgotEmail = '';
forgotSent = false;
forgotLoading = false;

// Pending email verification banner
showPendingBanner = false;
pendingEmail = '';
resendSent = false;
```

Update `onLogin()` — replace the `if (!response.ok)` block with:
```typescript
if (!response.ok) {
  const error = await response.json().catch(() => null);
  if (error?.code === 'EMAIL_NOT_VERIFIED') {
    this.showPendingBanner = true;
    this.pendingEmail = this.email;
  } else {
    this.toastService.error(error?.message || this.ls.t('auth.login.error'));
  }
  return;
}
```

Add new methods:
```typescript
async sendForgot(): Promise<void> {
  if (!this.forgotEmail) return;
  this.forgotLoading = true;
  try {
    await fetch(`${environment.apiUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.forgotEmail }),
    });
    this.forgotSent = true;
  } finally {
    this.forgotLoading = false;
  }
}

async resendVerification(): Promise<void> {
  if (!this.pendingEmail) return;
  await fetch(`${environment.apiUrl}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: this.pendingEmail }),
  });
  this.resendSent = true;
}
```

- [ ] **Step 2: Update login HTML**

Open `client/src/app/pages/auth/login/login.html`. Read the file first.

Add the PENDING banner block **before** the main form (or as a sibling overlay):
```html
@if (showPendingBanner) {
  <div class="login__pending-banner">
    <p>Пожалуйста, подтвердите email перед входом.</p>
    @if (!resendSent) {
      <button (click)="resendVerification()">Отправить письмо повторно</button>
    } @else {
      <span>Письмо отправлено!</span>
    }
  </div>
}
```

Add the "Forgot password?" link after the login button:
```html
<button class="login__forgot" type="button" (click)="showForgotForm = !showForgotForm">
  Забыли пароль?
</button>

@if (showForgotForm) {
  <div class="login__forgot-form">
    @if (!forgotSent) {
      <input
        type="email"
        [(ngModel)]="forgotEmail"
        placeholder="Введите ваш email"
        class="login__forgot-input"
      />
      <button (click)="sendForgot()" [disabled]="forgotLoading">
        {{ forgotLoading ? 'Отправка...' : 'Отправить ссылку' }}
      </button>
    } @else {
      <p>Письмо со ссылкой отправлено на {{ forgotEmail }}</p>
    }
  </div>
}
```

Note: Adapt the exact HTML to match the existing login page structure (class names, input/button components). Read the existing `login.html` before editing.

- [ ] **Step 3: Build client to verify**

```bash
cd client && npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
git add client/src/app/pages/auth/login/
git commit -m "feat(client): add forgot-password form and email-not-verified banner to login"
```

---

## Task 17: Add RESEND_API_KEY and CLIENT_URL to environment

- [ ] **Step 1: Add env vars**

Open `api/.env` (or create if missing). Add:

```
RESEND_API_KEY=re_your_api_key_here
CLIENT_URL=https://your-client-domain.com
```

For local development `CLIENT_URL=http://localhost:4200`.

- [ ] **Step 2: Verify API starts without errors**

```bash
cd api && npm run start:dev 2>&1 | head -30
```

Expected: NestJS starts, no import errors.

- [ ] **Step 3: Commit (do NOT commit .env with real keys)**

```bash
# Only commit if .env is in .gitignore (it should be)
git add api/src/ # any remaining TS files not yet committed
git commit -m "feat(email): complete email system implementation"
```

---

## Task 18: Final verification

- [ ] **Verify API compiles cleanly**

```bash
cd api && npx tsc --noEmit
```

- [ ] **Verify admin builds**

```bash
cd admin && npx ng build 2>&1 | tail -5
```

- [ ] **Verify client builds**

```bash
cd client && npx ng build 2>&1 | tail -5
```

- [ ] **Run API tests**

```bash
cd api && npm test 2>&1 | tail -20
```

- [ ] **Final commit**

```bash
git add -A
git status # verify only relevant files staged
git commit -m "feat(email): email system complete — resend, handlebars, admin UI, client pages"
```
