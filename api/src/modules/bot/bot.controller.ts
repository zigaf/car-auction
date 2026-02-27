import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BotService } from './bot.service';
import { CreateBotUserDto } from './dto/create-bot-user.dto';
import { CreateBotConfigDto } from './dto/create-bot-config.dto';
import { UpdateBotConfigDto } from './dto/update-bot-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('bots')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MANAGER, Role.ADMIN)
export class BotController {
  constructor(private readonly botService: BotService) {}

  // ─── Bot Users ──────────────────────────────────────────────────────────────

  @Post('users')
  createBotUser(@Body() dto: CreateBotUserDto) {
    return this.botService.createBotUser(dto);
  }

  @Get('users')
  findBotUsers() {
    return this.botService.findBotUsers();
  }

  @Delete('users/:id')
  async removeBotUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.botService.removeBotUser(id);
    return { message: 'Bot user deleted' };
  }

  // ─── Bot Configs ─────────────────────────────────────────────────────────────

  @Post('configs')
  createConfig(@Body() dto: CreateBotConfigDto) {
    return this.botService.createConfig(dto);
  }

  @Get('configs')
  findConfigs(@Query('lotId') lotId?: string) {
    return this.botService.findConfigs(lotId);
  }

  @Patch('configs/:id')
  updateConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBotConfigDto,
  ) {
    return this.botService.updateConfig(id, dto);
  }

  @Delete('configs/:id')
  async removeConfig(@Param('id', ParseUUIDPipe) id: string) {
    await this.botService.removeConfig(id);
    return { message: 'Bot config deleted' };
  }
}
