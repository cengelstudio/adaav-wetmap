import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences';

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

  currentUser$ = this.currentUserSubject.asObservable();
  token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadStoredAuth();
  }

  async loadStoredAuth() {
    try {
      const { value: token } = await Preferences.get({ key: 'auth_token' });
      const { value: userStr } = await Preferences.get({ key: 'current_user' });

      if (token && userStr) {
        const user = JSON.parse(userStr);
        this.tokenSubject.next(token);
        this.currentUserSubject.next(user);
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    // Mock response for testing - remove when real API is ready
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
        }, 1000); // Simulate network delay
      });
    }

    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      username,
      password
    }).pipe(
      tap(async (response) => {
        await this.setAuth(response.token, response.user);
      })
    );
  }

  async setAuth(token: string, user: User) {
    console.log('AuthService: Setting auth for user:', user);
    await Preferences.set({ key: 'auth_token', value: token });
    await Preferences.set({ key: 'current_user', value: JSON.stringify(user) });

    this.tokenSubject.next(token);
    this.currentUserSubject.next(user);
    console.log('AuthService: Auth set successfully');
  }

  async logout() {
    await Preferences.remove({ key: 'auth_token' });
    await Preferences.remove({ key: 'current_user' });

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

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`, {
      headers: this.getAuthHeaders()
    });
  }
}
