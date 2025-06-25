# AdaAv: Wetland Map

A mobile application for mapping and managing wetlands and storage areas in Northern Cyprus.

## About

AdaAv: Wetland Map is developed for the North Cyprus Hunters Federation to help identify, catalog, and manage wetland areas and storage facilities across Northern Cyprus. The app provides an interactive map interface with offline capabilities.

## Features

- 🗺️ **Interactive Map**: Browse wetlands and storage areas on an interactive map
- 📱 **Mobile Friendly**: Optimized for mobile devices and tablets
- 🔒 **Secure Login**: User authentication system
- 📍 **Location Management**: Add, edit, and delete location markers
- 🌐 **Offline Support**: Works without internet connection
- 📋 **Location Details**: View detailed information about each location
- ⚙️ **Settings**: Customizable app settings
- 👥 **User Management**: Admin panel for user management

## Technology Stack

- **Framework**: Angular 18 + Ionic 8
- **Map Library**: Leaflet
- **Mobile**: Capacitor
- **Language**: TypeScript
- **Styling**: SCSS

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Ionic CLI

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd adaav-wetmap
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Ionic CLI** (if not installed)
   ```bash
   npm install -g @ionic/cli
   ```

## Running the App

### Development Server

```bash
npm start
# or
ionic serve
```

The app will open in your browser at `http://localhost:8100`

### Build for Production

```bash
npm run build
# or
ionic build --prod
```

### Mobile Development

#### iOS
```bash
ionic capacitor add ios
ionic capacitor run ios
```

#### Android
```bash
ionic capacitor add android
ionic capacitor run android
```

## Project Structure

```
src/
├── app/
│   ├── guards/           # Route guards
│   ├── services/         # API and utility services
│   ├── login/           # Login page
│   ├── map/             # Main map interface
│   ├── locations/       # Locations management
│   ├── settings/        # App settings
│   ├── user-management/ # User administration
│   └── tabs/           # Tab navigation
├── assets/             # Static assets
├── theme/             # App styling
└── environments/      # Environment configuration
```

## API Integration

The app is configured to work with the AdaAv backend API:
- **Base URL**: `https://adaav-wetmap-api.glynet.com/api`
- **Authentication**: JWT tokens
- **Offline Mode**: Local storage fallback

---

**AdaAv: Wetland Map** - Protecting Northern Cyprus Wetlands 🌿
