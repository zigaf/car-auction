import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { NotificationService } from '../notification/notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { User } from '../../db/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserManagerDto } from './dto/update-user-manager.dto';
import { SendEmailDto } from './dto/send-email.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get('me')
  getProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  findById(@Param('id') id: string) {
    return this.userService.findByIdFull(id);
  }

  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  activate(@Param('id') id: string) {
    return this.userService.activate(id);
  }

  @Patch(':id/block')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  block(@Param('id') id: string) {
    return this.userService.block(id);
  }

  @Patch(':id/manager-update')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  managerUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserManagerDto,
    @CurrentUser() caller: User,
  ) {
    return this.userService.managerUpdateUser(id, dto, caller.role);
  }

  @Post(':id/send-email')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  async sendEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendEmailDto,
  ) {
    await this.notificationService.sendCustomEmail(id, dto.subject, dto.message);
    return { message: 'Email sent' };
  }
}
