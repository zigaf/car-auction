import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  token = '';
  newPassword = '';
  confirmPassword = '';
  isLoading = false;
  tokenInvalid = false;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.tokenInvalid = true;
  }

  async onSubmit(): Promise<void> {
    if (this.newPassword !== this.confirmPassword) {
      this.toastService.error('Пароли не совпадают');
      return;
    }
    if (this.newPassword.length < 8) {
      this.toastService.error('Минимум 8 символов');
      return;
    }

    this.isLoading = true;
    try {
      const res = await fetch(`${environment.apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token, newPassword: this.newPassword }),
      });

      if (res.ok) {
        this.toastService.success('Пароль изменён. Войдите в аккаунт.');
        this.router.navigate(['/login']);
      } else {
        const err = await res.json().catch(() => null);
        this.toastService.error(err?.message || 'Ссылка недействительна или истекла.');
        this.tokenInvalid = true;
      }
    } catch {
      this.toastService.error('Ошибка сети. Попробуйте снова.');
    } finally {
      this.isLoading = false;
    }
  }
}
