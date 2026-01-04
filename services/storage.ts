import { Customer } from "../types";

const STORAGE_KEY = 'customer_distribution_data';

/**
 * 從 LocalStorage 讀取所有客戶紀錄
 */
export const loadCustomersFromDB = async (): Promise<Customer[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    // 確保讀取出來的資料依照時間排序（新的在前）
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
      createdAt: c.createdAt || now
    }));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustomers));
    return true;
  } catch (error) {
    console.error("Local Storage Save Error:", error);
    return false;
  }
};

/**
 * 清空 LocalStorage 中的所有客戶紀錄
 */
export const clearDB = async (): Promise<void> => {
  localStorage.removeItem(STORAGE_KEY);
};