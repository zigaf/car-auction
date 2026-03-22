import { IsBoolean } from 'class-validator';

export class ToggleSettingDto {
  @IsBoolean()
  isEnabled: boolean;
}
