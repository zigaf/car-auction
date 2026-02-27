import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../db/entities/notification.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(dto: CreateNotificationData): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      data: dto.data ?? null,
    });
    return this.notificationRepository.save(notification);
  }

  async getForUser(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ): Promise<PaginatedNotifications> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .skip(skip)
      .take(safeLimit);

    if (unreadOnly) {
      qb.andWhere('n.is_read = false');
    }

    const [data, total] = await qb.getManyAndCount();

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return { data, total, unreadCount, page, limit: safeLimit };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    await this.notificationRepository.delete({ id, userId });
  }

  /**
   * Send a custom email/message to a user from the manager.
   * Creates an in-app notification and logs the email payload
   * (real SMTP delivery can be wired here later).
   */
  async sendCustomEmail(
    userId: string,
    subject: string,
    message: string,
  ): Promise<Notification> {
    this.logger.log(
      `[CustomEmail] to=${userId} subject="${subject}" message="${message.slice(0, 80)}..."`,
    );

    return this.create({
      userId,
      type: NotificationType.CUSTOM_EMAIL,
      title: subject,
      message,
      data: { channel: 'email' },
    });
  }
}
