import { APP_INITIALIZER, ApplicationConfig, PLATFORM_ID, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { isPlatformBrowser } from '@angular/common';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { routes } from './app.routes';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { StateService } from './core/services/state.service';
import { TimeService } from './core/services/time.service';
import { environment } from '../environments/environment';

function initializeAuth(platformId: object, stateService: StateService): () => Promise<void> {
  return async () => {
    if (!isPlatformBrowser(platformId)) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const res = await fetch(`${environment.apiUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        // Token expired — try to refresh silently
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
        stateService.setUser(user);
        return;
      }

      const user = await res.json();
      stateService.setUser(user);
    } catch {
      // Network error — keep tokens, user can retry later
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideAnimationsAsync(),
    provideClientHydration(withEventReplay()),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [PLATFORM_ID, StateService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (platformId: object, timeService: TimeService) => {
        return () => {
          if (!isPlatformBrowser(platformId)) return Promise.resolve();
          return timeService.init();
        };
      },
      deps: [PLATFORM_ID, TimeService],
      multi: true,
    },
  ],
};
