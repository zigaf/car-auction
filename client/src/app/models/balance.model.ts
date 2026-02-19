export enum BalanceTransactionType {
  DEPOSIT = 'deposit',
  CAR_PAYMENT = 'car_payment',
  COMMISSION = 'commission',
  DELIVERY = 'delivery',
  CUSTOMS = 'customs',
  REFUND = 'refund',
}

export interface IBalanceResponse {
  balance: number;
}

export interface IBalanceTransaction {
  id: string;
  userId: string;
  type: BalanceTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  orderId: string | null;
  createdBy: string | null;
  createdAt: string;
}
