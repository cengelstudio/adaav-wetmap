import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';

export interface User {
  id: string;
  name: string;
  username: string;
  role?: string;
  isAdmin?: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://adaav-wetmap-api.glynet.com/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private isOnlineSubject = new BehaviorSubject<boolean>(true);
  private authInitialized = false;

  currentUser$ = this.currentUserSubject.asObservable();
  token$ = this.tokenSubject.asObservable();
  isOnline$ = this.isOnlineSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeNetworkListener();
    this.loadStoredAuth();
  }

  async initializeNetworkListener() {
    const status = await Network.getStatus();
    this.isOnlineSubject.next(status.connected);

    Network.addListener('networkStatusChange', (status) => {
      this.isOnlineSubject.next(status.connected);
    });
  }

  async loadStoredAuth() {
    try {
      const { value: token } = await Preferences.get({ key: 'auth_token' });
      const { value: userStr } = await Preferences.get({ key: 'current_user' });
      const { value: loginTime } = await Preferences.get({ key: 'login_time' });

      if (token && userStr && loginTime) {
        const user = JSON.parse(userStr);
        const loginTimestamp = parseInt(loginTime);
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000; // 30 gün

        // Token 30 günden eskiyse silme
        if (now - loginTimestamp < thirtyDays) {
          this.tokenSubject.next(token);
          this.currentUserSubject.next(user);
          console.log('Auto-login successful for user:', user.name);
        } else {
          // Eski token'ı temizle
          await this.logout();
          console.log('Token expired, cleared stored auth');
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      this.authInitialized = true;
    }
  }

  isAuthInitialized(): boolean {
    return this.authInitialized;
  }

  login(username: string, password: string): Observable<LoginResponse> {
    // Mock response for offline testing
    if (username === 'admin' && password === 'admin') {
      const mockResponse: LoginResponse = {
        token: 'mock-token-123',
        user: {
          id: '1',
          name: 'Admin User',
          username: 'admin',
          role: 'admin',
          isAdmin: true
        }
      };

      return new Observable(observer => {
        setTimeout(async () => {
          await this.setAuth(mockResponse.token, mockResponse.user);
          observer.next(mockResponse);
          observer.complete();
        }, 1000);
      });
    }

    // Online login
    if (this.isOnlineSubject.value) {
      return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
        username,
        password
      }).pipe(
        tap(async (response) => {
          await this.setAuth(response.token, response.user);
        }),
        catchError(async (error) => {
          console.error('Online login failed:', error);
          // Offline durumunda daha önce kaydedilmiş auth bilgilerini kontrol et
          throw error;
        })
      );
    } else {
      // Offline durumunda cached credentials ile login
      return this.offlineLogin(username, password);
    }
  }

  private offlineLogin(username: string, password: string): Observable<LoginResponse> {
    return new Observable(observer => {
      setTimeout(async () => {
        try {
          const { value: lastUser } = await Preferences.get({ key: 'last_username' });
          const { value: lastPassword } = await Preferences.get({ key: 'last_password' });

          if (lastUser === username && lastPassword === password) {
            const { value: userStr } = await Preferences.get({ key: 'current_user' });
            const { value: token } = await Preferences.get({ key: 'auth_token' });

            if (userStr && token) {
              const user = JSON.parse(userStr);
              const response: LoginResponse = { token, user };
              observer.next(response);
              observer.complete();
              return;
            }
          }

          throw new Error('Offline login failed: Invalid credentials or no cached data');
        } catch (error) {
          observer.error(error);
        }
      }, 500);
    });
  }

  async setAuth(token: string, user: User, saveCredentials?: { username: string, password: string }) {
    console.log('AuthService: Setting auth for user:', user);
    await Preferences.set({ key: 'auth_token', value: token });
    await Preferences.set({ key: 'current_user', value: JSON.stringify(user) });
    await Preferences.set({ key: 'login_time', value: Date.now().toString() });

    // Offline login için credentials kaydet (isteğe bağlı)
    if (saveCredentials) {
      await Preferences.set({ key: 'last_username', value: saveCredentials.username });
      await Preferences.set({ key: 'last_password', value: saveCredentials.password });
    }

    this.tokenSubject.next(token);
    this.currentUserSubject.next(user);
    console.log('AuthService: Auth set successfully');
  }

  async logout() {
    await Preferences.remove({ key: 'auth_token' });
    await Preferences.remove({ key: 'current_user' });
    await Preferences.remove({ key: 'login_time' });
    await Preferences.remove({ key: 'last_username' });
    await Preferences.remove({ key: 'last_password' });

    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.isAdmin || false;
  }

  isOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  me(): Observable<User> {
    if (!this.isOnlineSubject.value) {
      // Offline durumunda cached user bilgisini döndür
      return new Observable(observer => {
        const user = this.getCurrentUser();
        if (user) {
          observer.next(user);
          observer.complete();
        } else {
          observer.error(new Error('No cached user data'));
        }
      });
    }

    return this.http.get<User>(`${this.apiUrl}/auth/me`, {
      headers: this.getAuthHeaders()
    });
  }
}
