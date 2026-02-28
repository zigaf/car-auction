import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuctionService } from './auction.service';
import { Bid } from '../../db/entities/bid.entity';
import { Lot } from '../../db/entities/lot.entity';
import { LotStatus } from '../../common/enums/lot-status.enum';
import { BalanceService } from '../balance/balance.service';
import { NotificationService } from '../notification/notification.service';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeBid(overrides: Partial<Bid> = {}): Bid {
  const bid = new Bid();
  bid.id = 'bid-uuid-1';
  bid.lotId = 'lot-uuid-1';
  bid.userId = 'user-uuid-1';
  bid.amount = 2000;
  bid.isPreBid = false;
  bid.idempotencyKey = 'key-1';
  bid.createdAt = new Date();
  return Object.assign(bid, overrides);
}

function makeLot(overrides: Partial<Lot> = {}): Lot {
  const lot = new Lot();
  lot.id = 'lot-uuid-1';
  lot.status = LotStatus.TRADING;
  lot.currentPrice = 2000;
  lot.startingBid = 1000;
  lot.bidStep = 100;
  lot.auctionEndAt = new Date(Date.now() + 10 * 60_000);
  lot.isPaused = false;
  return Object.assign(lot, overrides);
}

// ─── mock manager factory ────────────────────────────────────────────────────
// Builds a chainable QueryBuilder mock used inside dataSource.transaction callbacks.

function makeQb(result: unknown = null) {
  const qb: Record<string, jest.Mock> = {
    setLock: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    select: jest.fn(),
    getOne: jest.fn().mockResolvedValue(result),
    getRawOne: jest.fn().mockResolvedValue(null),
  };
  // Make every method return `qb` itself for chaining
  Object.keys(qb).forEach((k) => {
    if (k !== 'getOne' && k !== 'getRawOne') {
      qb[k].mockReturnValue(qb);
    }
  });
  return qb;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('AuctionService — rollbackBid()', () => {
  let service: AuctionService;
  let mockUnlockBalance: jest.Mock;

  // We set up the dataSource mock per test so each test can control
  // what the EntityManager returns.
  function buildModule(txImpl: (cb: (manager: unknown) => Promise<unknown>) => Promise<unknown>) {
    return Test.createTestingModule({
      providers: [
        AuctionService,
        { provide: getRepositoryToken(Bid), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Lot), useValue: { findOne: jest.fn(), find: jest.fn() } },
        { provide: DataSource, useValue: { transaction: txImpl } },
        {
          provide: BalanceService,
          useValue: { unlockBalanceForBid: (mockUnlockBalance = jest.fn().mockResolvedValue(undefined)) },
        },
        { provide: NotificationService, useValue: { create: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
  }

  afterEach(() => jest.clearAllMocks());

  // ── NotFoundException: bid missing ────────────────────────────────────────

  it('throws NotFoundException when bid is not found', async () => {
    const module: TestingModule = await buildModule(async (cb) => {
      const manager = {
        findOne: jest.fn().mockResolvedValue(null), // bid not found
        createQueryBuilder: jest.fn().mockReturnValue(makeQb(null)),
        delete: jest.fn(),
        save: jest.fn(),
      };
      return cb(manager);
    });
    service = module.get(AuctionService);

    await expect(service.rollbackBid('missing-bid')).rejects.toThrow(NotFoundException);
  });

  // ── NotFoundException: lot missing ────────────────────────────────────────

  it('throws NotFoundException when lot is not found', async () => {
    const bid = makeBid();
    const module: TestingModule = await buildModule(async (cb) => {
      const lotQb = makeQb(null); // lot query returns null
      const manager = {
        findOne: jest.fn()
          .mockResolvedValueOnce(bid) // first call returns bid
          .mockResolvedValue(null),
        createQueryBuilder: jest.fn().mockReturnValue(lotQb),
        delete: jest.fn(),
        save: jest.fn(),
      };
      return cb(manager);
    });
    service = module.get(AuctionService);

    await expect(service.rollbackBid('bid-uuid-1')).rejects.toThrow(NotFoundException);
  });

  // ── BadRequestException: lot not TRADING ─────────────────────────────────

  it('throws BadRequestException when lot is not in TRADING status', async () => {
    const bid = makeBid();
    const lot = makeLot({ status: LotStatus.SOLD });
    const module: TestingModule = await buildModule(async (cb) => {
      const lotQb = makeQb(lot);
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(bid),
        createQueryBuilder: jest.fn().mockReturnValue(lotQb),
        delete: jest.fn(),
        save: jest.fn(),
      };
      return cb(manager);
    });
    service = module.get(AuctionService);

    await expect(service.rollbackBid('bid-uuid-1')).rejects.toThrow(BadRequestException);
  });

  // ── BadRequestException: not the highest bid ──────────────────────────────

  it('throws BadRequestException when bid is not the current highest bid', async () => {
    const bid = makeBid({ id: 'bid-uuid-2', amount: 1500 });
    const lot = makeLot();
    const highestBid = makeBid({ id: 'bid-uuid-highest', amount: 2000 }); // different ID

    const module: TestingModule = await buildModule(async (cb) => {
      let qbCallCount = 0;
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(bid),
        createQueryBuilder: jest.fn().mockImplementation(() => {
          qbCallCount++;
          if (qbCallCount === 1) return makeQb(lot);         // lock lot query
          if (qbCallCount === 2) return makeQb(highestBid);  // highest bid query
          return makeQb(null);
        }),
        delete: jest.fn(),
        save: jest.fn(),
      };
      return cb(manager);
    });
    service = module.get(AuctionService);

    await expect(service.rollbackBid('bid-uuid-2')).rejects.toThrow(BadRequestException);
  });

  // ── success: deletes bid, updates price to previous highest ──────────────

  it('deletes bid, unlocks balance, and sets lot.currentPrice to previous highest bid amount', async () => {
    const bid = makeBid({ id: 'bid-uuid-1', amount: 2000 });
    const lot = makeLot({ currentPrice: 2000, startingBid: 1000 });
    const previousBid = makeBid({ id: 'bid-uuid-prev', amount: 1500 });

    let qbCallCount = 0;
    const saveMock = jest.fn().mockImplementation((_, l: Lot) => Promise.resolve(l));
    const deleteMock = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await buildModule(async (cb) => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(bid),
        createQueryBuilder: jest.fn().mockImplementation(() => {
          qbCallCount++;
          if (qbCallCount === 1) return makeQb(lot);         // lock lot
          if (qbCallCount === 2) return makeQb(bid);         // highest bid check (same ID → ok)
          if (qbCallCount === 3) return makeQb(previousBid); // new highest after delete
          return makeQb(null);
        }),
        delete: deleteMock,
        save: saveMock,
      };
      return cb(manager);
    });
    service = module.get(AuctionService);

    const result = await service.rollbackBid('bid-uuid-1');

    // Balance should be unlocked for the rolled-back bidder
    expect(mockUnlockBalance).toHaveBeenCalledWith(expect.anything(), bid.userId, lot.id);
    // Bid should be deleted
    expect(deleteMock).toHaveBeenCalledWith(Bid, { id: bid.id });
    // Lot price updated to previous highest bid
    expect(result.newCurrentPrice).toBe(1500);
    expect(result.lotId).toBe(lot.id);
  });

  // ── success: no remaining bids → price falls back to startingBid ──────────

  it('resets lot.currentPrice to startingBid when no bids remain after rollback', async () => {
    const bid = makeBid({ amount: 2000 });
    const lot = makeLot({ currentPrice: 2000, startingBid: 1000 });

    let qbCallCount = 0;
    const saveMock = jest.fn().mockImplementation((_, l: Lot) => Promise.resolve(l));

    const module: TestingModule = await buildModule(async (cb) => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(bid),
        createQueryBuilder: jest.fn().mockImplementation(() => {
          qbCallCount++;
          if (qbCallCount === 1) return makeQb(lot);  // lock lot
          if (qbCallCount === 2) return makeQb(bid);  // highest bid check
          if (qbCallCount === 3) return makeQb(null); // no remaining bids
          return makeQb(null);
        }),
        delete: jest.fn().mockResolvedValue(undefined),
        save: saveMock,
      };
      return cb(manager);
    });
    service = module.get(AuctionService);

    const result = await service.rollbackBid('bid-uuid-1');

    expect(result.newCurrentPrice).toBe(1000); // falls back to startingBid
  });

  // ── success: startingBid is 0 when lot has no startingBid ────────────────

  it('falls back to 0 when lot has no startingBid and no remaining bids', async () => {
    const bid = makeBid({ amount: 500 });
    const lot = makeLot({ currentPrice: 500, startingBid: undefined as any });

    let qbCallCount = 0;

    const module: TestingModule = await buildModule(async (cb) => {
      const manager = {
        findOne: jest.fn().mockResolvedValueOnce(bid),
        createQueryBuilder: jest.fn().mockImplementation(() => {
          qbCallCount++;
          if (qbCallCount === 1) return makeQb(lot);
          if (qbCallCount === 2) return makeQb(bid);
          return makeQb(null); // no remaining bids
        }),
        delete: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockImplementation((_, l: Lot) => Promise.resolve(l)),
      };
      return cb(manager);
    });
    service = module.get(AuctionService);

    const result = await service.rollbackBid('bid-uuid-1');

    expect(result.newCurrentPrice).toBe(0);
  });
});

