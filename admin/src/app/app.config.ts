import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { environment } from '../environments/environment';

function initializeAuth(authService: AuthService): () => Promise<void> {
  return async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const res = await fetch(`${environment.apiUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          return;
        }

        const refreshRes = await fetch(`${environment.apiUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshRes.ok) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          return;
        }

        const tokens = await refreshRes.json();
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);

        const retryRes = await fetch(`${environment.apiUrl}/users/me`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        if (!retryRes.ok) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          return;
        }

        const user = await retryRes.json();
        if (user.role === 'manager' || user.role === 'admin') {
          authService.setUser(user);
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
        return;
      }

      const user = await res.json();
      if (user.role === 'manager' || user.role === 'admin') {
        authService.setUser(user);
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    } catch {
      // Network error — keep tokens
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideAnimationsAsync(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true,
    },
  ],
};
