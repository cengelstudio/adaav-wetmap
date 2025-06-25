import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { LoadingController, AlertController, ModalController, ActionSheetController } from '@ionic/angular';
import * as L from 'leaflet';
import { ApiService, Location } from '../services/api.service';
import { OfflineService } from '../services/offline.service';
import { Geolocation } from '@capacitor/geolocation';
import { MapCacheService, MapCacheMetadata } from '../services/map-cache.service';
import { LocationService } from '../services/location.service';
import { LocationFormModalComponent } from './location-form-modal.component';

@Component({
  selector: 'app-map',
  templateUrl: 'map.page.html',
  styleUrls: ['map.page.scss'],
  standalone: false,
})
export class MapPage implements OnInit, AfterViewInit, OnDestroy {
  private map: L.Map | undefined;
  locations: Location[] = [];
  isOnline = true;
  private offlineTileLayer: L.TileLayer | undefined;
  private onlineTileLayer: L.TileLayer | undefined;
  pendingActionsCount = 0;
  cachedMaps: MapCacheMetadata[] = [];
  currentCachedMap: string | null = null;
  downloadProgress = 0;
  isDownloading = false;

  constructor(
    private apiService: ApiService,
    private offlineService: OfflineService,
    private mapCacheService: MapCacheService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private modalController: ModalController,
    private actionSheetController: ActionSheetController,
    private locationService: LocationService
  ) {
    // Global window functions for popup buttons
    (window as any).editLocation = (locationId: string) => {
      this.editLocation(locationId);
    };

    (window as any).deleteLocation = (locationId: string) => {
      this.deleteLocation(locationId);
    };

    // Leaflet icon path fix
    const iconRetinaUrl = 'assets/leaflet/marker-icon-2x.png';
    const iconUrl = 'assets/leaflet/marker-icon.png';
    const shadowUrl = 'assets/leaflet/marker-shadow.png';
    const iconDefault = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;
  }

  ngOnInit() {
    // Network durumunu takip et
    this.offlineService.isOnline$.subscribe(isOnline => {
      this.isOnline = isOnline;
      this.updateMapTiles();
    });

    // Cached locations'ı takip et
    this.offlineService.cachedLocations$.subscribe(locations => {
      this.locations = locations;
      this.updateMapMarkers();
    });

    // Pending actions sayısını takip et
    this.offlineService.pendingActions$.subscribe(actions => {
      this.pendingActionsCount = actions.length;
    });

    // Map cache durumunu takip et
    this.mapCacheService.cachedMaps$.subscribe(maps => {
      this.cachedMaps = maps;
    });

    this.mapCacheService.downloadProgress$.subscribe(progress => {
      this.downloadProgress = progress;
    });

    this.mapCacheService.isDownloading$.subscribe(isDownloading => {
      this.isDownloading = isDownloading;
    });

    this.loadLocations();

    // Konum izinlerini kontrol et
    this.checkLocationPermissions();
  }

