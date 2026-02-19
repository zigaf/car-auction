import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IUser, IUpdateProfile } from '../../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private readonly api: ApiService) {}

  getProfile(): Observable<IUser> {
    return this.api.get<IUser>('/users/me');
  }

  updateProfile(data: IUpdateProfile): Observable<IUser> {
    return this.api.patch<IUser>('/users/me', data);
  }
}
