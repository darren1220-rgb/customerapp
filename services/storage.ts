
import { Customer } from "../types";

const STORAGE_KEY = 'customer_distribution_data';
const CLOUD_API_ENDPOINT = 'https://your-gcloud-region-project.cloudfunctions.net/syncCustomers'; // 預留 GCloud 接口

/**
 * 從 LocalStorage 讀取所有客戶紀錄
 */
export const loadCustomersFromDB = async (): Promise<Customer[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    return parsed.sort((a: any, b: any) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  } catch (error) {
    console.error("Local Storage Read Error:", error);
    return [];
  }
};

/**
 * 將客戶資料寫入 LocalStorage
 */
export const saveCustomersToDB = async (customers: Customer[]): Promise<boolean> => {
  try {
    const now = new Date().toLocaleString('zh-TW');
    const updatedCustomers = customers.map(c => ({
      ...c,
      createdAt: c.createdAt || now,
      syncStatus: c.syncStatus || 'local'
    }));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustomers));
    return true;
  } catch (error) {
    console.error("Local Storage Save Error:", error);
    return false;
  }
};

/**
 * 模擬將資料同步至 Google Cloud (Firestore 或 GCS)
 */
export const syncDataWithCloud = async (customers: Customer[]): Promise<Customer[]> => {
  // 這裡模擬網路延遲與 Google Cloud API 呼叫
  return new Promise((resolve) => {
    console.log("正在同步資料至 Google Cloud...", customers);
    
    setTimeout(() => {
      const syncedData = customers.map(c => ({
        ...c,
        syncStatus: 'synced' as const
      }));
      
      // 更新本地快取，將狀態標記為已同步
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedData));
      
      console.log("Google Cloud 同步完成");
      resolve(syncedData);
    }, 1500);
  });
};

export const clearDB = async (): Promise<void> => {
  localStorage.removeItem(STORAGE_KEY);
};
