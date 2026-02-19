import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StateService } from '../services/state.service';

export const authGuard: CanActivateFn = () => {
  const stateService = inject(StateService);
  const router = inject(Router);

  if (stateService.snapshot.isAuthenticated || localStorage.getItem('accessToken')) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
