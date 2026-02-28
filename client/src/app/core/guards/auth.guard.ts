import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { StateService } from '../services/state.service';

export const authGuard: CanActivateFn = () => {
  const stateService = inject(StateService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (stateService.snapshot.isAuthenticated || localStorage.getItem('accessToken')) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
