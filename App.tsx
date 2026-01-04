import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppStatus, Customer } from './types';
import { extractCustomerData, extractCustomerDataFromCSV, fetchGoogleMapLinks } from './services/gemini';
import { loadCustomersFromDB, saveCustomersToDB, clearDB } from './services/storage';
import FileUpload, { FileData } from './components/FileUpload';
import CustomerTable from './components/CustomerTable';
import DistributionChart from './components/DistributionChart';
import CustomerMap from './components/CustomerMap';
import { 
  RotateCcw, LayoutDashboard, Database, Users, Map as MapIcon, 
  BarChart3, CloudCheck, RefreshCw, UploadCloud, PieChart, Server, Activity, 
  AlertTriangle, ChevronRight, ExternalLink, HardDrive, Download, FileJson, Upload, CheckCircle2
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({ current: 0, total: 0, extractedCount: 0 });
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const initData = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const data = await loadCustomersFromDB();
      setCustomers(data);
      if (data.length > 0) setStatus(AppStatus.READY);
    } catch (err: any) {
      console.error("Initialization failed", err);
      setError("無法讀取本地資料，請檢查瀏覽器設定。");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

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
        }
      }

      if (allExtracted.length === 0) {
        throw new Error("無法從檔案中辨識出客戶資料。");
      }
      
      // 進入地圖連結強化階段
      const enhanced = await fetchGoogleMapLinks(allExtracted);
      
      // 合併新舊資料，以 ID 避免重複
      const existingIds = new Set(customers.map(c => c.id));
      const newUniqueOnes = enhanced.filter(c => !existingIds.has(c.id));
      const updatedList = [...newUniqueOnes, ...customers]; // 新的放前面

      setIsSyncing(true);
      const success = await saveCustomersToDB(updatedList);
      setIsSyncing(false);

      if (success) {
        setCustomers(updatedList);
        setStatus(AppStatus.READY);
        setActiveTab('main');
        showSuccess(`成功解析並新增 ${newUniqueOnes.length} 筆客戶資料`);
      } else {
        throw new Error("本地資料存儲失敗。");
      }

    } catch (err: any) {
      console.error(err);
      setError(err instanceof Error ? err.message : "發生系統錯誤");
      setStatus(AppStatus.ERROR);
    } finally {
      setAnalysisProgress({ current: 0, total: 0, extractedCount: 0 });
    }
  };

  const handleExportData = () => {
    if (customers.length === 0) {
      alert("目前沒有資料可以匯出。");
      return;
    }
    const dataStr = JSON.stringify(customers, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `customer_data_backup_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string) as Customer[];
        if (!Array.isArray(importedData)) throw new Error("無效的備份檔案格式。");

        const existingIds = new Set(customers.map(c => c.id));
        const newOnes = importedData.filter(c => !existingIds.has(c.id));
        const updatedList = [...newOnes, ...customers];

        setIsSyncing(true);
        await saveCustomersToDB(updatedList);
        setIsSyncing(false);
        setCustomers(updatedList);
        showSuccess(`成功匯入 ${newOnes.length} 筆新資料`);
        setActiveTab('main');
      } catch (err) {
        alert("匯入失敗：請確保檔案為正確的 JSON 備份格式。");
      }
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
    if (confirm("警告：此操作將永久清除瀏覽器中的所有客戶紀錄。確定執行？")) {
      setIsSyncing(true);
      try {
        await clearDB();
        setCustomers([]);
        setStatus(AppStatus.IDLE);
      } catch (err: any) {
        setError("清除失敗");
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const cityStats = useMemo(() => {
    const stats: Record<string, number> = {};
    customers.forEach(c => {
      if (c.city) {
        stats[c.city] = (stats[c.city] || 0) + 1;
      }
    });
    return Object.entries(stats)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);
  }, [customers]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-200">
              <HardDrive size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">
                客戶分佈系統 <span className="text-blue-600">本地離線版</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                {isSyncing ? (
                  <div className="flex items-center gap-1">
                    <RefreshCw size={10} className="text-blue-500 animate-spin" />
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Processing</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-emerald-500">
                    <CloudCheck size={10} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Local Storage Ready</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <nav className="flex items-center bg-slate-100/80 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('main')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'main' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutDashboard size={16} />
              主畫面分析
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <UploadCloud size={16} />
              資料分析匯入
            </button>
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            {customers.length > 0 && (
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-[11px] font-black text-red-500 hover:bg-red-50 rounded-xl transition-colors uppercase tracking-widest border border-transparent hover:border-red-100"
              >
                <RotateCcw size={14} />
                清空本地紀錄
              </button>
            )}
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
              <Users size={14} className="text-blue-600" />
              <span className="text-xs font-black text-blue-700">{customers.length} 名客戶</span>
            </div>
          </div>
        </div>
      </header>

      {successMessage && (
        <div className="fixed top-20 right-6 z-[200] animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold border border-emerald-400">
            <CheckCircle2 size={20} />
            {successMessage}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 py-8">
        {activeTab === 'upload' ? (
          <section className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center p-3 bg-blue-100 text-blue-600 rounded-3xl mb-4">
                <Activity size={32} />
              </div>
              <h2 className="text-4xl font-black tracking-tight">離線資料匯入中心</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto font-medium">
                分析完成後，資料將持久保存於您的瀏覽器中，不需額外設定資料庫。
              </p>
            </div>
            
            <FileUpload 
              onFilesSelect={handleFilesSelect} 
              isLoading={status === AppStatus.ANALYZING} 
              progress={analysisProgress}
            />
            
            {error && (
              <div className="p-5 bg-red-50 border border-red-200 text-red-700 rounded-3xl text-center shadow-sm font-bold animate-shake">
                {error}
              </div>
            )}

            {/* 資料備份區塊 */}
            <div className="p-10 bg-white rounded-[40px] border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-xl tracking-tight">資料備份與轉移</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Backup & Migration</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-amber-200 transition-all group">
                  <h4 className="font-black text-slate-700 mb-2 flex items-center gap-2">
                    <Download size={18} className="text-amber-500" />
                    匯出資料備份
                  </h4>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    將目前的 {customers.length} 筆客戶資料下載為 JSON 檔案，以便在其他裝置上還原。
                  </p>
                  <button 
                    onClick={handleExportData}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-sm shadow-sm hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all flex items-center justify-center gap-2"
                  >
                    <FileJson size={16} />
                    產生備份檔案
                  </button>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-blue-200 transition-all">
                  <h4 className="font-black text-slate-700 mb-2 flex items-center gap-2">
                    <Upload size={18} className="text-blue-500" />
                    從備份匯入
                  </h4>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    選取先前下載的 JSON 備份檔案，系統將自動比對 ID 並合併至現有清單中。
                  </p>
                  <label className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-sm shadow-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center justify-center gap-2 cursor-pointer text-center">
                    <FileJson size={16} />
                    選取 JSON 檔案
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".json" 
                      ref={jsonInputRef}
                      onChange={handleImportJson}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-white rounded-[40px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mb-6">
                  <PieChart size={24} />
                </div>
                <h4 className="font-black text-slate-800 mb-3 text-lg">AI 智慧解析</h4>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">
                  由 Google Gemini 3 Pro 驅動。支援 Excel 截圖與 CSV 辨識，自動提取代號與地址。
                </p>
              </div>
              <div className="p-8 bg-white rounded-[40px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-6">
                  <HardDrive size={24} />
                </div>
                <h4 className="font-black text-slate-800 mb-3 text-lg">安全且隱私</h4>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">
                  您的客戶資料儲存於本地瀏覽器 (LocalStorage)，不會上傳至第三方雲端資料庫。
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-8 animate-in fade-in duration-700">
            {customers.length > 0 ? (
              <>
                <div className="w-full shadow-2xl shadow-slate-200/50 rounded-3xl overflow-hidden border border-slate-200">
                  <CustomerMap customers={customers} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">本地存儲總數</p>
                      <p className="text-4xl font-black text-blue-600">{customers.length}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      瀏覽器快取運作中
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">涵蓋縣市</p>
                    <p className="text-4xl font-black text-emerald-600">{cityStats.length} <span className="text-sm">縣市</span></p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm md:col-span-2">
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">熱點市場分佈</p>
                    <div className="flex items-end gap-3">
                      <p className="text-3xl font-black text-amber-600 truncate">{cityStats[0]?.city || '--'}</p>
                      <p className="text-sm font-bold text-slate-400 mb-1">佔總體 {customers.length > 0 ? Math.round((cityStats[0]?.count / customers.length) * 100) : 0}%</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                  <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
                    <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <LayoutDashboard size={20} className="text-blue-600" />
                        <h3 className="font-black text-slate-800 text-lg">客戶資料清單</h3>
                      </div>
                    </div>
                    <CustomerTable customers={customers} />
                  </div>

                  <div className="space-y-8">
                    <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      <DistributionChart data={cityStats} />
                    </div>
                    
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                        <h3 className="font-black text-slate-800 text-lg">區域排名</h3>
                        <Activity size={18} className="text-slate-300" />
                      </div>
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {cityStats.map((stat, i) => (
                          <div key={stat.city} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-white transition-all border border-transparent hover:border-blue-100 group shadow-sm hover:shadow-md">
                            <div className="flex items-center gap-4">
                              <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-black transition-all ${i < 3 ? 'bg-blue-600 text-white rotate-3 shadow-lg shadow-blue-200' : 'bg-slate-200 text-slate-500'}`}>
                                {i + 1}
                              </span>
                              <span className="font-black text-slate-800 text-base">{stat.city}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-black text-blue-600 leading-none">
                                {stat.count}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 mt-1">CLIENTS</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-center bg-white rounded-[40px] border border-slate-200 shadow-2xl shadow-slate-200/50">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-8 animate-pulse">
                  <HardDrive size={48} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4">系統已就緒</h3>
                <p className="text-slate-500 max-w-sm mb-10 text-lg font-medium">
                  尚未有任何分析紀錄。請點擊上方按鈕上傳 Excel 截圖或匯入備份檔案。
                </p>
                <button 
                  onClick={() => setActiveTab('upload')}
                  className="px-10 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 flex items-center gap-3 bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                >
                  <UploadCloud size={20} />
                  開始匯入資料
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="py-16 border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1600px] mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-3 mb-6 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
              Data Migration Enabled
            </span>
          </div>
          <p className="text-slate-400 text-sm font-bold">© 2024 客戶分佈分析系統 - 支援備份匯出匯入</p>
        </div>
      </footer>
    </div>
  );
};

export default App;