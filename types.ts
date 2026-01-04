
export interface Customer {
  id: string;
  name: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  mapUrl?: string;
  createdAt?: string; // 資料同步至伺服器的時間
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
