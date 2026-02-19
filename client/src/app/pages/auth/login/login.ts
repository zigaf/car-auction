import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { StateService } from '../../../core/services/state.service';

import { AppButtonComponent } from '../../../shared/components/button/button.component';
import { AppInputComponent } from '../../../shared/components/input/input.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule, AppButtonComponent, AppInputComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  isLoading = false;
  apiUrl = environment.apiUrl;

  private router = inject(Router);
  private stateService = inject(StateService);
  private toastService = inject(ToastService);

  async onLogin() {
    if (!this.email || !this.password) {
      this.toastService.warning('Введите email и пароль');
      return;
    }

    this.isLoading = true;

    try {
      const response = await fetch(`${environment.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Неверный email или пароль');
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      // Load user profile
      const profileResponse = await fetch(`${environment.apiUrl}/users/me`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });

      if (profileResponse.ok) {
        const user = await profileResponse.json();
        this.stateService.setUser(user);
        this.toastService.success('Вы успешно вошли в систему');
      }

      this.router.navigate(['/cabinet']);
    } catch (err: any) {
      this.toastService.error(err.message || 'Ошибка при входе. Попробуйте позже.');
    } finally {
      this.isLoading = false;
    }
  }

  telegramLogin() {
    const botName = environment.telegramBotName;
    if (!botName) return;

    const callbackUrl = `${environment.apiUrl}/auth/telegram`;
    const width = 550;
    const height = 470;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const authUrl =
      `https://oauth.telegram.org/auth?bot_id=${botName}` +
      `&origin=${encodeURIComponent(window.location.origin)}` +
      `&request_access=write`;

    window.open(
      authUrl,
      'TelegramAuth',
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    (window as any).Telegram = {
      Login: {
        auth: (user: any) => {
          this.handleTelegramAuth(user);
        },
      },
    };
  }

  private async handleTelegramAuth(user: any) {
    try {
      const response = await fetch(`${environment.apiUrl}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      if (!response.ok) throw new Error('Telegram auth failed');

      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      this.router.navigate(['/cabinet/dashboard']);
    } catch {
      // Telegram auth failed — user stays on login page
    }
  }
}
