import { ILot } from './lot.model';

export interface IFavorite {
  userId: string;
  lotId: string;
  lot: ILot;
  createdAt: string;
}
