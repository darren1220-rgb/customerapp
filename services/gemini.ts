import { GoogleGenAI, Type } from "@google/genai";
import { Customer } from "../types";

/**
 * 提取圖片中的 MIME 類型
 */
const getMimeTypeFromBase64 = (base64String: string): string => {
  const match = base64String.match(/^data:([^;]+);base64,/);
  return match ? match[1] : 'image/png';
};

/**
 * 從圖片中提取客戶資料
 */
export const extractCustomerData = async (base64Image: string): Promise<Customer[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  const mimeType = getMimeTypeFromBase64(base64Image);
  const data = base64Image.includes('base64,') ? base64Image.split(',')[1] : base64Image;

  const prompt = `
    請分析這張包含客戶資料的圖片。
    提取欄位：客戶代號 (id), 客戶名稱 (name), 送貨地址 (address), 縣市 (city)。
    注意：請務必精準識別每一行資料。
    回傳格式必須為 JSON 陣列。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data } }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              city: { type: Type.STRING }
            },
            required: ["id", "name", "address", "city"]
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Gemini Image Extraction Error:", e);
    throw new Error("圖片解析失敗，請確認檔案內容清晰且包含客戶資料。");
  }
};

/**
 * 從 CSV 提取客戶資料
 */
export const extractCustomerDataFromCSV = async (csvText: string): Promise<Customer[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  const prompt = `
    請將以下 CSV 內容轉換為結構化的客戶資料。
    請智慧辨識對應的欄位：
    - id: 客戶代號/編號
    - name: 客戶名稱/簡稱/全名
    - address: 地址/送貨地址/住址
    - city: 從地址中提取縣市（如：台北市、台中市）

    CSV 內容：
    ${csvText}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              city: { type: Type.STRING }
            },
            required: ["id", "name", "address", "city"]
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Gemini CSV Extraction Error:", e);
    throw new Error("CSV 解析失敗，請確認檔案格式正確。");
  }
};

/**
 * 獲取 Google Maps 連結
 */
export const fetchGoogleMapLinks = async (customers: Customer[]): Promise<Customer[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-2.5-flash";
  
  const toSearch = customers.filter(c => !c.mapUrl);
  if (toSearch.length === 0) return customers;

  const locationsStr = toSearch.map(c => `${c.name} (${c.address})`).join('\n');
  
  const prompt = `
    請查詢以下客戶在 Google Maps 上的位置連結：
    ${locationsStr}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }]
      }
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    // 過濾出包含地圖資訊的 chunks，避免與 text 類型混淆導致索引偏移
    const mapChunks = chunks.filter(chunk => chunk.maps && chunk.maps.uri);
    
    const updatedMap = new Map();
    mapChunks.forEach((chunk, index) => {
      if (chunk.maps && chunk.maps.uri && toSearch[index]) {
        updatedMap.set(toSearch[index].id, chunk.maps.uri);
      }
    });

    return customers.map(c => ({
      ...c,
      mapUrl: updatedMap.get(c.id) || c.mapUrl
    }));
  } catch (e) {
    console.warn("Maps Grounding failed, returning partial data", e);
    return customers;
  }
};