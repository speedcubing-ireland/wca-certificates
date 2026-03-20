import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, throwError} from 'rxjs';
import {environment} from '../environments/environment';
import {AuthService} from './auth';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const isWcaRequest = req.url.startsWith(environment.wcaUrl);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (isWcaRequest && error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
