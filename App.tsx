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
  RefreshCw, UploadCloud, PieChart, Activity, 
  HardDrive, Download, FileJson, Upload, CheckCircle2, Cloud
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
      setError("無法讀取本地資料。");
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

      if (allExtracted.length === 0) throw new Error("無法從檔案中辨識出客戶資料。");
      
      const enhanced = await fetchGoogleMapLinks(allExtracted);
      const existingIds = new Set(customers.map(c => c.id));
      const newUniqueOnes = enhanced.filter(c => !existingIds.has(c.id));
      const updatedList = [...newUniqueOnes, ...customers];

      setIsSyncing(true);
      await saveCustomersToDB(updatedList);
      setIsSyncing(false);

      setCustomers(updatedList);
      setStatus(AppStatus.READY);
      setActiveTab('main');
      showSuccess(`成功解析並新增 ${newUniqueOnes.length} 筆客戶資料`);

    } catch (err: any) {
      setError(err instanceof Error ? err.message : "發生系統錯誤");
      setStatus(AppStatus.ERROR);
    } finally {
      setAnalysisProgress({ current: 0, total: 0, extractedCount: 0 });
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

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string) as Customer[];
        const existingIds = new Set(customers.map(c => c.id));
        const newOnes = importedData.filter(c => !existingIds.has(c.id));
        const updatedList = [...newOnes, ...customers];
        await saveCustomersToDB(updatedList);
        setCustomers(updatedList);
        showSuccess(`成功匯入 ${newOnes.length} 筆新資料`);
        setActiveTab('main');
      } catch (err) { alert("匯入失敗"); }
    };
    reader.readAsText(file);
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
              <div className="flex items-center gap-1.5 mt-1.5">
                {isSyncing ? (
                  <RefreshCw size={10} className="text-blue-500 animate-spin" />
                ) : (
                  <Cloud size={10} className="text-emerald-500" />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Local Storage Active</span>
              </div>
            </div>
          </div>
          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button onClick={() => setActiveTab('main')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'main' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>主畫面分析</button>
            <button onClick={() => setActiveTab('upload')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>資料分析匯入</button>
          </nav>
          <div className="hidden lg:flex items-center gap-4 text-xs font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
            <Users size={14} /> {customers.length} 名客戶
          </div>
        </div>
      </header>

      {successMessage && (
        <div className="fixed top-20 right-6 z-[200] animate-in fade-in slide-in-from-right-4">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold">
            <CheckCircle2 size={20} /> {successMessage}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 py-8">
        {activeTab === 'upload' ? (
          <section className="max-w-4xl mx-auto space-y-8">
            <FileUpload onFilesSelect={handleFilesSelect} isLoading={status === AppStatus.ANALYZING} progress={analysisProgress} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-10 bg-white rounded-[40px] border border-slate-200 shadow-sm">
                <h3 className="font-black text-xl mb-6">資料備份與轉移</h3>
                <div className="space-y-4">
                  <button onClick={handleExportData} className="w-full py-4 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl font-black hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2"><Download size={18}/> 匯出備份 (JSON)</button>
                  <label className="w-full py-4 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl font-black hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Upload size={18}/> 匯入備份 (JSON)
                    <input type="file" className="hidden" accept=".json" onChange={handleImportJson} />
                  </label>
                </div>
              </div>
              <div className="p-10 bg-white rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                <Database size={40} className="text-blue-500 mb-4" />
                <h4 className="font-black text-lg">本地儲存空間</h4>
                <p className="text-slate-400 text-sm mt-2">所有資料僅儲存在您的瀏覽器中，保障隱私。</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-8">
            {customers.length > 0 ? (
              <>
                <CustomerMap customers={customers} />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">總數</p><p className="text-4xl font-black text-blue-600">{customers.length}</p></div>
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">縣市</p><p className="text-4xl font-black text-emerald-600">{cityStats.length}</p></div>
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm md:col-span-2"><p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">核心市場</p><p className="text-4xl font-black text-amber-600">{cityStats[0]?.city || '--'}</p></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><CustomerTable customers={customers} /></div>
                  <div className="space-y-8"><DistributionChart data={cityStats} /></div>
                </div>
              </>
            ) : (
              <div className="py-32 text-center bg-white rounded-[40px] border border-slate-200 shadow-sm flex flex-col items-center">
                <Cloud size={60} className="text-slate-200 mb-6" />
                <h3 className="text-2xl font-black mb-4">歡迎使用客戶分佈系統</h3>
                <p className="text-slate-500 mb-8">目前尚無資料，請前往「資料分析匯入」開始。</p>
                <button onClick={() => setActiveTab('upload')} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg">匯入第一筆資料</button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default App;