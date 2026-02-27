import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { UserService, IUser } from '../../../core/services/user.service';
import { BalanceService, IBalanceTransaction, ITransactionsResponse } from '../../../core/services/balance.service';
import { UserTasksComponent } from '../../../components/user-tasks/user-tasks.component';

const RESTRICTED_COUNTRY_FLAGS = ['🇷🇺', '🇧🇾'];

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, UserTasksComponent],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss',
})
export class UserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  private readonly balanceService = inject(BalanceService);

  userId = '';
  user: IUser | null = null;
  loading = true;
  saving = false;
  error = '';
  saveSuccess = false;

  activeTab: 'info' | 'actions' | 'tasks' | 'balance' = 'info';

  // Info tab form fields
  formFirstName = '';
  formLastName = '';
  formPhone = '';
  formCountryFlag = '';
  formStatus = '';
  formRole = '';
  formIsVerified = false;

  // Actions tab
  emailSubject = '';
  emailMessage = '';
  emailSending = false;
  emailSent = false;
  emailError = '';

  // Balance tab
  balance: number | null = null;
  balanceLoading = false;
  transactions: IBalanceTransaction[] = [];
  txTotal = 0;
  txPage = 1;
  txLimit = 20;
  txLoading = false;

  // Deposit form
  depositAmount: number | null = null;
  depositDescription = '';
  depositSaving = false;
  depositSuccess = false;
  depositError = '';

  readonly statuses = ['active', 'blocked', 'pending'];
  readonly roles = ['client', 'manager', 'admin', 'bot'];

  get isRestrictedCountry(): boolean {
    if (!this.user?.countryFlag) return false;
    return RESTRICTED_COUNTRY_FLAGS.some((flag) =>
      this.user!.countryFlag.includes(flag),
    );
  }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadUser();
  }

  loadUser(): void {
    this.loading = true;
    this.error = '';
    this.userService.getUser(this.userId).subscribe({
      next: (u) => {
        this.user = u;
        this.fillForm(u);
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить профиль';
        this.loading = false;
      },
    });
  }

  fillForm(u: IUser): void {
    this.formFirstName = u.firstName;
    this.formLastName = u.lastName;
    this.formPhone = u.phone ?? '';
    this.formCountryFlag = u.countryFlag ?? '';
    this.formStatus = u.status;
    this.formRole = u.role;
    this.formIsVerified = u.isVerified;
  }

  saveInfo(): void {
    this.saving = true;
    this.saveSuccess = false;
    this.error = '';
    this.userService
      .managerUpdateUser(this.userId, {
        firstName: this.formFirstName,
        lastName: this.formLastName,
        phone: this.formPhone || undefined,
        countryFlag: this.formCountryFlag || undefined,
        status: this.formStatus,
        role: this.formRole,
        isVerified: this.formIsVerified,
      })
      .subscribe({
        next: (u) => {
          this.user = u;
          this.saving = false;
          this.saveSuccess = true;
          setTimeout(() => (this.saveSuccess = false), 3000);
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'Ошибка сохранения';
          this.saving = false;
        },
      });
  }

  sendEmail(): void {
    if (!this.emailSubject || !this.emailMessage) return;
    this.emailSending = true;
    this.emailSent = false;
    this.emailError = '';
    this.userService
      .sendCustomEmail(this.userId, this.emailSubject, this.emailMessage)
      .subscribe({
        next: () => {
          this.emailSending = false;
          this.emailSent = true;
          this.emailSubject = '';
          this.emailMessage = '';
          setTimeout(() => (this.emailSent = false), 4000);
        },
        error: () => {
          this.emailSending = false;
          this.emailError = 'Ошибка отправки';
        },
      });
  }

  openBalanceTab(): void {
    this.activeTab = 'balance';
    if (this.balance === null) {
      this.loadBalance();
    }
  }

  loadBalance(): void {
    this.balanceLoading = true;
    this.balanceService.getUserBalance(this.userId).subscribe({
      next: (res) => {
        this.balance = res.balance;
        this.balanceLoading = false;
        this.loadTransactions();
      },
      error: () => (this.balanceLoading = false),
    });
  }

  loadTransactions(): void {
    this.txLoading = true;
    this.balanceService
      .getUserTransactions(this.userId, this.txPage, this.txLimit)
      .subscribe({
        next: (res: ITransactionsResponse) => {
          this.transactions = res.data;
          this.txTotal = res.total;
          this.txLoading = false;
        },
        error: () => (this.txLoading = false),
      });
  }

  txPages(): number {
    return Math.ceil(this.txTotal / this.txLimit);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.txPages()) return;
    this.txPage = page;
    this.loadTransactions();
  }

  deposit(): void {
    if (!this.depositAmount || this.depositAmount <= 0) return;
    this.depositSaving = true;
    this.depositSuccess = false;
    this.depositError = '';
    this.balanceService
      .adjustBalance(this.userId, {
        amount: this.depositAmount,
        type: 'deposit',
        description: this.depositDescription || 'Пополнение баланса',
      })
      .subscribe({
        next: () => {
          this.depositSaving = false;
          this.depositSuccess = true;
          this.depositAmount = null;
          this.depositDescription = '';
          this.loadBalance();
          setTimeout(() => (this.depositSuccess = false), 4000);
        },
        error: (err) => {
          this.depositSaving = false;
          this.depositError = err?.error?.message ?? 'Ошибка пополнения';
        },
      });
  }

  txTypeLabel(type: string): string {
    const map: Record<string, string> = {
      deposit: 'Депозит',
      refund: 'Возврат',
      car_payment: 'Оплата авто',
      commission: 'Комиссия',
      delivery: 'Доставка',
      customs: 'Таможня',
      bid_lock: 'Блок. ставки',
      bid_unlock: 'Разбл. ставки',
    };
    return map[type] ?? type;
  }
}
