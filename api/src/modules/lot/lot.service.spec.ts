import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LotService } from './lot.service';
import { Lot } from '../../db/entities/lot.entity';
import { LotImage } from '../../db/entities/lot-image.entity';
import { LotStatus } from '../../common/enums/lot-status.enum';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeLot(overrides: Partial<Lot> = {}): Lot {
  const lot = new Lot();
  lot.id = 'lot-uuid-1';
  lot.status = LotStatus.TRADING;
  lot.isPaused = false;
  lot.pausedRemainingMs = null;
  lot.auctionEndAt = new Date(Date.now() + 10 * 60_000); // 10 min from now
  lot.startingBid = 1000;
  lot.images = [];
  return Object.assign(lot, overrides);
}

type MockRepo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function makeMockRepo<T>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
  };
}

// ─── suite ──────────────────────────────────────────────────────────────────

describe('LotService — auction timer controls', () => {
  let service: LotService;
  let lotRepo: MockRepo<Lot>;

  beforeEach(async () => {
    lotRepo = makeMockRepo<Lot>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotService,
        { provide: getRepositoryToken(Lot), useValue: lotRepo },
        { provide: getRepositoryToken(LotImage), useValue: makeMockRepo<LotImage>() },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get(LotService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── pauseAuction ──────────────────────────────────────────────────────────

  describe('pauseAuction()', () => {
    it('throws NotFoundException when lot does not exist', async () => {
      lotRepo.findOne!.mockResolvedValue(null);
      await expect(service.pauseAuction('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when lot is not TRADING', async () => {
      lotRepo.findOne!.mockResolvedValue(makeLot({ status: LotStatus.ACTIVE }));
      await expect(service.pauseAuction('lot-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when auction is already paused', async () => {
      lotRepo.findOne!.mockResolvedValue(makeLot({ isPaused: true }));
      await expect(service.pauseAuction('lot-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when lot has no auctionEndAt', async () => {
      lotRepo.findOne!.mockResolvedValue(makeLot({ auctionEndAt: undefined as any }));
      await expect(service.pauseAuction('lot-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('sets isPaused=true and stores positive pausedRemainingMs', async () => {
      const endAt = new Date(Date.now() + 5 * 60_000); // 5 minutes left
      const lot = makeLot({ auctionEndAt: endAt });
      lotRepo.findOne!.mockResolvedValue(lot);
      lotRepo.save!.mockImplementation((l: Lot) => Promise.resolve(l));

      await service.pauseAuction('lot-uuid-1');

      expect(lotRepo.save).toHaveBeenCalledTimes(1);
      const saved: Lot = lotRepo.save!.mock.calls[0][0];
      expect(saved.isPaused).toBe(true);
      expect(saved.pausedRemainingMs).toBeGreaterThan(0);
      expect(saved.pausedRemainingMs).toBeLessThanOrEqual(5 * 60_000);
    });

    it('stores 0 pausedRemainingMs when end time is already in the past', async () => {
      const lot = makeLot({ auctionEndAt: new Date(Date.now() - 1000) });
      lotRepo.findOne!.mockResolvedValue(lot);
      lotRepo.save!.mockImplementation((l: Lot) => Promise.resolve(l));

      await service.pauseAuction('lot-uuid-1');

      const saved: Lot = lotRepo.save!.mock.calls[0][0];
      expect(saved.pausedRemainingMs).toBe(0);
    });
  });

  // ── resumeAuction ─────────────────────────────────────────────────────────

  describe('resumeAuction()', () => {
    it('throws NotFoundException when lot does not exist', async () => {
      lotRepo.findOne!.mockResolvedValue(null);
      await expect(service.resumeAuction('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when lot is not paused', async () => {
      lotRepo.findOne!.mockResolvedValue(makeLot({ isPaused: false }));
      await expect(service.resumeAuction('lot-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('sets isPaused=false and clears pausedRemainingMs', async () => {
      const remainingMs = 3 * 60_000;
      const lot = makeLot({ isPaused: true, pausedRemainingMs: remainingMs });
      lotRepo.findOne!.mockResolvedValue(lot);
      lotRepo.save!.mockImplementation((l: Lot) => Promise.resolve(l));

      await service.resumeAuction('lot-uuid-1');

      const saved: Lot = lotRepo.save!.mock.calls[0][0];
      expect(saved.isPaused).toBe(false);
      expect(saved.pausedRemainingMs).toBeNull();
    });

    it('calculates new auctionEndAt ≈ now + pausedRemainingMs', async () => {
      const remainingMs = 3 * 60_000;
      const lot = makeLot({ isPaused: true, pausedRemainingMs: remainingMs });
      lotRepo.findOne!.mockResolvedValue(lot);
      lotRepo.save!.mockImplementation((l: Lot) => Promise.resolve(l));

      const before = Date.now();
      await service.resumeAuction('lot-uuid-1');
      const after = Date.now();

      const saved: Lot = lotRepo.save!.mock.calls[0][0];
      const newEnd = saved.auctionEndAt!.getTime();
      expect(newEnd).toBeGreaterThanOrEqual(before + remainingMs - 50);
      expect(newEnd).toBeLessThanOrEqual(after + remainingMs + 50);
    });
  });

  // ── extendAuction ─────────────────────────────────────────────────────────

  describe('extendAuction()', () => {
    it('throws NotFoundException when lot does not exist', async () => {
      lotRepo.findOne!.mockResolvedValue(null);
      await expect(service.extendAuction('missing-id', 5)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when lot is not TRADING', async () => {
      lotRepo.findOne!.mockResolvedValue(makeLot({ status: LotStatus.SOLD }));
      await expect(service.extendAuction('lot-uuid-1', 5)).rejects.toThrow(BadRequestException);
    });

    it('adjusts pausedRemainingMs when lot is paused', async () => {
      const initialRemaining = 2 * 60_000;
      const lot = makeLot({ isPaused: true, pausedRemainingMs: initialRemaining });
      lotRepo.findOne!.mockResolvedValue(lot);
      lotRepo.save!.mockImplementation((l: Lot) => Promise.resolve(l));

      await service.extendAuction('lot-uuid-1', 3);

      const saved: Lot = lotRepo.save!.mock.calls[0][0];
      expect(saved.pausedRemainingMs).toBe(initialRemaining + 3 * 60_000);
    });

    it('subtracts from pausedRemainingMs when minutes is negative (paused lot)', async () => {
      const initialRemaining = 5 * 60_000;
      const lot = makeLot({ isPaused: true, pausedRemainingMs: initialRemaining });
      lotRepo.findOne!.mockResolvedValue(lot);
      lotRepo.save!.mockImplementation((l: Lot) => Promise.resolve(l));

      await service.extendAuction('lot-uuid-1', -2);

      const saved: Lot = lotRepo.save!.mock.calls[0][0];
      expect(saved.pausedRemainingMs).toBe(initialRemaining - 2 * 60_000);
    });

    it('clamps pausedRemainingMs to 0 when subtracting more than remaining (paused lot)', async () => {
      const lot = makeLot({ isPaused: true, pausedRemainingMs: 1 * 60_000 });
      lotRepo.findOne!.mockResolvedValue(lot);
      lotRepo.save!.mockImplementation((l: Lot) => Promise.resolve(l));

      await service.extendAuction('lot-uuid-1', -10);

      const saved: Lot = lotRepo.save!.mock.calls[0][0];
      expect(saved.pausedRemainingMs).toBe(0);
    });

    it('adjusts auctionEndAt when lot is active (not paused)', async () => {
      const endAt = new Date(Date.now() + 10 * 60_000);
      const lot = makeLot({ isPaused: false, auctionEndAt: endAt });
      lotRepo.findOne!.mockResolvedValue(lot);
      lotRepo.save!.mockImplementation((l: Lot) => Promise.resolve(l));

      await service.extendAuction('lot-uuid-1', 5);

      const saved: Lot = lotRepo.save!.mock.calls[0][0];
      const expectedEnd = endAt.getTime() + 5 * 60_000;
      expect(saved.auctionEndAt!.getTime()).toBeCloseTo(expectedEnd, -2);
    });
  });
});
