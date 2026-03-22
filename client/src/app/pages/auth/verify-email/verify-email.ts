import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

type State = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  state: State = 'loading';
  resendEmail = '';
  resendSent = false;
  resendError = '';

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state = 'error';
      return;
    }

    try {
      const res = await fetch(`${environment.apiUrl}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        this.state = 'success';
        setTimeout(() => this.router.navigate(['/cabinet']), 3000);
      } else {
        this.state = 'error';
      }
    } catch {
      this.state = 'error';
    }
  }

  async resend(): Promise<void> {
    if (!this.resendEmail) return;
    try {
      await fetch(`${environment.apiUrl}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.resendEmail }),
      });
      this.resendSent = true;
    } catch {
      this.resendError = 'Ошибка при отправке письма.';
    }
  }
}
