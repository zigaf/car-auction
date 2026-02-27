import { ILot } from './lot.model';

export interface IBid {
  id: string;
  lotId: string;
  userId?: string;
  amount: number;
  isPreBid: boolean;
  maxAutoBid: number | null;
  idempotencyKey?: string;
  createdAt: string;
  /** Present in getBidsByLot responses (anonymized: "bidder-xxxx") */
  bidderFlag?: string;
  lot?: ILot;
  user?: { id: string; firstName: string; countryFlag: string };
}

export interface IBidUpdate {
  lotId: string;
  amount: number;
  bidderFlag: string;
  /** Raw userId — used client-side only to detect "is my bid" / winning status */
  userId?: string;
  /** True when this bid was placed automatically by the pre-bid engine */
  isAutoBid?: boolean;
  lotTitle?: string;
  timestamp: string;
}

export interface IAuctionExtended {
  lotId: string;
  newEndAt: string;
}

export interface IAuctionEnded {
  lotId: string;
  winnerId: string | null;
  finalPrice: number;
}

export interface IFeedUpdate {
  lotId: string;
  amount: number;
  bidderFlag: string;
  userId?: string;
  isAutoBid?: boolean;
  lotTitle?: string;
  timestamp: string;
}

export interface IPlaceBidResult {
  bid: IBid;
  auctionExtended: boolean;
  newEndAt: string | null;
}

export interface IWatcherCount {
  lotId: string;
  count: number;
}
