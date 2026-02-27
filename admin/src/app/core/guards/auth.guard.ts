import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn && authService.isManager) {
    return true;
  }

  if (!localStorage.getItem('accessToken')) {
    return router.createUrlTree(['/login']);
  }

  // Token exists but user not yet loaded — allow, initializer will handle redirect
  return true;
};
