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

  constructor(
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    // Eğer zaten giriş yapmışsa ana sayfaya yönlendir
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/tabs/map']);
    }
  }

  async login() {
    if (!this.username || !this.password) {
      this.showAlert('Hata', 'Kullanıcı adı ve şifre gereklidir!');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Giriş yapılıyor...'
    });
    await loading.present();

    this.authService.login(this.username, this.password).subscribe({
      next: async (response) => {
        await loading.dismiss();
        // Authentication state'in güncellenmesini bekle
        setTimeout(() => {
          this.router.navigate(['/tabs/map'], { replaceUrl: true });
        }, 100);
      },
      error: async (error) => {
        await loading.dismiss();
        this.showAlert('Giriş Hatası', 'Kullanıcı adı veya şifre hatalı!');
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
      buttons: ['Tamam']
    });
    await alert.present();
  }
}
