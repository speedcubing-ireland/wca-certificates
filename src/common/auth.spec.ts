import {TestBed} from '@angular/core/testing';
import {AuthService} from './auth';

const TOKEN_KEY = 'wca_access_token';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should not be logged in when no token in localStorage', () => {
      expect(service.isLoggedIn()).toBeFalse();
      expect(service.accessToken()).toBeNull();
    });

    it('should be logged in when token exists in localStorage at construction', () => {
      // Destroy current service, seed localStorage, then re-create via fresh TestBed
      service.ngOnDestroy();
      localStorage.setItem(TOKEN_KEY, 'existing-token');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      service = TestBed.inject(AuthService);

      expect(service.isLoggedIn()).toBeTrue();
      expect(service.accessToken()).toBe('existing-token');
    });
  });

  describe('logout', () => {
    it('should clear token from localStorage and signals', () => {
      localStorage.setItem(TOKEN_KEY, 'test-token');
      service.accessToken.set('test-token');

      service.logout();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(service.accessToken()).toBeNull();
      expect(service.isLoggedIn()).toBeFalse();
    });
  });

  describe('login', () => {
    let openSpy: jasmine.Spy;

    beforeEach(() => {
      openSpy = spyOn(window, 'open');
    });

    it('should open a popup window with the correct OAuth URL', () => {
      openSpy.and.returnValue(null);
      service.login();
      expect(openSpy).toHaveBeenCalledTimes(1);
      const url = openSpy.calls.first().args[0] as string;
      expect(url).toContain('/oauth/authorize');
      expect(url).toContain('client_id=');
      expect(url).toContain('response_type=token');
      expect(url).toContain('scope=manage_competitions');
      expect(url).toContain('callback.html');
    });

    it('should poll for popup close when popup opens successfully', () => {
      const fakePopup = {closed: false} as Window;
      openSpy.and.returnValue(fakePopup);
      const intervalSpy = spyOn(window, 'setInterval').and.callThrough();

      service.login();

      expect(intervalSpy).toHaveBeenCalled();
    });

    it('should not poll when popup fails to open', () => {
      openSpy.and.returnValue(null);
      const intervalSpy = spyOn(window, 'setInterval');

      service.login();

      expect(intervalSpy).not.toHaveBeenCalled();
    });

    it('should read token from localStorage when popup closes', (done) => {
      const fakePopup = {closed: false} as Window;
      openSpy.and.returnValue(fakePopup);

      service.login();

      // Simulate: popup writes token and closes
      localStorage.setItem(TOKEN_KEY, 'new-token');
      (fakePopup as {closed: boolean}).closed = true;

      // Wait for the poll interval to fire
      setTimeout(() => {
        expect(service.accessToken()).toBe('new-token');
        expect(service.isLoggedIn()).toBeTrue();
        done();
      }, 600);
    });

    it('should remain logged out if popup closes without token', (done) => {
      const fakePopup = {closed: false} as Window;
      openSpy.and.returnValue(fakePopup);

      service.login();
      (fakePopup as {closed: boolean}).closed = true;

      setTimeout(() => {
        expect(service.accessToken()).toBeNull();
        expect(service.isLoggedIn()).toBeFalse();
        done();
      }, 600);
    });
  });

  describe('storage event listener', () => {
    it('should update accessToken when storage event fires for our key', () => {
      const event = new StorageEvent('storage', {
        key: TOKEN_KEY,
        newValue: 'event-token'
      });
      window.dispatchEvent(event);

      expect(service.accessToken()).toBe('event-token');
    });

    it('should not update accessToken for unrelated storage keys', () => {
      const event = new StorageEvent('storage', {
        key: 'other_key',
        newValue: 'irrelevant'
      });
      window.dispatchEvent(event);

      expect(service.accessToken()).toBeNull();
    });

    it('should set accessToken to null when token is removed from storage', () => {
      // First set a token
      service.accessToken.set('existing');
      expect(service.isLoggedIn()).toBeTrue();

      const event = new StorageEvent('storage', {
        key: TOKEN_KEY,
        newValue: null
      });
      window.dispatchEvent(event);

      expect(service.accessToken()).toBeNull();
      expect(service.isLoggedIn()).toBeFalse();
    });
  });

  describe('ngOnDestroy', () => {
    it('should stop responding to storage events after destroy', () => {
      service.ngOnDestroy();

      const event = new StorageEvent('storage', {
        key: TOKEN_KEY,
        newValue: 'after-destroy'
      });
      window.dispatchEvent(event);

      expect(service.accessToken()).toBeNull();
    });
  });
});
