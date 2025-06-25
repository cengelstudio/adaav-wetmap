import { Component, OnInit } from '@angular/core';
import { LoadingController, AlertController } from '@ionic/angular';
import { ApiService, Location } from '../services/api.service';
import { OfflineService } from '../services/offline.service';

@Component({
  selector: 'app-locations',
  templateUrl: 'locations.page.html',
  styleUrls: ['locations.page.scss'],
  standalone: false,
})
export class LocationsPage implements OnInit {
  locations: Location[] = [];
  filteredLocations: Location[] = [];
  searchTerm = '';
  selectedType = '';
  selectedCity = '';
  isOnline = true;

  constructor(
    private apiService: ApiService,
    private offlineService: OfflineService,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.offlineService.isOnline$.subscribe(isOnline => {
      this.isOnline = isOnline;
    });

    this.offlineService.cachedLocations$.subscribe(locations => {
      this.locations = locations;
      this.filterLocations();
    });

    this.loadLocations();
  }

  async loadLocations() {
    const loading = await this.loadingController.create({
      message: 'Konumlar yükleniyor...'
    });
    await loading.present();

    if (this.isOnline) {
      this.apiService.getLocations().subscribe({
        next: async (locations) => {
          this.locations = locations;
          await this.offlineService.cacheLocations(locations);
          this.filterLocations();
          await loading.dismiss();
        },
        error: async (error) => {
          await loading.dismiss();
          this.locations = this.offlineService.getCachedLocations();
          this.filterLocations();
          this.showAlert('Uyarı', 'İnternet bağlantısı yok. Önbellek verileri kullanılıyor.');
        }
      });
    } else {
      this.locations = this.offlineService.getCachedLocations();
      this.filterLocations();
      await loading.dismiss();
    }
  }

  filterLocations() {
    this.filteredLocations = this.locations.filter(location => {
      const matchesSearch = !this.searchTerm ||
        location.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        location.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        location.city.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesType = !this.selectedType || location.type === this.selectedType;
      const matchesCity = !this.selectedCity || location.city === this.selectedCity;

      return matchesSearch && matchesType && matchesCity;
    });
  }

  onSearchChange() {
    this.filterLocations();
  }

  onTypeChange() {
    this.filterLocations();
  }

  onCityChange() {
    this.filterLocations();
  }

  getUniqueTypes(): string[] {
    return [...new Set(this.locations.map(loc => loc.type))];
  }

  getUniqueCities(): string[] {
    return [...new Set(this.locations.map(loc => loc.city))];
  }

  getTypeIcon(type: string): string {
    return type.toLowerCase().includes('depo') ? 'cube' : 'water';
  }

  getTypeColor(type: string): string {
    return type.toLowerCase().includes('depo') ? 'warning' : 'primary';
  }

  async editLocation(location: Location) {
    const alert = await this.alertController.create({
      header: 'Konum Düzenle',
      inputs: [
        {
          name: 'title',
          type: 'text',
          value: location.title,
          placeholder: 'Başlık'
        },
        {
          name: 'description',
          type: 'textarea',
          value: location.description,
          placeholder: 'Açıklama'
        },
        {
          name: 'latitude',
          type: 'number',
          value: location.latitude.toString(),
          placeholder: 'Enlem'
        },
        {
          name: 'longitude',
          type: 'number',
          value: location.longitude.toString(),
          placeholder: 'Boylam'
        },
        {
          name: 'type',
          type: 'text',
          value: location.type,
          placeholder: 'Tip'
        },
        {
          name: 'city',
          type: 'text',
          value: location.city,
          placeholder: 'Şehir'
        }
      ],
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Güncelle',
          handler: (data) => {
            this.performUpdateLocation(location.id, {
              ...data,
              latitude: parseFloat(data.latitude),
              longitude: parseFloat(data.longitude)
            });
          }
        }
      ]
    });

    await alert.present();
  }

  async performUpdateLocation(locationId: string, data: Partial<Location>) {
    const loading = await this.loadingController.create({
      message: 'Konum güncelleniyor...'
    });
    await loading.present();

    if (this.isOnline) {
      this.apiService.updateLocation(locationId, data).subscribe({
        next: async (location) => {
          await loading.dismiss();
          this.showAlert('Başarılı', 'Konum güncellendi!');
          this.loadLocations();
        },
        error: async (error) => {
          await loading.dismiss();
          this.showAlert('Hata', 'Konum güncellenemedi!');
        }
      });
    } else {
      await this.offlineService.addPendingAction({
        type: 'update',
        endpoint: 'locations',
        locationId: locationId,
        data: data
      });

      await loading.dismiss();
      this.showAlert('Çevrimdışı', 'Güncelleme çevrimdışı olarak kaydedildi. İnternet bağlantısı sağlandığında senkronize edilecek.');
    }
  }

  async deleteLocation(location: Location) {
    const alert = await this.alertController.create({
      header: 'Konum Sil',
      message: `"${location.title}" konumunu silmek istediğinizden emin misiniz?`,
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Sil',
          role: 'destructive',
          handler: () => {
            this.performDeleteLocation(location.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async performDeleteLocation(locationId: string) {
    const loading = await this.loadingController.create({
      message: 'Konum siliniyor...'
    });
    await loading.present();

    if (this.isOnline) {
      this.apiService.deleteLocation(locationId).subscribe({
        next: async (response) => {
          await loading.dismiss();
          this.showAlert('Başarılı', 'Konum silindi!');
          this.loadLocations();
        },
        error: async (error) => {
          await loading.dismiss();
          this.showAlert('Hata', 'Konum silinemedi!');
        }
      });
    } else {
      await this.offlineService.addPendingAction({
        type: 'delete',
        endpoint: 'locations',
        locationId: locationId,
        data: null
      });

      await loading.dismiss();
      this.showAlert('Çevrimdışı', 'Silme işlemi çevrimdışı olarak kaydedildi. İnternet bağlantısı sağlandığında senkronize edilecek.');
    }
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedType = '';
    this.selectedCity = '';
    this.filterLocations();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['Tamam']
    });
    await alert.present();
  }
}
