import {Injectable, signal, computed, OnDestroy, NgZone, inject} from '@angular/core';
import {environment} from '../environments/environment';

const TOKEN_KEY = 'wca_access_token';
const TOKEN_EXPIRES_AT_KEY = 'wca_access_token_expires_at';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

  private ngZone = inject(NgZone);
  accessToken = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  tokenExpiresAt = signal<number | null>(this.readStoredExpiry());
  isLoggedIn = computed(() => {
    const token = this.accessToken();
    if (!token) return false;
    return !this.isExpired(this.tokenExpiresAt());
  });

  private storageListener = (event: StorageEvent) => {
    this.ngZone.run(() => this.applyStorageEvent(event));
  };

  private popupPollInterval: ReturnType<typeof setInterval> | null = null;
  private expiryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    window.addEventListener('storage', this.storageListener);
    this.syncSessionFromStorage();
  }

  ngOnDestroy() {
    window.removeEventListener('storage', this.storageListener);
    this.clearPopupPoll();
    this.clearExpiryTimeout();
  }

  login(): void {
    const redirectUri = `${environment.appUrl}callback.html`;
    const url = `${environment.wcaUrl}/oauth/authorize` +
      `?client_id=${encodeURIComponent(environment.wcaAppId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=manage_competitions`;

    const popup = window.open(url, 'wca_login', 'width=600,height=700');

    if (popup) {
      this.clearPopupPoll();
      this.popupPollInterval = setInterval(() => {
        if (popup.closed) {
          this.clearPopupPoll();
          // Re-read auth state from localStorage (popup may have written it)
          this.ngZone.run(() => {
            this.syncSessionFromStorage();
          });
        }
      }, 500);
    }
  }

  logout(): void {
    this.clearSession();
  }

  getValidAccessToken(): string | null {
    const token = this.accessToken();
    if (!token) return null;
    if (this.isExpired(this.tokenExpiresAt())) {
      this.clearSession();
      return null;
    }
    return token;
  }

  private clearPopupPoll(): void {
    if (this.popupPollInterval !== null) {
      clearInterval(this.popupPollInterval);
      this.popupPollInterval = null;
    }
  }

  private syncSessionFromStorage(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = this.readStoredExpiry();

    if (token && this.isExpired(expiresAt)) {
      this.clearSession();
      return;
    }

    this.accessToken.set(token);
    this.tokenExpiresAt.set(expiresAt);
    this.scheduleExpiry(expiresAt);
  }

  private applyStorageEvent(event: StorageEvent): void {
    if (event.key === TOKEN_KEY) {
      this.applyTokenUpdate(event.newValue);
      return;
    }

    if (event.key === TOKEN_EXPIRES_AT_KEY) {
      this.applyExpiryUpdate(event.newValue);
      return;
    }

    if (event.key === null) {
      this.syncSessionFromStorage();
    }
  }

  private applyTokenUpdate(token: string | null): void {
    if (!token) {
      this.accessToken.set(null);
      this.tokenExpiresAt.set(null);
      this.clearExpiryTimeout();
      return;
    }

    // Use expiry from storage when available, but ignore stale/expired values
    // so token+expiry events arriving in sequence don't clear a fresh login.
    const expiresAt = this.readStoredExpiry();
    const safeExpiry = this.isExpired(expiresAt) ? null : expiresAt;
    this.accessToken.set(token);
    this.tokenExpiresAt.set(safeExpiry);
    this.scheduleExpiry(safeExpiry);
  }

  private applyExpiryUpdate(rawExpiry: string | null): void {
    const expiresAt = this.parseExpiry(rawExpiry);
    this.tokenExpiresAt.set(expiresAt);

    if (!this.accessToken()) {
      this.clearExpiryTimeout();
      return;
    }

    if (this.isExpired(expiresAt)) {
      this.clearSession();
      return;
    }

    this.scheduleExpiry(expiresAt);
  }

  private readStoredExpiry(): number | null {
    return this.parseExpiry(localStorage.getItem(TOKEN_EXPIRES_AT_KEY));
  }

  private parseExpiry(raw: string | null): number | null {
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private isExpired(expiresAt: number | null): boolean {
    return expiresAt !== null && Date.now() >= expiresAt;
  }

  private scheduleExpiry(expiresAt: number | null): void {
    this.clearExpiryTimeout();

    if (expiresAt === null) return;

    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      this.clearSession();
      return;
    }

    this.expiryTimeout = setTimeout(() => {
      this.ngZone.run(() => this.clearSession());
    }, msUntilExpiry);
  }

  private clearExpiryTimeout(): void {
    if (this.expiryTimeout !== null) {
      clearTimeout(this.expiryTimeout);
      this.expiryTimeout = null;
    }
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
    this.accessToken.set(null);
    this.tokenExpiresAt.set(null);
    this.clearExpiryTimeout();
  }
}
