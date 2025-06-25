import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
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
    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        const isAuthenticated = this.authService.isAuthenticated();
        console.log('AuthGuard: User:', user, 'IsAuthenticated:', isAuthenticated);

        if (user && isAuthenticated) {
          return true;
        } else {
          this.router.navigate(['/login'], { replaceUrl: true });
          return false;
        }
      })
    );
  }
}
