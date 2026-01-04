import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppStatus, Customer, CloudSyncStatus } from './types';
import { extractCustomerData, extractCustomerDataFromCSV, fetchGoogleMapLinks } from './services/gemini';
import { loadCustomersFromDB, saveCustomersToDB, syncDataWithCloud, clearDB } from './services/storage';
import FileUpload, { FileData } from './components/FileUpload';
import CustomerTable from './components/CustomerTable';
import DistributionChart from './components/DistributionChart';
import CustomerMap from './components/CustomerMap';
import { 
  RotateCcw, LayoutDashboard, Database, Users, Map as MapIcon, 
  RefreshCw, UploadCloud, PieChart, Activity, 
  HardDrive, Download, FileJson, Upload, CheckCircle2, 
  Cloud, CloudOff, CloudUpload, Info, AlertCircle
} from 'lucide-react';

type TabType = 'main' | 'upload';

interface AnalysisProgress {
  current: number;
  total: number;
  extractedCount: number;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('main');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('connected');
  const [isSyncing, setIsSyncing] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({ current: 0, total: 0, extractedCount: 0 });

  const initData = async () => {
    setIsSyncing(true);
    try {
      const data = await loadCustomersFromDB();
      setCustomers(data);
      if (data.length > 0) setStatus(AppStatus.READY);
    } catch (err: any) {
      setError("無法讀取資料庫，請重新整理頁面。");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  const triggerCloudSync = async (dataToSync: Customer[]) => {
    if (dataToSync.length === 0) return;
    setCloudStatus('syncing');
    try {
      const syncedData = await syncDataWithCloud(dataToSync);
      setCustomers(syncedData);
      setCloudStatus('connected');
      showSuccess("雲端同步已完成");
    } catch (err) {
      setCloudStatus('error');
      console.error("Cloud Sync Failed", err);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleFilesSelect = async (fileList: FileData[]) => {
    try {
      setStatus(AppStatus.ANALYZING);
      setError(null);
      setAnalysisProgress({ current: 0, total: fileList.length, extractedCount: 0 });
      
      let allExtracted: Customer[] = [];
      let currentExtractedCount = 0;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setAnalysisProgress(prev => ({ ...prev, current: i + 1 }));
        
        try {
          let extracted: Customer[] = [];
          if (file.type === 'image') {
            extracted = await extractCustomerData(file.content);
          } else if (file.type === 'csv') {
            extracted = await extractCustomerDataFromCSV(file.content);
          }
          allExtracted = [...allExtracted, ...extracted];
          currentExtractedCount += extracted.length;
          setAnalysisProgress(prev => ({ ...prev, extractedCount: currentExtractedCount }));
        } catch (singleErr) {
          console.error(`Error processing file ${file.name}:`, singleErr);
          throw singleErr; // 向上拋出，進入外層 catch
        }
      }

      if (allExtracted.length === 0) throw new Error("未能從選取的檔案中辨識到任何有效的客戶資料。");
      
      // 獲取地圖連結
      const enhanced = await fetchGoogleMapLinks(allExtracted);
      
      // 合併新舊資料
      const existingIds = new Set(customers.map(c => c.id));
      const newUniqueOnes = enhanced.filter(c => !existingIds.has(c.id));
      
      if (newUniqueOnes.length === 0 && allExtracted.length > 0) {
         showSuccess("資料已存在，未新增重複紀錄");
         setStatus(AppStatus.READY);
         setActiveTab('main');
         return;
      }

      const updatedList = [...newUniqueOnes, ...customers];

      // 儲存至本地
      setIsSyncing(true);
      await saveCustomersToDB(updatedList);
      setCustomers(updatedList); // 先更新畫面，讓使用者立刻看到
      
      // 背景自動同步到雲端
      triggerCloudSync(updatedList);
      
      setIsSyncing(false);
      setStatus(AppStatus.READY);
      setActiveTab('main');
      showSuccess(`成功解析並新增 ${newUniqueOnes.length} 筆客戶資料`);

    } catch (err: any) {
      setError(err instanceof Error ? err.message : "處理檔案時發生未知錯誤");
      setStatus(AppStatus.ERROR);
    } finally {
      setAnalysisProgress(prev => ({ ...prev, current: 0 }));
    }
  };

  const handleExportData = () => {
    if (customers.length === 0) return;
    const dataStr = JSON.stringify(customers, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer_backup_${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const cityStats = useMemo(() => {
    const stats: Record<string, number> = {};
    customers.forEach(c => { if (c.city) stats[c.city] = (stats[c.city] || 0) + 1; });
    return Object.entries(stats).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
  }, [customers]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-200"><HardDrive size={22} /></div>
            <div>
              <h1 className="text-lg font-black tracking-tight">客戶分佈系統</h1>
              <div className="flex items-center gap-2 mt-1">
                {cloudStatus === 'syncing' ? (
                  <RefreshCw size={10} className="text-blue-500 animate-spin" />
                ) : cloudStatus === 'connected' ? (
                  <Cloud size={10} className="text-emerald-500" />
                ) : (
                  <CloudOff size={10} className="text-red-400" />
                )}
                <span className={`text-[9px] font-black uppercase tracking-widest ${cloudStatus === 'connected' ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {cloudStatus === 'syncing' ? 'Syncing to Cloud' : cloudStatus === 'connected' ? 'Google Cloud Linked' : 'Offline Mode'}
                </span>
              </div>
            </div>
          </div>
          
          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button onClick={() => setActiveTab('main')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'main' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>主畫面分析</button>
            <button onClick={() => setActiveTab('upload')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>資料分析匯入</button>
          </nav>

          <div className="hidden lg:flex items-center gap-4">
             <div className="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 flex items-center gap-2">
                <Users size={14} /> {customers.length} Clients
             </div>
          </div>
        </div>
      </header>

      {/* 訊息提示區 */}
      {successMessage && (
        <div className="fixed top-20 right-6 z-[200] animate-in fade-in slide-in-from-right-4">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold border border-emerald-400">
            <CheckCircle2 size={20} /> {successMessage}
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-20 right-6 z-[200] animate-in fade-in slide-in-from-right-4">
          <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold border border-red-400">
            <AlertCircle size={20} /> {error}
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">✕</button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 py-8">
        {activeTab === 'upload' ? (
          <section className="max-w-4xl mx-auto space-y-8">
            <FileUpload onFilesSelect={handleFilesSelect} isLoading={status === AppStatus.ANALYZING} progress={analysisProgress} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 p-8 bg-white rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><CloudUpload size={20} /></div>
                    <h3 className="font-black text-xl text-slate-800">數據管理</h3>
                  </div>
                  <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                    您可以將分析後的客戶資料匯出為備份檔案，或手動觸發雲端同步。
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => triggerCloudSync(customers)}
                    disabled={status === AppStatus.ANALYZING || customers.length === 0}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cloudStatus === 'syncing' ? <RefreshCw size={18} className="animate-spin" /> : <CloudUpload size={18} />}
                    立即同步雲端
                  </button>
                  <button 
                    onClick={handleExportData}
                    className="px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    title="匯出備份"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>

              <div className="p-8 bg-white rounded-[40px] border border-slate-200 shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-6 border border-slate-100">
                  <RotateCcw size={32} />
                </div>
                <h4 className="font-black text-lg text-slate-800">重設系統</h4>
                <p className="text-slate-400 text-xs mt-2 mb-6">清除所有本地與雲端暫存資料。</p>
                <button 
                  onClick={() => confirm("確定要清空所有資料嗎？此操作不可復原。") && (clearDB(), setCustomers([]), showSuccess("資料已清空"))}
                  className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors"
                >
                  清空資料庫
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-8 animate-in fade-in duration-700">
            {customers.length > 0 ? (
              <>
                <CustomerMap customers={customers} />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">客戶總數</p>
                      <p className="text-4xl font-black text-blue-600">{customers.length}</p>
                   </div>
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">縣市分佈</p>
                      <p className="text-4xl font-black text-emerald-600">{cityStats.length}</p>
                   </div>
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm md:col-span-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">主力市場</p>
                      <p className="text-4xl font-black text-amber-600">{cityStats[0]?.city || '--'}</p>
                   </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                    <CustomerTable customers={customers} />
                  </div>
                  <div className="space-y-8">
                    <DistributionChart data={cityStats} />
                    <div className="p-8 bg-blue-600 rounded-[40px] text-white shadow-xl shadow-blue-100 flex flex-col items-center text-center">
                       <Activity size={40} className="mb-4 opacity-80" />
                       <h4 className="font-black text-xl mb-2">趨勢分析</h4>
                       <p className="text-blue-100 text-sm font-medium leading-relaxed">
                          透過地理空間資訊，我們能協助您優化送貨路徑並發掘潛在的客戶群。
                       </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-32 text-center bg-white rounded-[40px] border border-slate-200 shadow-xl flex flex-col items-center">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-8 border border-blue-100 shadow-inner">
                  <UploadCloud size={48} className="animate-bounce" />
                </div>
                <h3 className="text-3xl font-black mb-4 text-slate-800">開始您的客戶分析</h3>
                <p className="text-slate-500 mb-10 text-lg max-w-sm font-medium">
                  上傳 Excel 截圖或 CSV 檔案，AI 將自動為您標註地圖並生成統計圖表。
                </p>
                <button 
                  onClick={() => setActiveTab('upload')} 
                  className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-1"
                >
                  立刻匯入檔案
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      
      <footer className="py-12 text-center text-slate-400 text-xs font-bold border-t border-slate-200 bg-white">
        <p>© 2024 客戶分佈分析系統 - Powered by Gemini AI</p>
      </footer>
    </div>
  );
};

export default App;