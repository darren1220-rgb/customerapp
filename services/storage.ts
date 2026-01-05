import { Customer } from "../types";
// @ts-ignore
import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore
import { getFirestore, collection, getDocs, doc, writeBatch, query, orderBy } from "firebase/firestore";

// ==========================================
// Firebase 配置
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCYSNezp88KVTSAH4ZKEqZ7_7Ul1XmMh6Q",
  authDomain: "planning-with-ai-13f8a.firebaseapp.com",
  projectId: "planning-with-ai-13f8a",
  storageBucket: "planning-with-ai-13f8a.firebasestorage.app",
  messagingSenderId: "1046177525076",
  appId: "1:1046177525076:web:c72876fc1db2e20877ecc1"
};

const STORAGE_KEY = 'customer_distribution_data';
const COLLECTION_NAME = 'customers';

let dbInstance: any = null;

/**
 * 確保初始化資料庫實例
 */
const getDB = () => {
  if (dbInstance) return dbInstance;
  try {
    const apps = getApps();
    const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
    
    // 確保在嘗試獲取 firestore 前，App 已正確初始化
    dbInstance = getFirestore(app);
    return dbInstance;
  } catch (e) {
    console.error("Firebase Storage Service Initialization Failed:", e);
    return null;
  }
};

export interface LoadResult {
  data: Customer[];
  source: 'cloud' | 'local';
  errorType?: 'permission-denied' | 'network' | 'initialization' | 'other';
}

/**
 * 載入客戶資料：優先從雲端讀取
 */
export const loadCustomersFromDB = async (): Promise<LoadResult> => {
  const db = getDB();
  
  if (db) {
    try {
      console.log("[Storage] 連線雲端資料庫...");
      const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const cloudData: Customer[] = [];
      
      querySnapshot.forEach((doc: any) => {
        cloudData.push({ ...doc.data() });
      });

      console.log(`[Storage] 雲端同步完成 (${cloudData.length} 筆)`);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
      
      return { 
        data: cloudData, 
        source: 'cloud' 
      };

    } catch (error: any) {
      console.error("[Storage] 雲端存取錯誤:", error);
      
      let errorType: LoadResult['errorType'] = 'other';
      if (error.code === 'permission-denied' || error.message?.toLowerCase().includes('permission')) {
        errorType = 'permission-denied';
      } else if (error.code === 'unavailable' || !navigator.onLine) {
        errorType = 'network';
      }

      return { 
        data: getLocalData(), 
        source: 'local', 
        errorType 
      };
    }
  }

  console.warn("[Storage] Firebase 模組尚未就緒，使用本地快取。");
  return { data: getLocalData(), source: 'local', errorType: 'initialization' };
};

const getLocalData = (): Customer[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return (parsed as any[]).sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (e) {
    return [];
  }
};

export const saveCustomersToDB = async (customers: Customer[]): Promise<boolean> => {
  try {
    const now = new Date().toISOString();
    const updatedCustomers = customers.map(c => ({
      ...c,
      createdAt: c.createdAt || now,
      syncStatus: c.syncStatus || 'syncing'
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustomers));
    return true;
  } catch (error) {
    console.error("Local Save Error:", error);
    return false;
  }
};

export const syncDataWithCloud = async (customers: Customer[]): Promise<Customer[]> => {
  const db = getDB();
  if (!db) throw new Error("Database not initialized");

  try {
    const batch = writeBatch(db);
    customers.forEach(customer => {
      const docRef = doc(db, COLLECTION_NAME, customer.id);
      batch.set(docRef, {
        ...customer,
        syncStatus: 'synced',
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
    const syncedData = customers.map(c => ({ ...c, syncStatus: 'synced' as const }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedData));
    return syncedData;
  } catch (error: any) {
    console.error("Cloud Sync Error:", error);
    if (error.code === 'permission-denied' || error.message?.toLowerCase().includes('permission')) {
      throw new Error("PERMISSION_DENIED");
    }
    throw error;
  }
};

export const clearDB = async (): Promise<void> => {
  localStorage.removeItem(STORAGE_KEY);
};