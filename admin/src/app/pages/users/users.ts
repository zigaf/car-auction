import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService, IUser } from '../../core/services/user.service';

const STATUS_LABELS: Record<string, string | undefined> = {
  active: 'Активен',
  blocked: 'Заблокирован',
  pending: 'Ожидает',
};

const ROLE_LABELS: Record<string, string> = {
  client: 'Клиент',
  manager: 'Менеджер',
  admin: 'Администратор',
};

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class UsersPage implements OnInit {
  private readonly userService = inject(UserService);

  users: IUser[] = [];
  loading = true;
  error = '';
  total = 0;
  page = 1;
  limit = 20;

  filterSearch = '';
  filterRole = '';
  filterStatus = '';

  readonly roleLabels = ROLE_LABELS;
  readonly statusLabels = STATUS_LABELS;
  getStatusLabel(status: string): string { return STATUS_LABELS[status] ?? status; }
  readonly roles = ['client', 'manager', 'admin'];
  readonly statuses = ['active', 'blocked', 'pending'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.userService.getUsers({
      page: this.page,
      limit: this.limit,
      search: this.filterSearch || undefined,
      role: this.filterRole || undefined,
      status: this.filterStatus || undefined,
    }).subscribe({
      next: (res) => {
        this.users = res.data;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить пользователей';
        this.loading = false;
      },
    });
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  prevPage(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  nextPage(): void {
    if (this.page * this.limit < this.total) { this.page++; this.load(); }
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.limit);
  }

  toggleBlock(user: IUser): void {
    const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
    this.userService.updateUserStatus(user.id, newStatus).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === updated.id);
        if (idx !== -1) this.users[idx] = updated;
      },
    });
  }

  updateRole(user: IUser, role: string): void {
    this.userService.updateUserRole(user.id, role).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === updated.id);
        if (idx !== -1) this.users[idx] = updated;
      },
    });
  }
}
