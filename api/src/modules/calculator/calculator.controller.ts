import { Controller, Post, Body } from '@nestjs/common';
import { CalculatorService } from './calculator.service';
import { CalculateCustomsDto } from './dto/calculate-customs.dto';

@Controller('calculator')
export class CalculatorController {
  constructor(private readonly calculatorService: CalculatorService) {}

  @Post('customs')
  calculateCustoms(@Body() dto: CalculateCustomsDto) {
    return this.calculatorService.calculate(dto);
  }
}
