import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface IAdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: IAdminUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser: IAdminUser | null = null;

  constructor(private readonly api: ApiService) {}

  get currentUser(): IAdminUser | null {
    return this._currentUser;
  }

  setUser(user: IAdminUser): void {
    this._currentUser = user;
  }

  clearUser(): void {
    this._currentUser = null;
  }

  get isLoggedIn(): boolean {
    return !!this._currentUser;
  }

  get isManager(): boolean {
    return this._currentUser?.role === 'manager' || this._currentUser?.role === 'admin';
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', { email, password }).pipe(
      tap((res) => {
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('refreshToken', res.refreshToken);
        this._currentUser = res.user;
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this._currentUser = null;
  }

  getMe(): Observable<IAdminUser> {
    return this.api.get<IAdminUser>('/users/me').pipe(
      tap((user) => { this._currentUser = user; }),
    );
  }
}
