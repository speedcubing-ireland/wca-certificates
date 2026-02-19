import {Injectable, signal, computed, OnDestroy, NgZone, inject} from '@angular/core';
import {environment} from '../environments/environment';

const TOKEN_KEY = 'wca_access_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

  private ngZone = inject(NgZone);
  accessToken = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  isLoggedIn = computed(() => this.accessToken() !== null);

  private storageListener = (event: StorageEvent) => {
    if (event.key === TOKEN_KEY) {
      this.ngZone.run(() => {
        this.accessToken.set(event.newValue);
      });
    }
  };

  private popupPollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    window.addEventListener('storage', this.storageListener);
  }

  ngOnDestroy() {
    window.removeEventListener('storage', this.storageListener);
    this.clearPopupPoll();
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
          // Re-read token from localStorage (popup may have written it)
          this.ngZone.run(() => {
            this.accessToken.set(localStorage.getItem(TOKEN_KEY));
          });
        }
      }, 500);
    }
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.accessToken.set(null);
  }

  private clearPopupPoll(): void {
    if (this.popupPollInterval !== null) {
      clearInterval(this.popupPollInterval);
      this.popupPollInterval = null;
    }
  }
}
