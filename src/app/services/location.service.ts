import { Injectable } from '@angular/core';
import { Geolocation, PermissionStatus } from '@capacitor/geolocation';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  constructor(private alertController: AlertController) {}

  /**
   * Konum izinlerini kontrol eder ve gerekirse ister
   */
  async checkLocationPermission(): Promise<boolean> {
    try {
      // Önce mevcut izinleri kontrol et
      const permissionStatus = await Geolocation.checkPermissions();

      if (permissionStatus.location === 'granted') {
        return true;
      }

      if (permissionStatus.location === 'denied') {
        await this.showPermissionDeniedAlert();
        return false;
      }

      // İzin iste
      const requestResult = await Geolocation.requestPermissions();

      if (requestResult.location === 'granted') {
        return true;
      } else {
        await this.showPermissionDeniedAlert();
        return false;
      }
    } catch (error) {
      console.error('Konum izni kontrolünde hata:', error);
      await this.showPermissionDeniedAlert();
      return false;
    }
  }

  /**
   * Mevcut konumu alır
   */
  async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // Önce izinleri kontrol et
      const hasPermission = await this.checkLocationPermission();
      if (!hasPermission) {
        return null;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error('Konum alınamadı:', error);
      await this.showLocationErrorAlert();
      return null;
    }
  }

  /**
   * Konum izni reddedildiğinde gösterilecek uyarı
   */
  private async showPermissionDeniedAlert() {
    const alert = await this.alertController.create({
      header: 'Konum İzni Gerekli',
      message: 'Haritada konumunuzu gösterebilmek için konum iznine ihtiyacımız var. Lütfen ayarlardan konum iznini etkinleştirin.',
      buttons: [
        {
          text: 'Tamam',
          role: 'cancel'
        },
        {
          text: 'Ayarları Aç',
          handler: () => {
            // Android için ayarları aç
            if (typeof (window as any).Android !== 'undefined') {
              (window as any).Android.openAppSettings();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Konum alınamadığında gösterilecek uyarı
   */
  private async showLocationErrorAlert() {
    const alert = await this.alertController.create({
      header: 'Konum Alınamadı',
      message: 'GPS sinyali alınamadı veya konum servisleri kapalı. Lütfen GPS\'i açın ve tekrar deneyin.',
      buttons: [
        {
          text: 'Tamam',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  /**
   * Konum servislerinin açık olup olmadığını kontrol eder
   */
  async isLocationEnabled(): Promise<boolean> {
    try {
      await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 5000
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
