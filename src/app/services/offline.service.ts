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
  retryCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private isOnlineSubject = new BehaviorSubject<boolean>(true);
  private pendingActionsSubject = new BehaviorSubject<PendingAction[]>([]);
  private cachedLocationsSubject = new BehaviorSubject<Location[]>([]);
  private isSyncingSubject = new BehaviorSubject<boolean>(false);
  private lastSyncTime = new BehaviorSubject<number>(0);

  isOnline$ = this.isOnlineSubject.asObservable();
  pendingActions$ = this.pendingActionsSubject.asObservable();
  cachedLocations$ = this.cachedLocationsSubject.asObservable();
  isSyncing$ = this.isSyncingSubject.asObservable();
  lastSyncTime$ = this.lastSyncTime.asObservable();

  constructor(private apiService: ApiService) {
    this.initializeNetworkListener();
    this.loadCachedData();
    this.loadPendingActions();
    this.loadLastSyncTime();
  }

  async initializeNetworkListener() {
    const status = await Network.getStatus();
    this.isOnlineSubject.next(status.connected);

    Network.addListener('networkStatusChange', (status) => {
      const wasOffline = !this.isOnlineSubject.value;
      this.isOnlineSubject.next(status.connected);

      // Offline'dan online'a geçişte otomatik sync
      if (wasOffline && status.connected) {
        console.log('Network restored, starting auto-sync...');
        setTimeout(() => {
          this.syncPendingActions();
          this.refreshCachedLocations();
        }, 1000); // 1 saniye gecikme ile sync
      }
    });
  }

  async loadCachedData() {
    try {
      const { value } = await Preferences.get({ key: 'cached_locations' });
      if (value) {
        const locations = JSON.parse(value);
        this.cachedLocationsSubject.next(locations);
        console.log(`Loaded ${locations.length} cached locations`);
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
        console.log(`Loaded ${actions.length} pending actions`);
      }
    } catch (error) {
      console.error('Error loading pending actions:', error);
    }
  }

  async loadLastSyncTime() {
    try {
      const { value } = await Preferences.get({ key: 'last_sync_time' });
      if (value) {
        this.lastSyncTime.next(parseInt(value));
      }
    } catch (error) {
      console.error('Error loading last sync time:', error);
    }
  }

  async saveLastSyncTime() {
    const now = Date.now();
    this.lastSyncTime.next(now);
    await Preferences.set({
      key: 'last_sync_time',
      value: now.toString()
    });
  }

  async cacheLocations(locations: Location[]) {
    await Preferences.set({
      key: 'cached_locations',
      value: JSON.stringify(locations)
    });
    this.cachedLocationsSubject.next(locations);
    console.log(`Cached ${locations.length} locations`);
  }

  async addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp'>) {
    const pendingAction: PendingAction = {
      ...action,
      id: Date.now().toString(),
      timestamp: Date.now(),
      retryCount: 0
    };

    const currentActions = this.pendingActionsSubject.value;
    const updatedActions = [...currentActions, pendingAction];

    await Preferences.set({
      key: 'pending_actions',
      value: JSON.stringify(updatedActions)
    });

    this.pendingActionsSubject.next(updatedActions);
    console.log('Added pending action:', pendingAction.type, pendingAction.endpoint);
  }

  async syncPendingActions() {
    const actions = this.pendingActionsSubject.value;
    if (actions.length === 0 || !this.isOnlineSubject.value || this.isSyncingSubject.value) {
      return;
    }

    console.log(`Starting sync of ${actions.length} pending actions...`);
    this.isSyncingSubject.next(true);

    const completedActions: string[] = [];
    const failedActions: PendingAction[] = [];

    for (const action of actions) {
      try {
        await this.executeAction(action);
        completedActions.push(action.id);
        console.log('Synced action:', action.type, action.endpoint, action.id);
      } catch (error) {
        console.error('Error syncing action:', action, error);

        // Retry logic
        const retryCount = (action.retryCount || 0) + 1;
        if (retryCount < 3) { // Maximum 3 retry attempts
          failedActions.push({
            ...action,
            retryCount
          });
        } else {
          console.error('Action failed after max retries:', action);
          // Optionally remove failed actions after max retries
        }
      }
    }

    // Update pending actions (remove completed, update failed with retry count)
    const remainingActions = actions
      .filter(action => !completedActions.includes(action.id))
      .map(action => {
        const failedAction = failedActions.find(fa => fa.id === action.id);
        return failedAction || action;
      });

    await Preferences.set({
      key: 'pending_actions',
      value: JSON.stringify(remainingActions)
    });
    this.pendingActionsSubject.next(remainingActions);

    // Update last sync time
    if (completedActions.length > 0) {
      await this.saveLastSyncTime();
      console.log(`Sync completed: ${completedActions.length} success, ${failedActions.length} failed`);
    }

    this.isSyncingSubject.next(false);

    // Refresh cached data after successful sync
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
        console.log('Refreshing cached locations...');
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

  isSyncing(): boolean {
    return this.isSyncingSubject.value;
  }

  getPendingActionsCount(): number {
    return this.pendingActionsSubject.value.length;
  }

  getLastSyncTime(): number {
    return this.lastSyncTime.value;
  }

  getTimeSinceLastSync(): string {
    const lastSync = this.lastSyncTime.value;
    if (!lastSync) return 'Hiç senkronize edilmedi';

    const now = Date.now();
    const diff = now - lastSync;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} gün önce`;
    if (hours > 0) return `${hours} saat önce`;
    if (minutes > 0) return `${minutes} dakika önce`;
    return 'Az önce';
  }

  async clearAllCache() {
    await Preferences.remove({ key: 'cached_locations' });
    await Preferences.remove({ key: 'pending_actions' });
    await Preferences.remove({ key: 'last_sync_time' });
    this.cachedLocationsSubject.next([]);
    this.pendingActionsSubject.next([]);
    this.lastSyncTime.next(0);
    console.log('All cache cleared');
  }

  // Manual sync trigger
  async forceSyncPendingActions() {
    if (this.isOnlineSubject.value) {
      await this.syncPendingActions();
    } else {
      throw new Error('Cannot sync while offline');
    }
  }
}
