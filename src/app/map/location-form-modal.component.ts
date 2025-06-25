import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-location-form-modal',
  templateUrl: './location-form-modal.component.html',
  styleUrls: ['./location-form-modal.component.scss'],
  standalone: false
})
export class LocationFormModalComponent implements OnInit {
  @Input() type: string = 'wetland';
  @Input() currentLocation: [number, number] | null = null;

  locationForm: FormGroup;

  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder
  ) {
    this.locationForm = this.formBuilder.group({
      title: ['', Validators.required],
      description: [''],
      city: ['', Validators.required],
      latitude: ['', [Validators.required, Validators.min(-90), Validators.max(90)]],
      longitude: ['', [Validators.required, Validators.min(-180), Validators.max(180)]]
    });
  }

  ngOnInit() {
    if (this.currentLocation) {
      this.locationForm.patchValue({
        latitude: this.currentLocation[0],
        longitude: this.currentLocation[1]
      });
    }
  }

  getTitle(): string {
    return this.type === 'wetland' ? 'Yeni Sulak Alan' : 'Yeni Depo Alanı';
  }

  getSubtitle(): string {
    return this.type === 'wetland' ? 'Sulak Alan Ekle' : 'Depo Alanı Ekle';
  }

  getIconName(): string {
    return this.type === 'wetland' ? 'water' : 'business';
  }

  getIconClass(): string {
    return this.type === 'wetland' ? 'water-icon' : 'warehouse-icon';
  }

  async getCurrentLocation() {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const position = await Geolocation.getCurrentPosition();

      this.locationForm.patchValue({
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6)
      });
    } catch (error) {
      console.error('Konum alınamadı:', error);
    }
  }

  dismiss() {
    this.modalController.dismiss();
  }

  save() {
    if (this.locationForm.valid) {
      this.modalController.dismiss({
        confirmed: true,
        formData: {
          ...this.locationForm.value,
          type: this.type
        }
      });
    }
  }
}
