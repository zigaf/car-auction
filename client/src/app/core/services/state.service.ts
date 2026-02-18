import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppState {
  isAuthenticated: boolean;
  user: UserState | null;
  notifications: number;
}

export interface UserState {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'client' | 'manager' | 'admin';
  status: 'pending' | 'active' | 'blocked';
  isVerified: boolean;
  countryFlag: string;
  balance: number;
  preferredLanguage: string;
  preferredCurrency: string;
}

const initialState: AppState = {
  isAuthenticated: false,
  user: null,
  notifications: 0,
};

@Injectable({ providedIn: 'root' })
export class StateService {
  private readonly state$ = new BehaviorSubject<AppState>(initialState);

  readonly appState$ = this.state$.asObservable();

  get snapshot(): AppState {
    return this.state$.getValue();
  }

  setUser(user: UserState) {
    this.state$.next({
      ...this.snapshot,
      isAuthenticated: true,
      user,
    });
  }

  clearUser() {
    this.state$.next({
      ...initialState,
    });
  }

  setNotifications(count: number) {
    this.state$.next({
      ...this.snapshot,
      notifications: count,
    });
  }

  updateBalance(balance: number) {
    if (this.snapshot.user) {
      this.state$.next({
        ...this.snapshot,
        user: { ...this.snapshot.user, balance },
      });
    }
  }
}
