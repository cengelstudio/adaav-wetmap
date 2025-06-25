import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, delay } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return new Observable(observer => {
      // Auth service'in initialize olmasını bekle
      const checkAuth = () => {
        if (!this.authService.isAuthInitialized()) {
          // Auth henüz initialize olmadı, biraz bekle
          setTimeout(checkAuth, 100);
          return;
        }

        // Auth initialize oldu, user durumunu kontrol et
        this.authService.currentUser$.pipe(
          take(1),
          map(user => {
            const isAuthenticated = this.authService.isAuthenticated();
            console.log('AuthGuard: User:', user?.name || 'None', 'IsAuthenticated:', isAuthenticated);

            if (user && isAuthenticated) {
              observer.next(true);
              observer.complete();
              return true;
            } else {
              console.log('AuthGuard: Redirecting to login');
              this.router.navigate(['/login'], { replaceUrl: true });
              observer.next(false);
              observer.complete();
              return false;
            }
          })
        ).subscribe();
      };

      checkAuth();
    });
  }
}
