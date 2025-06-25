import { Component, OnInit } from '@angular/core';
import { LoadingController, AlertController, ModalController } from '@ionic/angular';
import { ApiService, User } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.page.html',
  styleUrls: ['./user-management.page.scss'],
  standalone: false,
})
export class UserManagementPage implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm = '';
  isAdmin = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    this.isAdmin = this.authService.isAdmin();
    if (this.isAdmin) {
      this.loadUsers();
    }
  }

  async loadUsers() {
    const loading = await this.loadingController.create({
      message: 'Kullanıcılar yükleniyor...'
    });
    await loading.present();

    this.apiService.getUsers().subscribe({
      next: async (response) => {
        this.users = response.users;
        this.filteredUsers = this.users;
        await loading.dismiss();
      },
      error: async (error) => {
        await loading.dismiss();
        this.showAlert('Hata', 'Kullanıcılar yüklenemedi!');
      }
    });
  }

  filterUsers() {
    this.filteredUsers = this.users.filter(user =>
      user.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  async createUser() {
    const alert = await this.alertController.create({
      header: 'Yeni Kullanıcı Oluştur',
      subHeader: 'Kullanıcı bilgilerini girin',
      cssClass: 'ios-alert',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Ad Soyad',
          attributes: {
            required: true,
            maxlength: 50
          }
        },
        {
          name: 'username',
          type: 'text',
          placeholder: 'Kullanıcı Adı',
          attributes: {
            required: true,
            minlength: 3,
            maxlength: 20
          }
        },
        {
          name: 'password',
          type: 'password',
          placeholder: 'Şifre (min. 6 karakter)',
          attributes: {
            required: true,
            minlength: 6
          }
        },
        {
          name: 'role',
          type: 'text',
          placeholder: 'Rol',
          value: 'AUTHORIZED_PERSON',
          attributes: {
            readonly: true
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
          text: 'Oluştur',
          cssClass: 'alert-button-confirm',
          handler: (data) => {
            if (data.name && data.username && data.password) {
              if (data.password.length < 6) {
                this.showAlert('Hata', 'Şifre en az 6 karakter olmalıdır!');
                return false;
              }
              this.performCreateUser(data);
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

  async performCreateUser(data: any) {
    const loading = await this.loadingController.create({
      message: 'Kullanıcı oluşturuluyor...'
    });
    await loading.present();

    this.apiService.createUser(data).subscribe({
      next: async (response) => {
        await loading.dismiss();
        this.showAlert('Başarılı', 'Kullanıcı oluşturuldu!');
        this.loadUsers();
      },
      error: async (error) => {
        await loading.dismiss();
        this.showAlert('Hata', 'Kullanıcı oluşturulamadı!');
      }
    });
  }

  async editUser(user: User) {
    const alert = await this.alertController.create({
      header: 'Kullanıcı Düzenle',
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: user.name,
          placeholder: 'Ad Soyad'
        },
        {
          name: 'username',
          type: 'text',
          value: user.username,
          placeholder: 'Kullanıcı Adı'
        },
        {
          name: 'password',
          type: 'password',
          placeholder: 'Yeni Şifre (Opsiyonel)'
        },
        {
          name: 'role',
          type: 'text',
          value: user.role,
          placeholder: 'Rol'
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
            this.performUpdateUser(user.id, data);
          }
        }
      ]
    });

    await alert.present();
  }

  async performUpdateUser(userId: string, data: any) {
    const loading = await this.loadingController.create({
      message: 'Kullanıcı güncelleniyor...'
    });
    await loading.present();

    // Boş şifreyi kaldır
    if (!data.password) {
      delete data.password;
    }

    this.apiService.updateUser(userId, data).subscribe({
      next: async (response) => {
        await loading.dismiss();
        this.showAlert('Başarılı', 'Kullanıcı güncellendi!');
        this.loadUsers();
      },
      error: async (error) => {
        await loading.dismiss();
        this.showAlert('Hata', 'Kullanıcı güncellenemedi!');
      }
    });
  }

  async deleteUser(user: User) {
    const alert = await this.alertController.create({
      header: 'Kullanıcı Sil',
      subHeader: 'Bu işlem geri alınamaz',
      message: `"${user.name}" kullanıcısını kalıcı olarak silmek istediğinizden emin misiniz?`,
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
            this.performDeleteUser(user.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async performDeleteUser(userId: string) {
    const loading = await this.loadingController.create({
      message: 'Kullanıcı siliniyor...'
    });
    await loading.present();

    this.apiService.deleteUser(userId).subscribe({
      next: async (response) => {
        await loading.dismiss();
        if (response.success) {
          this.showAlert('Başarılı', 'Kullanıcı silindi!');
          this.loadUsers();
        } else {
          this.showAlert('Hata', response.message);
        }
      },
      error: async (error) => {
        await loading.dismiss();
        this.showAlert('Hata', 'Kullanıcı silinemedi!');
      }
    });
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
