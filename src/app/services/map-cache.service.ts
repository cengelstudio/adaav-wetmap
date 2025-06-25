import { Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

export interface CachedTile {
  x: number;
  y: number;
  z: number;
  url: string;
  timestamp: number;
}

export interface MapCacheMetadata {
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  sizeInMB: number;
  downloadDate: number;
  lastAccessed: number;
}

@Injectable({
  providedIn: 'root'
})
export class MapCacheService {
  private cachedMapsSubject = new BehaviorSubject<MapCacheMetadata[]>([]);
  private downloadProgressSubject = new BehaviorSubject<number>(0);
  private isDownloadingSubject = new BehaviorSubject<boolean>(false);

  cachedMaps$ = this.cachedMapsSubject.asObservable();
  downloadProgress$ = this.downloadProgressSubject.asObservable();
  isDownloading$ = this.isDownloadingSubject.asObservable();

  private readonly CACHE_DIR = 'map-cache';
  private readonly METADATA_KEY = 'cached_maps_metadata';

  constructor() {
    this.initializeCache();
    this.loadCachedMaps();
  }

  async initializeCache() {
    try {
      await Filesystem.mkdir({
        path: this.CACHE_DIR,
        directory: Directory.Data,
        recursive: true
      });
      console.log('Map cache directory initialized');
    } catch (error) {
      console.error('Error initializing cache directory:', error);
    }
  }

  async loadCachedMaps() {
    try {
      const { value } = await Preferences.get({ key: this.METADATA_KEY });
      if (value) {
        const maps = JSON.parse(value);
        this.cachedMapsSubject.next(maps);
        console.log(`Loaded ${maps.length} cached maps`);
      }
    } catch (error) {
      console.error('Error loading cached maps:', error);
    }
  }

  async downloadMapArea(
    name: string,
    bounds: { north: number; south: number; east: number; west: number },
    minZoom: number,
    maxZoom: number
  ): Promise<void> {
    if (this.isDownloadingSubject.value) {
      throw new Error('Download already in progress');
    }

    this.isDownloadingSubject.next(true);
    this.downloadProgressSubject.next(0);

    try {
      const tileUrls = this.generateTileUrls(bounds, minZoom, maxZoom);
      const totalTiles = tileUrls.length;
      let downloadedTiles = 0;
      let totalSizeBytes = 0;

      console.log(`Starting download of ${totalTiles} tiles for area: ${name}`);

      // Create map directory
      await Filesystem.mkdir({
        path: `${this.CACHE_DIR}/${name}`,
        directory: Directory.Data,
        recursive: true
      });

      // Download tiles in chunks
      const chunks = this.chunkArray(tileUrls, 5);

      for (const chunk of chunks) {
        const promises = chunk.map(async (tileData) => {
          try {
            const response = await fetch(tileData.url);
            if (!response.ok) {
              throw new Error(`Failed to fetch tile: ${response.status}`);
            }

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const base64Data = this.arrayBufferToBase64(arrayBuffer);

            const fileName = `${tileData.z}_${tileData.x}_${tileData.y}.png`;
            const filePath = `${this.CACHE_DIR}/${name}/${fileName}`;

            await Filesystem.writeFile({
              path: filePath,
              data: base64Data,
              directory: Directory.Data
            });

            totalSizeBytes += arrayBuffer.byteLength;
            downloadedTiles++;

            const progress = (downloadedTiles / totalTiles) * 100;
            this.downloadProgressSubject.next(progress);

            return { success: true, size: arrayBuffer.byteLength };
          } catch (error) {
            console.error('Error downloading tile:', tileData.url, error);
            return { success: false, size: 0 };
          }
        });

        await Promise.all(promises);
      }

      // Save metadata
      const metadata: MapCacheMetadata = {
        name,
        bounds,
        minZoom,
        maxZoom,
        tileCount: downloadedTiles,
        sizeInMB: totalSizeBytes / (1024 * 1024),
        downloadDate: Date.now(),
        lastAccessed: Date.now()
      };

      const currentMaps = this.cachedMapsSubject.value;
      const updatedMaps = [...currentMaps.filter(m => m.name !== name), metadata];
      await this.saveCachedMapsMetadata(updatedMaps);

      console.log(`Map download completed: ${downloadedTiles}/${totalTiles} tiles`);
    } catch (error) {
      console.error('Error downloading map area:', error);
      throw error;
    } finally {
      this.isDownloadingSubject.next(false);
      this.downloadProgressSubject.next(0);
    }
  }

  async getCachedTileUrl(x: number, y: number, z: number, mapName: string): Promise<string | null> {
    try {
      const fileName = `${z}_${x}_${y}.png`;
      const filePath = `${this.CACHE_DIR}/${mapName}/${fileName}`;

      const file = await Filesystem.readFile({
        path: filePath,
        directory: Directory.Data
      });

      return `data:image/png;base64,${file.data}`;
    } catch (error) {
      return null;
    }
  }

  async deleteCachedMap(mapName: string): Promise<void> {
    try {
      await Filesystem.rmdir({
        path: `${this.CACHE_DIR}/${mapName}`,
        directory: Directory.Data,
        recursive: true
      });

      const currentMaps = this.cachedMapsSubject.value;
      const updatedMaps = currentMaps.filter(m => m.name !== mapName);
      await this.saveCachedMapsMetadata(updatedMaps);
    } catch (error) {
      console.error('Error deleting cached map:', error);
      throw error;
    }
  }

  private async saveCachedMapsMetadata(maps: MapCacheMetadata[]) {
    await Preferences.set({
      key: this.METADATA_KEY,
      value: JSON.stringify(maps)
    });
    this.cachedMapsSubject.next(maps);
  }

  private generateTileUrls(
    bounds: { north: number; south: number; east: number; west: number },
    minZoom: number,
    maxZoom: number
  ): Array<{ x: number; y: number; z: number; url: string }> {
    const tiles: Array<{ x: number; y: number; z: number; url: string }> = [];

    for (let z = minZoom; z <= maxZoom; z++) {
      const minTileX = this.lonToTileX(bounds.west, z);
      const maxTileX = this.lonToTileX(bounds.east, z);
      const minTileY = this.latToTileY(bounds.north, z);
      const maxTileY = this.latToTileY(bounds.south, z);

      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          const url = this.getTileUrl(x, y, z);
          tiles.push({ x, y, z, url });
        }
      }
    }

    return tiles;
  }

  private lonToTileX(lon: number, zoom: number): number {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  }

  private latToTileY(lat: number, zoom: number): number {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  private getTileUrl(x: number, y: number, z: number): string {
    const subdomains = ['a', 'b', 'c'];
    const subdomain = subdomains[(x + y) % subdomains.length];
    return `https://${subdomain}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  getTotalCacheSize(): number {
    return this.cachedMapsSubject.value.reduce((total, map) => total + map.sizeInMB, 0);
  }

  getCachedMapsCount(): number {
    return this.cachedMapsSubject.value.length;
  }

  async clearAllCache(): Promise<void> {
    try {
      await Filesystem.rmdir({
        path: this.CACHE_DIR,
        directory: Directory.Data,
        recursive: true
      });

      await this.initializeCache();
      await this.saveCachedMapsMetadata([]);

      console.log('All map cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }
}
