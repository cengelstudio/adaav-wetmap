import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  username: string = '';
  password: string = '';
  showPassword: boolean = false;
  isOnline: boolean = true;
  saveCredentials: boolean = true; // Offline destek için credentials kaydet

  constructor(
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    // Network durumunu takip et
    this.authService.isOnline$.subscribe(isOnline => {
      this.isOnline = isOnline;
    });

    // Auth init'i bekle, sonra auto-login kontrol et
    this.checkAutoLogin();
  }

  async checkAutoLogin() {
    // Auth servisinin initialize olmasını bekle
    let attempts = 0;
    while (!this.authService.isAuthInitialized() && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    // Eğer zaten giriş yapmışsa ana sayfaya yönlendir
    if (this.authService.isAuthenticated()) {
      console.log('Auto-login successful, redirecting to main page');
      this.router.navigate(['/tabs/map'], { replaceUrl: true });
    }
  }

  async login() {
    if (!this.username || !this.password) {
      this.showAlert('Hata', 'Kullanıcı adı ve şifre gereklidir!');
      return;
    }

    const loading = await this.loadingController.create({
      message: this.isOnline ? 'Oturumunuz açılıyor...' : 'Çevrimdışı oturum açılıyor...',
      spinner: 'circular',
      duration: 10000
    });
    await loading.present();

    this.authService.login(this.username, this.password).subscribe({
      next: async (response) => {
        await loading.dismiss();

        // Offline destek için credentials kaydet
        if (this.saveCredentials) {
          await this.authService.setAuth(
            response.token,
            response.user,
            { username: this.username, password: this.password }
          );
        }

        // Authentication state'in güncellenmesini bekle
        setTimeout(() => {
          this.router.navigate(['/tabs/map'], { replaceUrl: true });
        }, 100);
      },
      error: async (error) => {
        await loading.dismiss();
        const errorMessage = this.isOnline ?
          'Kullanıcı adı veya şifre hatalı!' :
          'Çevrimdışı giriş başarısız! Daha önce bu bilgilerle giriş yapmış olmanız gerekiyor.';
        this.showAlert('Giriş Hatası', errorMessage);
      }
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['Tamam'],
      cssClass: 'ios-alert'
    });
    await alert.present();
  }
}
