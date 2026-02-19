export enum OrderStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  DELIVERED_SVH = 'delivered_svh',
  CUSTOMS = 'customs',
  CLEARED = 'cleared',
  DELIVERING = 'delivering',
  COMPLETED = 'completed',
}

export interface IOrder {
  id: string;
  lotId: string;
  userId: string;
  status: OrderStatus;
  carPrice: number;
  commission: number;
  deliveryCost: number;
  customsCost: number;
  total: number;
  managerComment: string | null;
  createdAt: string;
  updatedAt: string;
  lot?: { id: string; title: string; brand: string; model: string; year: number };
}

export interface IOrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  comment: string | null;
  changedBy: string;
  createdAt: string;
  estimatedDate: string | null;
}
