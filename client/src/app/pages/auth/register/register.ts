import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { StateService } from '../../../core/services/state.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  errorMessage = '';
  isLoading = false;

  private router = inject(Router);
  private stateService = inject(StateService);

  async onRegister() {
    this.errorMessage = '';

    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      this.errorMessage = 'Заполните все обязательные поля';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Пароли не совпадают';
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'Пароль должен содержать минимум 8 символов';
      return;
    }

    this.isLoading = true;

    try {
      const response = await fetch(`${environment.apiUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: this.firstName,
          lastName: this.lastName,
          email: this.email,
          phone: this.phone || undefined,
          password: this.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Ошибка регистрации');
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
      }

      this.router.navigate(['/cabinet']);
    } catch (err: any) {
      this.errorMessage = err.message || 'Ошибка при регистрации. Попробуйте позже.';
    } finally {
      this.isLoading = false;
    }
  }

  telegramLogin() {
    const botName = environment.telegramBotName;
    if (!botName) return;

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
      // Telegram auth failed — user stays on register page
    }
  }
}
