import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../db/entities/document.entity';
import { DocumentStatus } from '../../common/enums/document-status.enum';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../common/enums/notification-type.enum';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly notificationService: NotificationService,
  ) {}

  async getUserDocuments(
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<{
    data: Document[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = pagination;

    const [data, total] = await this.documentRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async uploadDocument(
    userId: string,
    dto: UploadDocumentDto,
  ): Promise<Document> {
    const document = this.documentRepository.create({
      userId,
      type: dto.type,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      orderId: dto.orderId || null,
      uploadedBy: userId,
      status: DocumentStatus.PENDING,
    });

    return this.documentRepository.save(document);
  }

  async getDocument(id: string, userId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return document;
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    managerId: string,
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.status = status;
    const saved = await this.documentRepository.save(document);

    if (status === DocumentStatus.APPROVED || status === DocumentStatus.REJECTED) {
      const isApproved = status === DocumentStatus.APPROVED;
      this.notificationService
        .create({
          userId: document.userId,
          type: NotificationType.DOCUMENT,
          title: isApproved ? 'Документ одобрен' : 'Документ отклонён',
          message: isApproved
            ? `Ваш документ «${document.fileName}» успешно проверен и одобрен.`
            : `Ваш документ «${document.fileName}» был отклонён. Пожалуйста, загрузите корректный документ.`,
          data: { documentId: id, status },
        })
        .catch(() => {});
    }

    return saved;
  }
}
