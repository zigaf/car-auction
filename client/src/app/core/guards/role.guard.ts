import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StateService } from '../services/state.service';

export const managerGuard: CanActivateFn = () => {
  const stateService = inject(StateService);
  const router = inject(Router);

  const user = stateService.snapshot.user;

  if (!user && !localStorage.getItem('accessToken')) {
    return router.createUrlTree(['/login']);
  }

  if (user && (user.role === 'manager' || user.role === 'admin')) {
    return true;
  }

  return router.createUrlTree(['/cabinet']);
};
