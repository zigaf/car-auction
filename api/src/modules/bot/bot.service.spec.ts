import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BotService } from './bot.service';
import { User } from '../../db/entities/user.entity';
import { AuctionBotConfig, BotPattern } from '../../db/entities/auction-bot-config.entity';
import { Role } from '../../common/enums/role.enum';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeBotUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 'bot-user-uuid';
  user.email = 'bot@test.com';
  user.role = Role.BOT;
  return Object.assign(user, overrides);
}

function makeConfig(overrides: Partial<AuctionBotConfig> = {}): AuctionBotConfig {
  const cfg = new AuctionBotConfig();
  cfg.id = 'cfg-uuid-1';
  cfg.lotId = 'lot-uuid-1';
  cfg.botUserId = 'bot-user-uuid';
  cfg.maxPrice = 5000;
  cfg.pattern = BotPattern.STEADY;
  cfg.isActive = true;
  cfg.minDelaySec = 2;
  cfg.maxDelaySec = 10;
  cfg.intensity = 1.0;
  cfg.startMinutesBeforeEnd = null;
  return Object.assign(cfg, overrides);
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('BotService', () => {
  let service: BotService;
  let userRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let configRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    configRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(AuctionBotConfig), useValue: configRepo },
      ],
    }).compile();

    service = module.get(BotService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createConfig ──────────────────────────────────────────────────────────

  describe('createConfig()', () => {
    it('throws NotFoundException when bot user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createConfig({
          lotId: 'lot-uuid-1',
          botUserId: 'missing-bot',
          maxPrice: 5000,
          pattern: BotPattern.STEADY,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses intensity=1.0 by default when not provided', async () => {
      const botUser = makeBotUser();
      const created = makeConfig();
      userRepo.findOne.mockResolvedValue(botUser);
      configRepo.create.mockReturnValue(created);
      configRepo.save.mockResolvedValue(created);

      await service.createConfig({
        lotId: 'lot-uuid-1',
        botUserId: 'bot-user-uuid',
        maxPrice: 5000,
        pattern: BotPattern.STEADY,
      });

      const createArg = configRepo.create.mock.calls[0][0];
      expect(createArg.intensity).toBe(1.0);
    });

    it('uses provided intensity value', async () => {
      const botUser = makeBotUser();
      const created = makeConfig({ intensity: 2.5 });
      userRepo.findOne.mockResolvedValue(botUser);
      configRepo.create.mockReturnValue(created);
      configRepo.save.mockResolvedValue(created);

      await service.createConfig({
        lotId: 'lot-uuid-1',
        botUserId: 'bot-user-uuid',
        maxPrice: 5000,
        pattern: BotPattern.SNIPER,
        intensity: 2.5,
      });

      const createArg = configRepo.create.mock.calls[0][0];
      expect(createArg.intensity).toBe(2.5);
    });

    it('uses startMinutesBeforeEnd=null by default', async () => {
      const botUser = makeBotUser();
      const created = makeConfig();
      userRepo.findOne.mockResolvedValue(botUser);
      configRepo.create.mockReturnValue(created);
      configRepo.save.mockResolvedValue(created);

      await service.createConfig({
        lotId: 'lot-uuid-1',
        botUserId: 'bot-user-uuid',
        maxPrice: 5000,
        pattern: BotPattern.STEADY,
      });

      const createArg = configRepo.create.mock.calls[0][0];
      expect(createArg.startMinutesBeforeEnd).toBeNull();
    });

    it('uses provided startMinutesBeforeEnd value', async () => {
      const botUser = makeBotUser();
      const created = makeConfig({ startMinutesBeforeEnd: 15 });
      userRepo.findOne.mockResolvedValue(botUser);
      configRepo.create.mockReturnValue(created);
      configRepo.save.mockResolvedValue(created);

      await service.createConfig({
        lotId: 'lot-uuid-1',
        botUserId: 'bot-user-uuid',
        maxPrice: 5000,
        pattern: BotPattern.SNIPER,
        startMinutesBeforeEnd: 15,
      });

      const createArg = configRepo.create.mock.calls[0][0];
      expect(createArg.startMinutesBeforeEnd).toBe(15);
    });

    it('saves and returns the created config', async () => {
      const botUser = makeBotUser();
      const created = makeConfig();
      userRepo.findOne.mockResolvedValue(botUser);
      configRepo.create.mockReturnValue(created);
      configRepo.save.mockResolvedValue(created);

      const result = await service.createConfig({
        lotId: 'lot-uuid-1',
        botUserId: 'bot-user-uuid',
        maxPrice: 5000,
        pattern: BotPattern.STEADY,
      });

      expect(configRepo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });
  });

  // ── updateConfig ──────────────────────────────────────────────────────────

  describe('updateConfig()', () => {
    it('throws NotFoundException when config does not exist', async () => {
      configRepo.findOne.mockResolvedValue(null);
      await expect(service.updateConfig('missing-cfg', {})).rejects.toThrow(NotFoundException);
    });

    it('updates intensity when provided', async () => {
      const cfg = makeConfig({ intensity: 1.0 });
      configRepo.findOne.mockResolvedValue(cfg);
      configRepo.save.mockImplementation((c: AuctionBotConfig) => Promise.resolve(c));

      await service.updateConfig('cfg-uuid-1', { intensity: 3.0 });

      expect(configRepo.save).toHaveBeenCalledWith(expect.objectContaining({ intensity: 3.0 }));
    });

    it('does NOT change intensity when not provided in dto', async () => {
      const cfg = makeConfig({ intensity: 2.0 });
      configRepo.findOne.mockResolvedValue(cfg);
      configRepo.save.mockImplementation((c: AuctionBotConfig) => Promise.resolve(c));

      await service.updateConfig('cfg-uuid-1', { maxPrice: 9000 });

      expect(configRepo.save).toHaveBeenCalledWith(expect.objectContaining({ intensity: 2.0 }));
    });

    it('sets startMinutesBeforeEnd to a value when provided', async () => {
      const cfg = makeConfig({ startMinutesBeforeEnd: null });
      configRepo.findOne.mockResolvedValue(cfg);
      configRepo.save.mockImplementation((c: AuctionBotConfig) => Promise.resolve(c));

      await service.updateConfig('cfg-uuid-1', { startMinutesBeforeEnd: 10 });

      expect(configRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ startMinutesBeforeEnd: 10 }),
      );
    });

    it('sets startMinutesBeforeEnd to null when explicitly set to null', async () => {
      const cfg = makeConfig({ startMinutesBeforeEnd: 15 });
      configRepo.findOne.mockResolvedValue(cfg);
      configRepo.save.mockImplementation((c: AuctionBotConfig) => Promise.resolve(c));

      await service.updateConfig('cfg-uuid-1', { startMinutesBeforeEnd: null });

      expect(configRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ startMinutesBeforeEnd: null }),
      );
    });

    it('does NOT change startMinutesBeforeEnd when key is absent from dto', async () => {
      const cfg = makeConfig({ startMinutesBeforeEnd: 20 });
      configRepo.findOne.mockResolvedValue(cfg);
      configRepo.save.mockImplementation((c: AuctionBotConfig) => Promise.resolve(c));

      // dto has no `startMinutesBeforeEnd` key at all
      await service.updateConfig('cfg-uuid-1', { maxPrice: 7000 });

      expect(configRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ startMinutesBeforeEnd: 20 }),
      );
    });

    it('updates multiple fields at once', async () => {
      const cfg = makeConfig();
      configRepo.findOne.mockResolvedValue(cfg);
      configRepo.save.mockImplementation((c: AuctionBotConfig) => Promise.resolve(c));

      await service.updateConfig('cfg-uuid-1', {
        maxPrice: 8000,
        pattern: BotPattern.AGGRESSIVE,
        intensity: 1.5,
        startMinutesBeforeEnd: 5,
        isActive: false,
      });

      expect(configRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          maxPrice: 8000,
          pattern: BotPattern.AGGRESSIVE,
          intensity: 1.5,
          startMinutesBeforeEnd: 5,
          isActive: false,
        }),
      );
    });
  });

  // ── createBotUser ─────────────────────────────────────────────────────────

  describe('createBotUser()', () => {
    it('throws ConflictException when email is already in use', async () => {
      userRepo.findOne.mockResolvedValue(makeBotUser());
      await expect(
        service.createBotUser({ email: 'bot@test.com', firstName: 'Bot', lastName: 'One' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates and saves a bot user with Role.BOT', async () => {
      const created = makeBotUser();
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(created);
      userRepo.save.mockResolvedValue(created);

      const result = await service.createBotUser({
        email: 'newbot@test.com',
        firstName: 'Bot',
        lastName: 'One',
      });

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.BOT }),
      );
      expect(result).toBe(created);
    });
  });

  // ── removeConfig ──────────────────────────────────────────────────────────

  describe('removeConfig()', () => {
    it('throws NotFoundException when config does not exist', async () => {
      configRepo.findOne.mockResolvedValue(null);
      await expect(service.removeConfig('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes config when found', async () => {
      const cfg = makeConfig();
      configRepo.findOne.mockResolvedValue(cfg);
      configRepo.remove.mockResolvedValue(undefined);

      await service.removeConfig('cfg-uuid-1');
      expect(configRepo.remove).toHaveBeenCalledWith(cfg);
    });
  });
});
