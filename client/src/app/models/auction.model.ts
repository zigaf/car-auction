import { ILot } from './lot.model';

export interface IBid {
  id: string;
  lotId: string;
  userId: string;
  amount: number;
  isPreBid: boolean;
  maxAutoBid: number | null;
  idempotencyKey: string;
  createdAt: string;
  lot?: ILot;
  user?: { id: string; firstName: string; countryFlag: string };
}

export interface IBidUpdate {
  lotId: string;
  amount: number;
  bidderFlag: string;
  timestamp: string;
}

export interface IAuctionExtended {
  lotId: string;
  newEndAt: string;
}

export interface IAuctionEnded {
  lotId: string;
  winnerId: string;
  finalPrice: number;
}

export interface IFeedUpdate {
  lotId: string;
  amount: number;
  bidderFlag: string;
  timestamp: string;
}

export interface IPlaceBidResult {
  bid: IBid;
  auctionExtended: boolean;
  newEndAt: string | null;
}
