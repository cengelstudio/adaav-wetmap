import { Component } from '@angular/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Platform } from '@ionic/angular';
import { AuthService } from './services/auth.service';
import { OfflineService } from './services/offline.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private authService: AuthService,
    private offlineService: OfflineService
  ) {
    this.initializeApp();
  }

  async initializeApp() {
    if (this.platform.is('capacitor')) {
      try {
        // Status bar ayarları
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
      } catch (error) {
        console.log('Status bar settings error:', error);
      }
    }

    // Offline service'i başlat
    try {
      await this.offlineService.initializeNetworkListener();
      console.log('Offline service initialized');
    } catch (error) {
      console.error('Offline service initialization error:', error);
    }

    // Auth service'i başlat (auto-login için)
    try {
      await this.authService.loadStoredAuth();
      console.log('Auth service initialized');
    } catch (error) {
      console.error('Auth service initialization error:', error);
    }

    // Network durumunu takip et ve sync işlemlerini başlat
    this.offlineService.isOnline$.subscribe(isOnline => {
      console.log('Network status changed:', isOnline ? 'Online' : 'Offline');

      if (isOnline) {
        // Online olduğunda pending actions'ları sync et
        this.offlineService.syncPendingActions();

        // Cached data'yı refresh et
        this.offlineService.refreshCachedLocations();
      }
    });
  }
}
