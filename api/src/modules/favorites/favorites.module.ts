import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from '../../db/entities/favorite.entity';
import { User } from '../../db/entities/user.entity';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, User]), AuthModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
