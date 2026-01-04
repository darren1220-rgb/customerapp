
import { GoogleGenAI, Type } from "@google/genai";
import { Customer } from "../types";

/**
 * Extracts customer data from a base64 encoded image using Gemini 3 Pro.
 * Image extraction is considered a complex task requiring advanced reasoning.
 */
export const extractCustomerData = async (base64Image: string): Promise<Customer[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-pro-preview for complex reasoning tasks
  const model = 'gemini-3-pro-preview';
  
  const prompt = `
    請分析這張包含客戶資料的圖片。
    提取欄位：客戶代號 (id), 客戶名稱 (name), 送貨地址 (address), 縣市 (city)。
    回傳格式必須為 JSON 陣列。
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image.split(',')[1] || base64Image
          }
        }
      ]
    },
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

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse image response", e);
    return [];
  }
};

/**
 * Extracts customer data from CSV text content using Gemini 3 Pro.
 * Intelligent CSV mapping is an advanced reasoning task.
 */
export const extractCustomerDataFromCSV = async (csvText: string): Promise<Customer[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-pro-preview for advanced data mapping
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

    回傳格式必須為 JSON 陣列。
  `;

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

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse CSV response", e);
    return [];
  }
};

/**
 * Uses Gemini 2.5 Flash with Google Maps Tool to find official Map URLs for the customers.
 */
export const fetchGoogleMapLinks = async (customers: Customer[]): Promise<Customer[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Maps grounding is only supported in Gemini 2.5 series models.
  const model = "gemini-2.5-flash";
  
  // To save tokens, only search for customers without mapUrl
  const toSearch = customers.filter(c => !c.mapUrl);
  if (toSearch.length === 0) return customers;

  const locationsStr = toSearch.map(c => `${c.name} (${c.address})`).join('\n');
  
  const prompt = `
    請幫我查詢以下客戶在 Google Maps 上的位置資訊，並提供對應的 Google Maps 連結。
    客戶清單：
    ${locationsStr}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ googleMaps: {} }]
    }
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const updatedMap = new Map();
  
  // Correctly extract map URIs from grounding chunks as per Gemini API rules.
  chunks.forEach((chunk, index) => {
    if (chunk.maps && chunk.maps.uri && toSearch[index]) {
      updatedMap.set(toSearch[index].id, chunk.maps.uri);
    }
  });

  return customers.map(c => ({
    ...c,
    mapUrl: updatedMap.get(c.id) || c.mapUrl
  }));
};
