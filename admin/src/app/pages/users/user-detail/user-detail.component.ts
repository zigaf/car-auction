import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { UserService, IUser } from '../../../core/services/user.service';
import { BalanceService, IBalanceTransaction, ITransactionsResponse } from '../../../core/services/balance.service';
import { DocumentsService, IDocument } from '../../../core/services/documents.service';
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
  private readonly documentsService = inject(DocumentsService);

  userId = '';
  user: IUser | null = null;
  loading = true;
  saving = false;
  error = '';
  saveSuccess = false;

  activeTab: 'info' | 'actions' | 'tasks' | 'balance' | 'docs' = 'info';

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
  readonly roles = ['client', 'broker', 'admin', 'bot'];

  // Broker assignment (visible when user role = client)
  brokers: IUser[] = [];
  brokersLoading = false;
  selectedBrokerId: string | null = null;
  brokerSaving = false;
  brokerSaveSuccess = false;
  brokerSaveError = '';

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
    this.selectedBrokerId = u.brokerId;

    if (u.role === 'client') {
      this.loadBrokers();
    }
  }

  loadBrokers(): void {
    this.brokersLoading = true;
    this.userService.getUsers({ role: 'broker', limit: 200 }).subscribe({
      next: (res) => {
        this.brokers = res.data;
        this.brokersLoading = false;
      },
      error: () => (this.brokersLoading = false),
    });
  }

  assignBroker(): void {
    this.brokerSaving = true;
    this.brokerSaveSuccess = false;
    this.brokerSaveError = '';
    this.userService.assignBroker(this.userId, this.selectedBrokerId).subscribe({
      next: (u) => {
        this.user = u;
        this.selectedBrokerId = u.brokerId;
        this.brokerSaving = false;
        this.brokerSaveSuccess = true;
        setTimeout(() => (this.brokerSaveSuccess = false), 3000);
      },
      error: (err) => {
        this.brokerSaveError = err?.error?.message ?? 'Ошибка назначения брокера';
        this.brokerSaving = false;
      },
    });
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

  // Documents tab
  userDocs: IDocument[] = [];
  userDocsCount = 0;
  docsLoading = false;
  private docsLoaded = false;

  private static DOC_STATUS_LABELS: Record<string, string> = {
    pending: 'На проверке',
    approved: 'Одобрен',
    rejected: 'Отклонён',
  };

  private static DOC_TYPE_LABELS: Record<string, string> = {
    passport: 'Паспорт',
    driver_license: 'Вод. удостоверение',
    proof_of_address: 'Подтверждение адреса',
    power_of_attorney: 'Доверенность',
    invoice: 'Счёт',
    customs_doc: 'Таможенный документ',
    other: 'Другое',
  };

  getDocStatusLabel(status: string): string {
    return UserDetailComponent.DOC_STATUS_LABELS[status] ?? status;
  }

  getDocTypeLabel(type: string): string {
    return UserDetailComponent.DOC_TYPE_LABELS[type] ?? type;
  }

  openDocsTab(): void {
    this.activeTab = 'docs';
    if (!this.docsLoaded) {
      this.loadUserDocs();
    }
  }

  loadUserDocs(): void {
    this.docsLoading = true;
    this.documentsService.getDocuments({ status: undefined, limit: 100 }).subscribe({
      next: (res) => {
        this.userDocs = res.data.filter((d) => d.user?.id === this.userId);
        this.userDocsCount = this.userDocs.length;
        this.docsLoading = false;
        this.docsLoaded = true;
      },
      error: () => (this.docsLoading = false),
    });
  }

  openDocFile(url: string): void {
    window.open(url, '_blank');
  }

  approveDoc(doc: IDocument): void {
    this.documentsService.updateStatus(doc.id, 'approved').subscribe({
      next: (updated) => {
        const idx = this.userDocs.findIndex((d) => d.id === updated.id);
        if (idx !== -1) this.userDocs[idx] = updated;
      },
    });
  }

  rejectDoc(doc: IDocument): void {
    const comment = prompt('Причина отклонения (необязательно):') ?? undefined;
    this.documentsService.updateStatus(doc.id, 'rejected', comment).subscribe({
      next: (updated) => {
        const idx = this.userDocs.findIndex((d) => d.id === updated.id);
        if (idx !== -1) this.userDocs[idx] = updated;
      },
    });
  }
}
