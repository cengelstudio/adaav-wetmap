import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MapPage } from './map.page';
import { LocationFormModalComponent } from './location-form-modal.component';

import { MapPageRoutingModule } from './map-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MapPageRoutingModule
  ],
  declarations: [MapPage, LocationFormModalComponent]
})
export class MapPageModule {}
