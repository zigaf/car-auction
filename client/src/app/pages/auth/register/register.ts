import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

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

  private router = inject(Router);

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
