import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  loading = false;
  error = '';

  submit(): void {
    if (!this.email || !this.password) return;
    this.loading = true;
    this.error = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        if (res.user.role !== 'manager' && res.user.role !== 'admin') {
          this.authService.logout();
          this.error = 'Недостаточно прав. Только менеджеры и администраторы.';
          this.loading = false;
          return;
        }
        this.router.navigate(['/lots']);
      },
      error: () => {
        this.error = 'Неверный email или пароль';
        this.loading = false;
      },
    });
  }
}
