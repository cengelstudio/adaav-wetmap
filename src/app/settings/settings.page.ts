import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ActionSheetController } from '@ionic/angular';
import { AuthService, User } from '../services/auth.service';
import { OfflineService } from '../services/offline.service';
import { MapCacheService, MapCacheMetadata } from '../services/map-cache.service';

@Component({
  selector: 'app-settings',
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {
  currentUser: User | null = null;
  isAdmin = false;
  isOnline = true;
  pendingActionsCount = 0;
  cachedMaps: MapCacheMetadata[] = [];
  cachedMapsCount = 0;
  totalCacheSize = 0;

  constructor(
    private authService: AuthService,
    private offlineService: OfflineService,
    private mapCacheService: MapCacheService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private actionSheetController: ActionSheetController
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isAdmin = this.authService.isAdmin();
    });

    this.offlineService.isOnline$.subscribe(isOnline => {
      this.isOnline = isOnline;
    });

    this.offlineService.pendingActions$.subscribe(actions => {
      this.pendingActionsCount = actions.length;
    });

    // Map cache durumunu takip et
    this.mapCacheService.cachedMaps$.subscribe(maps => {
      this.cachedMaps = maps;
      this.cachedMapsCount = maps.length;
      this.totalCacheSize = maps.reduce((total, map) => total + map.sizeInMB, 0);
    });
  }

  navigateToUsers() {
    this.router.navigate(['/user-management']);
  }

  async createUser() {
    const alert = await this.alertController.create({
      header: 'Yeni Kullanıcı Oluştur',
      message: 'Kullanıcı yönetimi sayfasına gitmek ister misiniz?',
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Git',
          handler: () => {
            this.navigateToUsers();
          }
        }
      ]
    });

    await alert.present();
  }

  async sendSupportEmail() {
    const alert = await this.alertController.create({
      header: 'Destek İsteği',
      inputs: [
        {
          name: 'subject',
          type: 'text',
          placeholder: 'Konu'
        },
        {
          name: 'message',
          type: 'textarea',
          placeholder: 'Mesajınız'
        }
      ],
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Gönder',
          handler: (data) => {
            if (data.subject && data.message) {
              this.performSendEmail(data.subject, data.message);
              return true;
            } else {
              this.showAlert('Hata', 'Konu ve mesaj alanları gereklidir!');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  performSendEmail(subject: string, message: string) {
    const userInfo = this.currentUser ?
      `\n\nKullanıcı: ${this.currentUser.name} (${this.currentUser.username})` : '';

    const body = `${message}${userInfo}`;
    const mailtoUrl = `mailto:kktc@metehansaral.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.open(mailtoUrl, '_blank');
  }

  async syncPendingActions() {
    if (this.pendingActionsCount === 0) {
      this.showAlert('Bilgi', 'Senkronize edilecek işlem bulunmamaktadır.');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Senkronize ediliyor...'
    });
    await loading.present();

    try {
      await this.offlineService.syncPendingActions();
      await loading.dismiss();
      this.showAlert('Başarılı', 'Bekleyen işlemler senkronize edildi!');
    } catch (error) {
      await loading.dismiss();
      this.showAlert('Hata', 'Senkronizasyon sırasında hata oluştu!');
    }
  }

  async clearCache() {
    const alert = await this.alertController.create({
      header: 'Önbellek Temizle',
      message: 'Tüm önbellek verileri silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Temizle',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Önbellek temizleniyor...'
            });
            await loading.present();

            try {
              await this.offlineService.clearAllCache();
              await loading.dismiss();
              this.showAlert('Başarılı', 'Önbellek temizlendi!');
            } catch (error) {
              await loading.dismiss();
              this.showAlert('Hata', 'Önbellek temizlenirken hata oluştu!');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Çıkış Yap',
      message: 'Çıkış yapmak istediğinizden emin misiniz?',
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Çıkış Yap',
          role: 'destructive',
          handler: async () => {
            await this.authService.logout();
            this.router.navigate(['/login']);
          }
        }
      ]
    });

    await alert.present();
  }

  async showAbout() {
    const alert = await this.alertController.create({
      header: 'AdaAv: Sulak Haritası Hakkında',
      message: `
        <p><strong>Sürüm:</strong> 1.0.0</p>
        <p><strong>Geliştirici:</strong> Metehan Saral</p>
        <p><strong>E-posta:</strong> kktc@metehansaral.com</p>
        <br>
        <p>Kuzey Kıbrıs Türk Cumhuriyeti'ndeki sulak alanları ve depoları keşfetmek için geliştirilmiş bir mobil uygulamadır.</p>
        <br>
        <p>Uygulama offline çalışabilir ve internet bağlantısı geri geldiğinde verilerinizi otomatik olarak senkronize eder.</p>
      `,
      buttons: ['Tamam']
    });

    await alert.present();
  }

  async showCachedMaps() {
    if (this.cachedMaps.length === 0) {
      this.showAlert('Bilgi', 'Henüz önbelleğe alınmış harita bulunmuyor.');
      return;
    }

    const buttons = this.cachedMaps.map(map => ({
      text: `${map.name} (${map.sizeInMB.toFixed(1)} MB)`,
      handler: () => {
        this.showMapDetails(map);
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

  async showMapDetails(map: MapCacheMetadata) {
    const alert = await this.alertController.create({
      header: map.name,
      message: `
        <p><strong>Boyut:</strong> ${map.sizeInMB.toFixed(1)} MB</p>
        <p><strong>Tile Sayısı:</strong> ${map.tileCount}</p>
        <p><strong>Zoom Seviyesi:</strong> ${map.minZoom} - ${map.maxZoom}</p>
        <p><strong>İndirilme Tarihi:</strong> ${new Date(map.downloadDate).toLocaleDateString('tr-TR')}</p>
      `,
      buttons: [
        {
          text: 'Sil',
          role: 'destructive',
          handler: () => {
            this.deleteMap(map);
          }
        },
        {
          text: 'Kapat',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  async deleteMap(map: MapCacheMetadata) {
    const alert = await this.alertController.create({
      header: 'Haritayı Sil',
      message: `"${map.name}" haritası silinecek. Bu işlem geri alınamaz.`,
      buttons: [
        {
          text: 'İptal',
          role: 'cancel'
        },
        {
          text: 'Sil',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Harita siliniyor...'
            });
            await loading.present();

            try {
              await this.mapCacheService.deleteCachedMap(map.name);
              await loading.dismiss();
              this.showAlert('Başarılı', 'Harita silindi!');
            } catch (error) {
              await loading.dismiss();
              this.showAlert('Hata', 'Harita silinirken hata oluştu!');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async clearMapCache() {
    const alert = await this.alertController.create({
      header: 'Harita Cache Temizle',
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
            const loading = await this.loadingController.create({
              message: 'Harita cache temizleniyor...'
            });
            await loading.present();

            try {
              await this.mapCacheService.clearAllCache();
              await loading.dismiss();
              this.showAlert('Başarılı', 'Harita cache temizlendi!');
            } catch (error) {
              await loading.dismiss();
              this.showAlert('Hata', 'Cache temizlenirken hata oluştu!');
            }
          }
        }
      ]
    });

    await alert.present();
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
