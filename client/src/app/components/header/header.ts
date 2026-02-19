import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service';
import { AppButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AppButtonComponent],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  menuOpen = signal(false);

  private stateService = inject(StateService);
  private router = inject(Router);

  appState$ = this.stateService.appState$;

  toggleMenu() {
    this.menuOpen.update((v) => !v);
  }

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.stateService.clearUser();
    this.router.navigate(['/login']);
    this.menuOpen.set(false);
  }
}
