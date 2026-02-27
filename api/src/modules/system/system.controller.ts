import { Controller, Get } from '@nestjs/common';

@Controller('time')
export class SystemController {
  @Get()
  getServerTime(): { serverTime: number } {
    return { serverTime: Date.now() };
  }
}
