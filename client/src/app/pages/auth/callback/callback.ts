import { Component, inject, afterNextRender } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  templateUrl: './callback.html',
  styleUrl: './callback.scss',
})
export class AuthCallbackComponent {
  error: string | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stateService = inject(StateService);

  constructor() {
    afterNextRender(() => {
      this.handleCallback();
    });
  }

  private handleCallback() {
    const params = this.route.snapshot.queryParams;

    if (params['error']) {
      this.error =
        params['error'] === 'account_blocked'
          ? 'Аккаунт заблокирован.'
          : 'Ошибка входа. Попробуйте ещё раз.';
      setTimeout(() => this.router.navigate(['/login']), 3000);
      return;
    }

    const accessToken = params['accessToken'];
    const refreshToken = params['refreshToken'];

    if (accessToken && refreshToken) {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      this.loadUserProfile(accessToken);
    } else {
      this.error = 'Данные авторизации не получены.';
      setTimeout(() => this.router.navigate(['/login']), 3000);
    }
  }

  private async loadUserProfile(accessToken: string) {
    try {
      const response = await fetch(`${environment.apiUrl}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to load profile');
      const user = await response.json();
      this.stateService.setUser(user);
      this.router.navigate(['/cabinet/dashboard'], { replaceUrl: true });
    } catch {
      this.router.navigate(['/login']);
    }
  }
}
