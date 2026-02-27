import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  countryFlag: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
  documentsVerified: boolean;
}

export interface UpdateUserManagerPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  countryFlag?: string;
  status?: string;
  isVerified?: boolean;
  role?: string;
}

export interface IUsersResponse {
  data: IUser[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private readonly api: ApiService) {}

  getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  } = {}): Observable<IUsersResponse> {
    return this.api.get<IUsersResponse>('/users', {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search,
      role: params.role,
      status: params.status,
    });
  }

  getUser(id: string): Observable<IUser> {
    return this.api.get<IUser>(`/users/${id}`);
  }

  updateUserStatus(id: string, status: string): Observable<IUser> {
    return this.api.patch<IUser>(`/users/${id}/status`, { status });
  }

  updateUserRole(id: string, role: string): Observable<IUser> {
    return this.api.patch<IUser>(`/users/${id}/role`, { role });
  }

  managerUpdateUser(id: string, payload: UpdateUserManagerPayload): Observable<IUser> {
    return this.api.patch<IUser>(`/users/${id}/manager-update`, payload);
  }

  sendCustomEmail(id: string, subject: string, message: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/users/${id}/send-email`, { subject, message });
  }
}
