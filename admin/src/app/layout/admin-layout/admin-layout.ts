import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayout {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  navItems: NavItem[] = [
    { label: 'Лоты', icon: 'directions_car', path: '/lots' },
    { label: 'Заказы', icon: 'receipt_long', path: '/orders' },
    { label: 'Пользователи', icon: 'group', path: '/users' },
    { label: 'Документы', icon: 'description', path: '/documents' },
    { label: 'Задачи', icon: 'checklist', path: '/tasks' },
    { label: 'Расписание', icon: 'calendar_month', path: '/auctions/schedule' },
    { label: 'Боты', icon: 'smart_toy', path: '/bots' },
  ];

  get currentUser() {
    return this.authService.currentUser;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
