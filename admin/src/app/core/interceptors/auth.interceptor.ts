import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private readonly router: Router,
    private readonly http: HttpClient,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const accessToken = this.getAccessToken();

    let authReq = req;
    if (accessToken && this.isApiRequest(req.url)) {
      authReq = this.addToken(req, accessToken);
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          error.status === 401 &&
          this.isApiRequest(req.url) &&
          !req.url.includes('/auth/refresh') &&
          !req.url.includes('/auth/login')
        ) {
          return this.handle401Error(authReq, next);
        }
        return throwError(() => error);
      }),
    );
  }

  private addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  private isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }

  private handle401Error(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        this.isRefreshing = false;
        this.clearTokensAndRedirect();
        return throwError(() => new HttpErrorResponse({ status: 401 }));
      }

      return this.http
        .post<{ accessToken: string; refreshToken: string }>(
          `${environment.apiUrl}/auth/refresh`,
          { refreshToken },
        )
        .pipe(
          switchMap((tokens) => {
            this.isRefreshing = false;
            localStorage.setItem('accessToken', tokens.accessToken);
            localStorage.setItem('refreshToken', tokens.refreshToken);
            this.refreshTokenSubject.next(tokens.accessToken);
            return next.handle(this.addToken(req, tokens.accessToken));
          }),
          catchError((err) => {
            this.isRefreshing = false;
            this.clearTokensAndRedirect();
            return throwError(() => err);
          }),
        );
    }

    return this.refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next.handle(this.addToken(req, token!))),
    );
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private clearTokensAndRedirect(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.router.navigate(['/login']);
  }
}
