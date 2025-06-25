import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { LoadingController, AlertController, ModalController } from '@ionic/angular';
import * as L from 'leaflet';
import { ApiService, Location } from '../services/api.service';
import { OfflineService } from '../services/offline.service';
import { Geolocation } from '@capacitor/geolocation';

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

  constructor(
    private apiService: ApiService,
    private offlineService: OfflineService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private modalController: ModalController
  ) {
    // Global window functions for popup buttons
    (window as any).editLocation = (locationId: string) => {
      this.editLocation(locationId);
    };

    (window as any).deleteLocation = (locationId: string) => {
      this.deleteLocation(locationId);
    };
  }

  ngOnInit() {
    // Online durumunu dinle
    this.offlineService.isOnline$.subscribe(isOnline => {
      this.isOnline = isOnline;
    });

    // Cached locations'ı dinle
    this.offlineService.cachedLocations$.subscribe(locations => {
      this.locations = locations;
      if (this.map) {
        this.updateMapMarkers();
      }
    });
  }

  ngAfterViewInit() {
    // Dom'un yüklenmesini bekle
    setTimeout(() => {
      this.initializeMap();
      this.loadLocations();
    }, 100);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  initializeMap() {
    try {
      // DOM elementinin varlığını kontrol et
      const mapElement = document.getElementById('mapId');
      if (!mapElement) {
        console.error('Map element not found');
        return;
      }

      // KKTC koordinatları
      const kktcCenter: [number, number] = [35.1264, 33.4299];

      this.map = L.map('mapId', {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true
      }).setView(kktcCenter, 10);

      // OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        minZoom: 8
      }).addTo(this.map);

      // Leaflet icon fix for Angular
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
        iconUrl: 'assets/leaflet/marker-icon.png',
        shadowUrl: 'assets/leaflet/marker-shadow.png',
      });

      // Harita boyutunu resize et
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 100);

      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  async loadLocations() {
    const loading = await this.loadingController.create({
      message: 'Konumlar yükleniyor...'
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

        marker.bindPopup(`
          <div class="custom-popup">
            <h6>${location.title}</h6>
            <p>${location.description}</p>
            <p><strong>Tip:</strong> ${location.type}</p>
            <p><strong>Şehir:</strong> ${location.city}</p>
            <div class="popup-buttons">
              <button onclick="window.editLocation('${location.id}')">Düzenle</button>
              <button onclick="window.deleteLocation('${location.id}')">Sil</button>
            </div>
          </div>
        `);
      }
    });
  }

  getIconForType(type: string): L.DivIcon {
    const color = type.toLowerCase().includes('depo') ? '#ff9800' : '#2196f3'; // turuncu/mavi

    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  async addNewLocation() {
    const actionSheet = await this.alertController.create({
      header: 'Yeni Konum Ekle',
      message: 'Hangi tip konum eklemek istiyorsunuz?',
      buttons: [
        {
          text: 'Sulak Alan',
          handler: () => {
            this.openLocationForm('sulak');
          }
        },
        {
          text: 'Depo',
          handler: () => {
            this.openLocationForm('depo');
          }
        },
        {
          text: 'İptal',
          role: 'cancel'
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

    const alert = await this.alertController.create({
      header: `Yeni ${type === 'sulak' ? 'Sulak Alan' : 'Depo'} Ekle`,
      inputs: [
        {
          name: 'title',
          type: 'text',
          placeholder: 'Başlık'
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Açıklama'
        },
        {
          name: 'latitude',
          type: 'number',
          placeholder: 'Enlem',
          value: currentLocation ? currentLocation[0].toString() : ''
        },
        {
          name: 'longitude',
          type: 'number',
          placeholder: 'Boylam',
          value: currentLocation ? currentLocation[1].toString() : ''
        },
        {
          name: 'city',
          type: 'text',
          placeholder: 'Şehir'
        }
      ],
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Ekle',
          handler: (data) => {
            if (data.title && data.latitude && data.longitude) {
              this.performAddLocation({
                ...data,
                type: type,
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude)
              });
              return true;
            } else {
              this.showAlert('Hata', 'Tüm alanlar gereklidir!');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async performAddLocation(locationData: Omit<Location, 'id'>) {
    const loading = await this.loadingController.create({
      message: 'Konum ekleniyor...'
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
      buttons: ['Tamam']
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
}
