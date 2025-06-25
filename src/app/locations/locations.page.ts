import { Component, OnInit } from '@angular/core';
import { LoadingController, AlertController, ActionSheetController } from '@ionic/angular';
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
  selectedFilter = 'all';
  isOnline = true;
  isSyncing = false;
  pendingActionsCount = 0;

  constructor(
    private apiService: ApiService,
    private offlineService: OfflineService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController
  ) {}

  ngOnInit() {
    this.offlineService.isOnline$.subscribe(isOnline => {
      this.isOnline = isOnline;
    });

    this.offlineService.cachedLocations$.subscribe(locations => {
      this.locations = locations;
      this.filterLocations();
    });

    this.offlineService.isSyncing$.subscribe(isSyncing => {
      this.isSyncing = isSyncing;
    });

    this.offlineService.pendingActions$.subscribe(actions => {
      this.pendingActionsCount = actions.length;
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
        (location.description && location.description.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        location.city.toLowerCase().includes(this.searchTerm.toLowerCase());

      let matchesFilter = true;
      if (this.selectedFilter !== 'all') {
        matchesFilter = location.type.toLowerCase() === this.selectedFilter.toLowerCase();
      }

      return matchesSearch && matchesFilter;
    });
  }

  onSearchChange() {
    this.filterLocations();
  }

  onFilterChange(event: any) {
    this.selectedFilter = event.detail.value;
    this.filterLocations();
  }

  getLocationIcon(type: string): string {
    if (type.toLowerCase().includes('depo')) {
      return 'storefront';
    }
    return 'water';
  }

  getLocationIconClass(type: string): string {
    if (type.toLowerCase().includes('depo')) {
      return 'storage';
    }
    return 'water';
  }

  async openLocationOptions(location: Location) {
    const actionSheet = await this.actionSheetController.create({
      header: location.title,
      cssClass: 'location-action-sheet',
      buttons: [
        {
          text: 'Düzenle',
          icon: 'create-outline',
          handler: () => {
            this.editLocation(location);
          }
        },
        {
          text: 'Sil',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.deleteLocation(location);
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

  async editLocation(location: Location) {
    const alert = await this.alertController.create({
      header: 'Konum Düzenle',
      subHeader: `"${location.title}" konumunu düzenleyin`,
      cssClass: 'ios-alert',
      inputs: [
        {
          name: 'title',
          type: 'text',
          value: location.title,
          placeholder: 'Başlık',
          attributes: {
            required: true
          }
        },
        {
          name: 'description',
          type: 'textarea',
          value: location.description,
          placeholder: 'Açıklama'
        },
        {
          name: 'city',
          type: 'text',
          value: location.city,
          placeholder: 'Şehir',
          attributes: {
            required: true
          }
        },
        {
          name: 'latitude',
          type: 'number',
          value: location.latitude.toString(),
          placeholder: 'Enlem (örn: 35.1264)',
          attributes: {
            step: 'any',
            required: true
          }
        },
        {
          name: 'longitude',
          type: 'number',
          value: location.longitude.toString(),
          placeholder: 'Boylam (örn: 33.4299)',
          attributes: {
            step: 'any',
            required: true
          }
        }
      ],
      buttons: [
        {
          text: 'İptal',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Güncelle',
          cssClass: 'alert-button-confirm',
          handler: (data) => {
            if (data.title && data.city && data.latitude && data.longitude) {
              this.performUpdateLocation(location.id, {
                ...data,
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
                type: location.type // Mevcut tipi koru
              });
              return true;
            } else {
              this.showAlert('Hata', 'Tüm gerekli alanlar doldurulmalıdır!');
              return false;
            }
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
      subHeader: 'Bu işlem geri alınamaz',
      message: `"${location.title}" konumunu kalıcı olarak silmek istediğinizden emin misiniz?`,
      cssClass: 'ios-alert-destructive',
      buttons: [
        {
          text: 'İptal',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Sil',
          role: 'destructive',
          cssClass: 'alert-button-destructive',
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
    this.selectedFilter = 'all';
    this.filterLocations();
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
}