  async checkLocationPermissions() {
    const hasPermission = await this.locationService.checkLocationPermission();
    if (hasPermission) {
      // İzin varsa kullanıcı konumunu göster
      setTimeout(() => {
        this.showUserLocation();
      }, 2000); // Harita yüklendikten sonra
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initializeMap();
    }, 100);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  initializeMap() {
    if (this.map) {
      this.map.remove();
    }

    // Haritayı initialize et
    this.map = L.map('map', {
      center: [35.1264, 33.4299], // Kıbrıs koordinatları
      zoom: 10,
      zoomControl: true,
      attributionControl: true
    });

    // Online tile layer
    this.onlineTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
      minZoom: 6
    });

    // Offline tile layer (cached tiles için)
    this.offlineTileLayer = L.tileLayer('', {
      attribution: '© OpenStreetMap contributors (Offline)',
      maxZoom: 18,
      minZoom: 6
    });

    this.updateMapTiles();

    // Harita kontrollerini ekle
    this.addMapControls();

    // Markers'ı yükle
    this.updateMapMarkers();

    // Kullanıcı konumunu göster
    this.showUserLocation();
  }

  updateMapTiles() {
    if (!this.map) return;

    // Mevcut tile layer'ları temizle
    this.map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        this.map!.removeLayer(layer);
      }
    });

    if (this.isOnline && this.onlineTileLayer) {
      // Online mode: Normal tiles
      this.onlineTileLayer.addTo(this.map);
    } else if (this.currentCachedMap) {
      // Offline mode with cached tiles
      this.loadCachedTileLayer(this.currentCachedMap);
    } else {
      // Offline mode: Simple placeholder
      const offlineLayer = L.tileLayer('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', {
        attribution: 'Çevrimdışı Mod - © OpenStreetMap contributors',
        opacity: 0.3
      });
      offlineLayer.addTo(this.map);

      // Basit arka plan rengi ekle
      const mapContainer = this.map.getContainer();
      mapContainer.style.backgroundColor = '#e8f4f8';
    }
  }

  async loadCachedTileLayer(mapName: string) {
    if (!this.map) return;

    const cachedTileLayer = L.tileLayer('', {
      attribution: `© OpenStreetMap contributors (Cached: ${mapName})`,
      maxZoom: 18,
      minZoom: 6
    });

    // Override getTileUrl to use cached tiles
    (cachedTileLayer as any).getTileUrl = async (coords: any) => {
      const cachedUrl = await this.mapCacheService.getCachedTileUrl(coords.x, coords.y, coords.z, mapName);
      return cachedUrl || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    };

    cachedTileLayer.addTo(this.map);
  }

  addMapControls() {
    if (!this.map) return;

    // Sync butonunu ekle (offline mode için)
    const syncControl = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
        const button = L.DomUtil.create('a', 'sync-control', container);
        button.innerHTML = `
          <div class="sync-button ${this.isOnline ? 'online' : 'offline'}">
            <ion-icon name="${this.isOnline ? 'cloud-done' : 'cloud-offline'}"></ion-icon>
            ${this.pendingActionsCount > 0 ? `<span class="badge">${this.pendingActionsCount}</span>` : ''}
          </div>
        `;
        button.title = this.isOnline ? 'Çevrimiçi' : `Çevrimdışı (${this.pendingActionsCount} bekleyen işlem)`;

        L.DomEvent.on(button, 'click', (e) => {
          L.DomEvent.stopPropagation(e);
          this.showSyncStatus();
        });

        return container;
      }
    });

    // Cache butonunu ekle
    const cacheControl = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
        const button = L.DomUtil.create('a', 'cache-control', container);
        button.innerHTML = `
          <div class="cache-button">
            <ion-icon name="download-outline"></ion-icon>
            ${this.cachedMaps.length > 0 ? `<span class="badge">${this.cachedMaps.length}</span>` : ''}
          </div>
        `;
        button.title = 'Harita Cache Yönetimi';

        L.DomEvent.on(button, 'click', (e) => {
          L.DomEvent.stopPropagation(e);
          this.showCacheManagement();
        });

        return container;
      }
    });

    new syncControl({ position: 'topright' }).addTo(this.map);
    new cacheControl({ position: 'topright' }).addTo(this.map);
  }

  async showSyncStatus() {
    let message = '';
    let header = '';

    if (this.isOnline) {
      header = 'Çevrimiçi';
      message = 'İnternet bağlantınız aktif. Veriler gerçek zamanlı olarak senkronize ediliyor.';

      if (this.pendingActionsCount > 0) {
        message += `\n\n${this.pendingActionsCount} bekleyen işlem senkronize ediliyor...`;
      }
    } else {
      header = 'Çevrimdışı Mod';
      message = 'İnternet bağlantınız yok. Yaptığınız değişiklikler yerel olarak kaydediliyor.';

      if (this.pendingActionsCount > 0) {
        message += `\n\n${this.pendingActionsCount} işlem internet bağlantısı geldiğinde senkronize edilecek.`;
      }
    }

    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['Tamam'],
      cssClass: 'ios-alert'
    });

    await alert.present();
  }

  async showUserLocation() {
    try {
      const location = await this.locationService.getCurrentLocation();

      if (!location) {
        console.log('Konum alınamadı veya izin reddedildi');
        return;
      }

      const userLocation: [number, number] = [location.latitude, location.longitude];

      const userIcon = this.getIconForType('user');
      L.marker(userLocation, { icon: userIcon })
        .addTo(this.map!)
        .bindPopup(`
          <div class="ios-popup user-location-popup">
            <div class="popup-header">
              <div class="popup-icon user-icon"></div>
              <div class="popup-title">
                <h3>Mevcut Konumunuz</h3>
                <span class="popup-type">GPS Konumu</span>
              </div>
            </div>
            <div class="popup-content">
              <div class="popup-info">
                <div class="info-row">
                  <div class="info-icon coordinate-icon"></div>
                  <div class="info-details">
                    <span class="info-label">Koordinat</span>
                    <span class="info-value">${userLocation[0].toFixed(6)}, ${userLocation[1].toFixed(6)}</span>
                  </div>
                </div>
                <div class="info-row">
                  <div class="info-icon time-icon"></div>
                  <div class="info-details">
                    <span class="info-label">Güncellenme</span>
                    <span class="info-value">${new Date().toLocaleTimeString('tr-TR')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `, {
          maxWidth: 300,
          className: 'ios-popup-wrapper user-popup'
        });

      // Haritayı kullanıcı konumuna odakla
      this.map!.setView(userLocation, 15);
    } catch (error) {
      console.log('Konum erişimi reddedildi veya mevcut değil:', error);
    }
  }

  async loadLocations() {
    const loading = await this.loadingController.create({
      message: 'Harita verileri yükleniyor...',
      spinner: 'dots',
      duration: 15000
    });
    await loading.present();

    // Test için mock data ekle
    const mockLocations = [
      {
        id: '1',
        title: 'Tuzla Gölü',
        description: 'Kıbrıs\'ın en büyük sulak alanlarından biri',
        type: 'sulak',
        city: 'Lefkoşa',
        latitude: 35.1264,
        longitude: 33.4299
      },
      {
        id: '2',
        title: 'Akdeniz Depo Alanı',
        description: 'Ana depo merkezi',
        type: 'depo',
        city: 'Girne',
        latitude: 35.3414,
        longitude: 33.3152
      }
    ];

    if (this.isOnline) {
      this.apiService.getLocations().subscribe({
        next: async (locations) => {
          this.locations = locations.length > 0 ? locations : mockLocations;
          await this.offlineService.cacheLocations(this.locations);
          this.updateMapMarkers();
          await loading.dismiss();
        },
        error: async (error) => {
          await loading.dismiss();
          console.log('API error, using mock data:', error);
          // Mock data kullan
          this.locations = mockLocations;
          this.updateMapMarkers();
          this.showAlert('Bilgi', 'Test verileri yüklendi. API bağlantısı sağlandığında gerçek veriler görüntülenecek.');
        }
      });
    } else {
      const cachedLocations = this.offlineService.getCachedLocations();
      this.locations = cachedLocations.length > 0 ? cachedLocations : mockLocations;
      this.updateMapMarkers();
      await loading.dismiss();
    }
  }

  updateMapMarkers() {
    if (!this.map) return;

    // Tüm markerları temizle
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        this.map!.removeLayer(layer);
      }
    });

    // Yeni markerları ekle
    this.locations.forEach(location => {
      if (location.latitude && location.longitude) {
        const icon = this.getIconForType(location.type);
        const marker = L.marker([location.latitude, location.longitude], { icon })
          .addTo(this.map!);

        const iconType = location.type.toLowerCase().includes('depot') ? 'warehouse' : 'water';
        const locationTypeText = location.type.toLowerCase().includes('depot') ? 'Depo Alanı' : 'Sulak Alan';

        marker.bindPopup(`
          <div class="ios-popup">
            <div class="popup-header">
              <div class="popup-icon ${iconType}-icon"></div>
              <div class="popup-title">
                <h3>${location.title}</h3>
                <span class="popup-type">${locationTypeText}</span>
              </div>
            </div>
            <div class="popup-content">
              <div class="popup-description">
                <p>${location.description}</p>
              </div>
              <div class="popup-info">
                <div class="info-row">
                  <div class="info-icon location-icon"></div>
                  <div class="info-details">
                    <span class="info-label">Konum</span>
                    <span class="info-value">${location.city}</span>
                  </div>
                </div>
                <div class="info-row">
                  <div class="info-icon coordinate-icon"></div>
                  <div class="info-details">
                    <span class="info-label">Koordinat</span>
                    <span class="info-value">${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `, {
          maxWidth: 300,
          className: 'ios-popup-wrapper'
        });
      }
    });
  }

  getIconForType(type: string): L.DivIcon {
    let color = '#2196f3'; // Varsayılan mavi

    if (type.toLowerCase().includes('depot')) {
      color = '#ff9800'; // Turuncu
    } else if (type.toLowerCase().includes('wetland')) {
      color = '#4caf50'; // Yeşil
    } else if (type.toLowerCase().includes('user') || type.toLowerCase().includes('kullanici')) {
      color = '#f44336'; // Kırmızı
    }

    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  async addNewLocation() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Yeni Konum Ekle',
      subHeader: 'Hangi tip konum eklemek istiyorsunuz?',
      cssClass: 'ios-action-sheet',
      buttons: [
        {
          text: 'Sulak Alan',
          icon: 'water',
          cssClass: 'action-button-primary',
          handler: () => {
            this.openLocationForm('wetland');
          }
        },
        {
          text: 'Depo Alanı',
          icon: 'business',
          cssClass: 'action-button-secondary',
          handler: () => {
            this.openLocationForm('depot');
          }
        },
        {
          text: 'İptal',
          icon: 'close',
          role: 'cancel',
          cssClass: 'action-button-cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async openLocationForm(type: string) {
    let currentLocation: [number, number] | null = null;

    try {
      const coordinates = await Geolocation.getCurrentPosition();
      currentLocation = [coordinates.coords.latitude, coordinates.coords.longitude];
    } catch (error) {
      console.warn('Konum alınamadı:', error);
    }

    const modal = await this.modalController.create({
      component: LocationFormModalComponent,
      cssClass: 'ios-modal',
      componentProps: {
        type: type,
        currentLocation: currentLocation
      },
      presentingElement: await this.modalController.getTop()
    });

    modal.onDidDismiss().then((result) => {
      if (result.data && result.data.confirmed) {
        this.performAddLocation({
          ...result.data.formData,
          latitude: parseFloat(result.data.formData.latitude),
          longitude: parseFloat(result.data.formData.longitude)
        });
      }
    });

    return await modal.present();
  }

  async performAddLocation(locationData: Omit<Location, 'id'>) {
    const loading = await this.loadingController.create({
      message: 'Yeni konum kaydediliyor...',
      spinner: 'crescent',
      duration: 10000
    });
    await loading.present();

    if (this.isOnline) {
      this.apiService.createLocation(locationData).subscribe({
        next: async (location) => {
          await loading.dismiss();
          this.showAlert('Başarılı', 'Konum eklendi!');
          this.loadLocations();
        },
        error: async (error) => {
          await loading.dismiss();
          this.showAlert('Hata', 'Konum eklenemedi!');
        }
      });
    } else {
      // Offline mode: pending action olarak kaydet
      await this.offlineService.addPendingAction({
        type: 'create',
        endpoint: 'locations',
        data: locationData
      });

      await loading.dismiss();
      this.showAlert('Çevrimdışı', 'Konum çevrimdışı olarak kaydedildi. İnternet bağlantısı sağlandığında senkronize edilecek.');
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      cssClass: 'ios-alert',
      buttons: [
        {
          text: 'Tamam',
          cssClass: 'alert-button-confirm'
        }
      ]
    });
    await alert.present();
  }

  // Popup button functions
  editLocation(locationId: string) {
    const location = this.locations.find(loc => loc.id === locationId);
    if (location) {
      console.log('Edit location:', location);
      // TODO: Open edit modal
      this.showAlert('Düzenle', `${location.title} düzenleme özelliği yakında eklenecek.`);
    }
  }

  deleteLocation(locationId: string) {
    const location = this.locations.find(loc => loc.id === locationId);
    if (location) {
      console.log('Delete location:', location);
      // TODO: Implement delete functionality
      this.showAlert('Sil', `${location.title} silme özelliği yakında eklenecek.`);
    }
  }

  async showCacheManagement() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Harita Cache Yönetimi',
      subHeader: `${this.cachedMaps.length} harita önbelleğe alındı`,
      cssClass: 'cache-action-sheet',
      buttons: [
        {
          text: 'Mevcut Alanı İndir',
          icon: 'download-outline',
          handler: () => {
            this.downloadCurrentArea();
          }
        },
        {
          text: 'Cache Edilmiş Haritalar',
          icon: 'list-outline',
          handler: () => {
            this.showCachedMaps();
          }
        },
        {
          text: 'Cache Temizle',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.clearCache();
          }
        },
        {
          text: 'İptal',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async downloadCurrentArea() {
    if (!this.map) return;

    const bounds = this.map.getBounds();
    const zoom = this.map.getZoom();

    const alert = await this.alertController.create({
      header: 'Harita Alanını İndir',
      subHeader: 'Bu alan için harita önbelleğe alınacak',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Harita adı (örn: Kıbrıs Merkez)',
          value: 'Kıbrıs Alanı ' + new Date().toLocaleDateString('tr-TR')
        }
      ],
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'İndir',
          handler: async (data) => {
            if (data.name) {
              await this.startMapDownload(data.name, bounds, Math.max(6, zoom - 2), Math.min(16, zoom + 2));
            }
          }
        }
      ],
      cssClass: 'ios-alert'
    });

    await alert.present();
  }

  async startMapDownload(name: string, bounds: any, minZoom: number, maxZoom: number) {
    const loading = await this.loadingController.create({
      message: 'Harita indiriliyor...',
      duration: 0
    });
    await loading.present();

    try {
      await this.mapCacheService.downloadMapArea(name, {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      }, minZoom, maxZoom);

      await loading.dismiss();
      this.showAlert('Başarılı', 'Harita başarıyla indirildi!');
    } catch (error) {
      await loading.dismiss();
      this.showAlert('Hata', 'Harita indirilemedi: ' + error);
    }
  }

  async showCachedMaps() {
    if (this.cachedMaps.length === 0) {
      this.showAlert('Bilgi', 'Henüz önbelleğe alınmış harita bulunmuyor.');
      return;
    }

    const buttons = this.cachedMaps.map(map => ({
      text: `${map.name} (${map.sizeInMB.toFixed(1)} MB)`,
      handler: () => {
        this.selectCachedMap(map);
      }
    }));

    buttons.push({
      text: 'İptal',
      handler: () => {}
    });

    const actionSheet = await this.actionSheetController.create({
      header: 'Önbelleğe Alınmış Haritalar',
      buttons: buttons as any,
      cssClass: 'ios-action-sheet'
    });

    await actionSheet.present();
  }

  async selectCachedMap(map: MapCacheMetadata) {
    this.currentCachedMap = map.name;
    this.updateMapTiles();

    // Map bounds'ını cached map bounds'ına ayarla
    if (this.map) {
      this.map.fitBounds([
        [map.bounds.south, map.bounds.west],
        [map.bounds.north, map.bounds.east]
      ]);
    }

    this.showAlert('Başarılı', `"${map.name}" haritası yüklendi!`);
  }

  async clearCache() {
    const alert = await this.alertController.create({
      header: 'Cache Temizle',
      message: 'Tüm önbelleğe alınmış haritalar silinecek. Bu işlem geri alınamaz.',
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Temizle',
          role: 'destructive',
          handler: async () => {
            try {
              await this.mapCacheService.clearAllCache();
              this.currentCachedMap = null;
              this.updateMapTiles();
              this.showAlert('Başarılı', 'Tüm cache temizlendi!');
            } catch (error) {
              this.showAlert('Hata', 'Cache temizlenemedi: ' + error);
            }
          }
        }
      ],
      cssClass: 'ios-alert'
    });

    await alert.present();
  }
}
