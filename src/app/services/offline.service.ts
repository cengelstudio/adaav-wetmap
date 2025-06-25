import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { ApiService, Location } from './api.service';

export interface PendingAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: 'locations' | 'users';
  data: any;
  locationId?: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private isOnlineSubject = new BehaviorSubject<boolean>(true);
  private pendingActionsSubject = new BehaviorSubject<PendingAction[]>([]);
  private cachedLocationsSubject = new BehaviorSubject<Location[]>([]);

  isOnline$ = this.isOnlineSubject.asObservable();
  pendingActions$ = this.pendingActionsSubject.asObservable();
  cachedLocations$ = this.cachedLocationsSubject.asObservable();

  constructor(private apiService: ApiService) {
    this.initializeNetworkListener();
    this.loadCachedData();
    this.loadPendingActions();
  }

  async initializeNetworkListener() {
    const status = await Network.getStatus();
    this.isOnlineSubject.next(status.connected);

    Network.addListener('networkStatusChange', (status) => {
      this.isOnlineSubject.next(status.connected);
      if (status.connected) {
        this.syncPendingActions();
      }
    });
  }

  async loadCachedData() {
    try {
      const { value } = await Preferences.get({ key: 'cached_locations' });
      if (value) {
        const locations = JSON.parse(value);
        this.cachedLocationsSubject.next(locations);
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  }

  async loadPendingActions() {
    try {
      const { value } = await Preferences.get({ key: 'pending_actions' });
      if (value) {
        const actions = JSON.parse(value);
        this.pendingActionsSubject.next(actions);
      }
    } catch (error) {
      console.error('Error loading pending actions:', error);
    }
  }

  async cacheLocations(locations: Location[]) {
    await Preferences.set({
      key: 'cached_locations',
      value: JSON.stringify(locations)
    });
    this.cachedLocationsSubject.next(locations);
  }

  async addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp'>) {
    const pendingAction: PendingAction = {
      ...action,
      id: Date.now().toString(),
      timestamp: Date.now()
    };

    const currentActions = this.pendingActionsSubject.value;
    const updatedActions = [...currentActions, pendingAction];

    await Preferences.set({
      key: 'pending_actions',
      value: JSON.stringify(updatedActions)
    });

    this.pendingActionsSubject.next(updatedActions);
  }

  async syncPendingActions() {
    const actions = this.pendingActionsSubject.value;
    if (actions.length === 0) return;

    const completedActions: string[] = [];

    for (const action of actions) {
      try {
        await this.executeAction(action);
        completedActions.push(action.id);
      } catch (error) {
        console.error('Error syncing action:', action, error);
      }
    }

    // Remove completed actions
    const remainingActions = actions.filter(action => !completedActions.includes(action.id));
    await Preferences.set({
      key: 'pending_actions',
      value: JSON.stringify(remainingActions)
    });
    this.pendingActionsSubject.next(remainingActions);

    // Refresh cached data after sync
    if (completedActions.length > 0) {
      this.refreshCachedLocations();
    }
  }

  private async executeAction(action: PendingAction): Promise<void> {
    switch (action.endpoint) {
      case 'locations':
        switch (action.type) {
          case 'create':
            await firstValueFrom(this.apiService.createLocation(action.data));
            break;
          case 'update':
            await firstValueFrom(this.apiService.updateLocation(action.locationId!, action.data));
            break;
          case 'delete':
            await firstValueFrom(this.apiService.deleteLocation(action.locationId!));
            break;
        }
        break;
    }
  }

  async refreshCachedLocations() {
    if (this.isOnlineSubject.value) {
      try {
        const locations = await firstValueFrom(this.apiService.getLocations());
        if (locations) {
          await this.cacheLocations(locations);
        }
      } catch (error) {
        console.error('Error refreshing cached locations:', error);
      }
    }
  }

  getCachedLocations(): Location[] {
    return this.cachedLocationsSubject.value;
  }

  isOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  getPendingActionsCount(): number {
    return this.pendingActionsSubject.value.length;
  }

  async clearAllCache() {
    await Preferences.remove({ key: 'cached_locations' });
    await Preferences.remove({ key: 'pending_actions' });
    this.cachedLocationsSubject.next([]);
    this.pendingActionsSubject.next([]);
  }
}
