import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Synchronises client time with the server to prevent timer drift caused by
 * incorrect browser clock settings.
 *
 * Usage:
 *   - Call `init()` once on app startup (APP_INITIALIZER or root component).
 *   - Replace every `Date.now()` timer call with `timeService.now()`.
 */
@Injectable({ providedIn: 'root' })
export class TimeService {
  /** Milliseconds to add to Date.now() to get server-aligned time. */
  private offset = 0;

  constructor(private readonly http: HttpClient) {}

  /**
   * Fetches server time and calculates the clock offset.
   * Compensates for one-way network latency using RTT/2 heuristic.
   */
  init(): Promise<void> {
    return new Promise((resolve) => {
      const localBefore = Date.now();

      this.http
        .get<{ serverTime: number }>(`${environment.apiUrl}/time`)
        .subscribe({
          next: (res) => {
            const rtt = Date.now() - localBefore;
            // Approximate server time at the moment the response was sent
            this.offset = res.serverTime - (localBefore + rtt / 2);
            resolve();
          },
          error: () => {
            // On failure keep offset = 0 (use local time as fallback)
            resolve();
          },
        });
    });
  }

  /** Returns current time adjusted by the server clock offset. */
  now(): number {
    return Date.now() + this.offset;
  }
}
