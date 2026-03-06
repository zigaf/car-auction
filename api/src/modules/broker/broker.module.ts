import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../db/entities/user.entity';
import { BrokerController } from './broker.controller';
import { BrokerService } from './broker.service';
import { AuthModule } from '../auth/auth.module';
import { FavoritesModule } from '../favorites/favorites.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule, FavoritesModule],
  controllers: [BrokerController],
  providers: [BrokerService],
})
export class BrokerModule {}
