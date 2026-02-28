import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () => import('./layout/admin-layout/admin-layout').then(m => m.AdminLayout),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'lots', pathMatch: 'full' },
      {
        path: 'lots',
        loadComponent: () => import('./pages/lots/lots').then(m => m.LotsPage),
      },
      {
        path: 'lots/:id',
        loadComponent: () => import('./pages/lots/lot-detail/lot-detail.component').then(m => m.LotDetailComponent),
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/orders/orders').then(m => m.OrdersPage),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users').then(m => m.UsersPage),
      },
      {
        path: 'documents',
        loadComponent: () => import('./pages/documents/documents').then(m => m.DocumentsPage),
      },
      {
        path: 'users/:id',
        loadComponent: () => import('./pages/users/user-detail/user-detail.component').then(m => m.UserDetailComponent),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./pages/tasks/tasks.component').then(m => m.TasksPage),
      },
      {
        path: 'auctions/schedule',
        loadComponent: () => import('./pages/auctions/schedule.component').then(m => m.SchedulePage),
      },
      {
        path: 'bots',
        loadComponent: () => import('./pages/bots/bots.component').then(m => m.BotsPage),
      },
      {
        path: 'monitor',
        loadComponent: () => import('./pages/monitor/monitor.component').then(m => m.MonitorComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
