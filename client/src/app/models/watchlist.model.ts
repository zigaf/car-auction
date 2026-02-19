import { ILot } from './lot.model';

export interface IWatchlistItem {
  id: string;
  userId: string;
  lotId: string | null;
  lot: ILot | null;
  brand: string | null;
  model: string | null;
  createdAt: string;
}

export interface IAddWatchlistItem {
  lotId?: string;
  brand?: string;
  model?: string;
}