// ─── getBidsByLot ────────────────────────────────────────────────────────────

describe('AuctionService — getBidsByLot()', () => {
  let service: AuctionService;
  let mockBidRepo: { findOne: jest.Mock; findAndCount: jest.Mock; createQueryBuilder: jest.Mock };
  let mockLotRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    mockBidRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockLotRepo = { findOne: jest.fn() };

    const qb = makeQb({ count: '3' });
    mockBidRepo.createQueryBuilder.mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        { provide: getRepositoryToken(Bid), useValue: mockBidRepo },
        { provide: getRepositoryToken(Lot), useValue: mockLotRepo },
        { provide: DataSource, useValue: {} },
        { provide: BalanceService, useValue: {} },
        { provide: NotificationService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuctionService);
  });

  it('throws NotFoundException when lot does not exist', async () => {
    mockLotRepo.findOne.mockResolvedValue(null);
    await expect(service.getBidsByLot('missing-lot')).rejects.toThrow(NotFoundException);
  });

  it('returns paginated bid data for a valid lot', async () => {
    const lot = makeLot();
    const bids = [makeBid({ amount: 2000 }), makeBid({ id: 'bid-2', amount: 1900 })];
    mockLotRepo.findOne.mockResolvedValue(lot);
    mockBidRepo.findAndCount.mockResolvedValue([bids, 2]);

    const result = await service.getBidsByLot('lot-uuid-1', 1, 20);

    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].amount).toBe(2000);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});
