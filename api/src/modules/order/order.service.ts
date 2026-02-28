import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order } from '../../db/entities/order.entity';
import { OrderStatusHistory } from '../../db/entities/order-status-history.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Заказ ожидает подтверждения',
  [OrderStatus.APPROVED]: 'Заказ подтверждён',
  [OrderStatus.PAID]: 'Оплата получена',
  [OrderStatus.DELIVERED_SVH]: 'Автомобиль доставлен на СВХ',
  [OrderStatus.CUSTOMS]: 'Автомобиль на таможне',
  [OrderStatus.CLEARED]: 'Таможня пройдена',
  [OrderStatus.DELIVERING]: 'Автомобиль в пути к вам',
  [OrderStatus.COMPLETED]: 'Заказ завершён',
};

/** Defines the valid order status transitions */
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.APPROVED],
  [OrderStatus.APPROVED]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.DELIVERED_SVH],
  [OrderStatus.DELIVERED_SVH]: [OrderStatus.CUSTOMS],
  [OrderStatus.CUSTOMS]: [OrderStatus.CLEARED],
  [OrderStatus.CLEARED]: [OrderStatus.DELIVERING],
  [OrderStatus.DELIVERING]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
};

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly historyRepository: Repository<OrderStatusHistory>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  async getMyOrders(
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = pagination;

    const [data, total] = await this.orderRepository.findAndCount({
      where: { userId },
      relations: ['lot'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getAllOrders(
    pagination: { page: number; limit: number; status?: string },
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, status } = pagination;

    const [data, total] = await this.orderRepository.findAndCount({
      where: status ? { status: status as OrderStatus } : {},
      relations: ['lot', 'user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getOrderById(
    orderId: string,
    userId?: string,
    isManager?: boolean,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['lot', 'user', 'statusHistory'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!isManager && order.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return order;
  }

  async createOrder(
    lotId: string,
    userId: string,
    carPrice: number,
    commission: number,
  ): Promise<Order> {
    const total = carPrice + commission;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = queryRunner.manager.create(Order, {
        lotId,
        userId,
        carPrice,
        commission,
        deliveryCost: 0,
        customsCost: 0,
        total,
        status: OrderStatus.PENDING,
      });

      const saved = await queryRunner.manager.save(Order, order);

      // Create initial status history entry within the same transaction
      const history = queryRunner.manager.create(OrderStatusHistory, {
        orderId: saved.id,
        status: OrderStatus.PENDING,
        comment: 'Заказ создан',
        changedBy: null,
      });

      await queryRunner.manager.save(OrderStatusHistory, history);

      await queryRunner.commitTransaction();

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(
    orderId: string,
    managerId: string,
    status: OrderStatus,
    comment?: string,
    estimatedDate?: string,
  ): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Validate status transition
      const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[order.status];
      if (!allowedNextStatuses || !allowedNextStatuses.includes(status)) {
        throw new BadRequestException(
          `Invalid status transition from '${order.status}' to '${status}'`,
        );
      }

      order.status = status;
      if (comment) {
        order.managerComment = comment;
      }

      await queryRunner.manager.save(order);

      const history = queryRunner.manager.create(OrderStatusHistory, {
        orderId,
        status,
        comment: comment || null,
        changedBy: managerId,
        estimatedDate: estimatedDate ? new Date(estimatedDate) : null,
      });

      await queryRunner.manager.save(history);

      await queryRunner.commitTransaction();

      const updatedOrder = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['lot', 'user', 'statusHistory'],
      });

      if (updatedOrder) {
        const label = ORDER_STATUS_LABELS[status];
        const lotTitle = updatedOrder.lot?.title || `Заказ #${orderId.slice(0, 8)}`;
        this.notificationService
          .create({
            userId: updatedOrder.userId,
            type: NotificationType.ORDER_STATUS,
            title: 'Статус заказа обновлён',
            message: `«${lotTitle}»: ${label}`,
            data: { orderId, status },
          })
          .catch(() => {});
      }

      return updatedOrder as Order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getOrderTracking(
    orderId: string,
    userId: string,
    isManager: boolean,
  ): Promise<OrderStatusHistory[]> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify ownership: only the order owner or a manager can view tracking
    if (!isManager && order.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.historyRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }
}
