import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order } from '../../db/entities/order.entity';
import { OrderStatusHistory } from '../../db/entities/order-status-history.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly historyRepository: Repository<OrderStatusHistory>,
    private readonly dataSource: DataSource,
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
    pagination: { page: number; limit: number },
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = pagination;

    const [data, total] = await this.orderRepository.findAndCount({
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

    const order = this.orderRepository.create({
      lotId,
      userId,
      carPrice,
      commission,
      deliveryCost: 0,
      customsCost: 0,
      total,
      status: OrderStatus.PENDING,
    });

    const saved = await this.orderRepository.save(order);

    // Create initial status history entry
    const history = this.historyRepository.create({
      orderId: saved.id,
      status: OrderStatus.PENDING,
      comment: 'Заказ создан',
      changedBy: null,
    });

    await this.historyRepository.save(history);

    return saved;
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

      return this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['lot', 'user', 'statusHistory'],
      }) as Promise<Order>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getOrderTracking(
    orderId: string,
  ): Promise<OrderStatusHistory[]> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.historyRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }
}
