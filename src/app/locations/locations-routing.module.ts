import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LocationsPage } from './locations.page';

const routes: Routes = [
  {
    path: '',
    component: LocationsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LocationsPageRoutingModule {}
