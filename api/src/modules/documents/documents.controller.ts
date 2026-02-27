import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../db/entities/user.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentStatusDto } from './dto/update-document-status.dto';
import { GetDocumentsDto } from './dto/get-documents.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  getUserDocuments(
    @CurrentUser() user: User,
    @Query() query: GetDocumentsDto,
  ) {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
    return this.documentsService.getUserDocuments(user.id, { page, limit });
  }

  @Post()
  uploadDocument(
    @CurrentUser() user: User,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.uploadDocument(user.id, dto);
  }

  @Get(':id')
  getDocument(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.getDocument(id, user.id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentStatusDto,
    @CurrentUser() manager: User,
  ) {
    return this.documentsService.updateStatus(id, dto.status, manager.id);
  }
}
