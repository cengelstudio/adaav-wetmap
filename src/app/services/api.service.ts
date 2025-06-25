import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Location {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  type: string;
  city: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  isAdmin: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'https://adaav-wetmap-api.glynet.com/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  // Locations
  getLocations(type?: string, city?: string): Observable<Location[]> {
    let url = `${this.apiUrl}/locations/`;
    const params = new URLSearchParams();

    if (type) params.append('type', type);
    if (city) params.append('city', city);

    if (params.toString()) {
      url += '?' + params.toString();
    }

    return this.http.get<Location[]>(url, {
      headers: this.authService.getAuthHeaders()
    });
  }

  createLocation(location: Omit<Location, 'id'>): Observable<Location> {
    return this.http.post<Location>(`${this.apiUrl}/locations/`, location, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateLocation(id: string, location: Partial<Location>): Observable<Location> {
    return this.http.put<Location>(`${this.apiUrl}/locations/${id}`, location, {
      headers: this.authService.getAuthHeaders()
    });
  }

  deleteLocation(id: string): Observable<{message: string}> {
    return this.http.delete<{message: string}>(`${this.apiUrl}/locations/${id}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  // Users (Admin only)
  getUsers(): Observable<{users: User[]}> {
    return this.http.get<{users: User[]}>(`${this.apiUrl}/users/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getUser(id: string): Observable<{user: User}> {
    return this.http.get<{user: User}>(`${this.apiUrl}/users/${id}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  createUser(user: {name: string, username: string, password: string, role?: string}): Observable<{user: User}> {
    return this.http.post<{user: User}>(`${this.apiUrl}/users/`, user, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateUser(id: string, user: Partial<{name: string, username: string, password: string, role: string}>): Observable<{user: User}> {
    return this.http.put<{user: User}>(`${this.apiUrl}/users/${id}`, user, {
      headers: this.authService.getAuthHeaders()
    });
  }

  deleteUser(id: string): Observable<{success: boolean, message: string}> {
    return this.http.delete<{success: boolean, message: string}>(`${this.apiUrl}/users/${id}`, {
      headers: this.authService.getAuthHeaders()
    });
  }
}
