
export interface Customer {
  id: string;
  name: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  mapUrl?: string;
  createdAt?: string; 
  syncStatus?: 'local' | 'synced' | 'syncing'; // 新增同步狀態
}

export interface CityStat {
  city: string;
  count: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export type CloudSyncStatus = 'connected' | 'disconnected' | 'syncing' | 'error';
