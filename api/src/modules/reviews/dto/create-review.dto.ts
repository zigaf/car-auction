import { IsInt, IsString, IsNotEmpty, IsOptional, MaxLength, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  authorName?: string;
}
