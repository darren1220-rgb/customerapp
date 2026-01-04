import React, { useRef } from 'react';
import { Upload, FileImage, ShieldCheck, FileText, Loader2, Info } from 'lucide-react';

export interface FileData {
  type: 'image' | 'csv';
  name: string;
  content: string; // Base64 for images, Text for CSV
}

interface AnalysisProgress {
  current: number;
  total: number;
  extractedCount: number;
}

interface FileUploadProps {
  onFilesSelect: (files: FileData[]) => void;
  isLoading: boolean;
  progress?: AnalysisProgress;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, isLoading, progress }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList: File[] = Array.from(files);
      
      const promises = fileList.map((file: File) => {
        return new Promise<FileData>((resolve) => {
          const reader = new FileReader();
          const isCsv = file.name.toLowerCase().endsWith('.csv');
          
          reader.onloadend = () => {
            resolve({
              type: isCsv ? 'csv' : 'image',
              name: file.name,
              content: reader.result as string
            });
          };

          if (isCsv) {
            reader.readAsText(file);
          } else {
            reader.readAsDataURL(file);
          }
        });
      });

      const results = await Promise.all(promises);
      onFilesSelect(results);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const progressPercentage = progress && progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div 
      onClick={isLoading ? undefined : handleClick}
      className={`
        relative group border-2 border-dashed rounded-[40px] p-12 transition-all duration-500 cursor-pointer overflow-hidden
        ${isLoading ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'hover:bg-blue-50/50 hover:border-blue-300 border-slate-300 bg-white shadow-sm hover:shadow-xl'}
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,.csv"
        multiple={true}
        disabled={isLoading}
      />
      
      <div className="flex flex-col items-center text-center space-y-6">
        {isLoading ? (
          <div className="w-full max-w-md space-y-6">
            <div className="flex flex-col items-center animate-bounce">
              <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-lg shadow-blue-200">
                <Loader2 size={32} className="animate-spin" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                正在分析檔案資料
              </h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                  <span>Progress: {progress?.current} / {progress?.total} Files</span>
                  <span>{progressPercentage}%</span>
                </div>
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-500 ease-out shadow-sm"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 font-bold text-sm">
                <ShieldCheck size={16} />
                目前已累計辨識 <span className="text-lg font-black mx-1">{progress?.extractedCount}</span> 筆客戶
              </div>

              <p className="text-slate-400 text-xs font-medium animate-pulse">
                由 Gemini 3 Pro 深度學習引擎處理中，請稍候...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-4">
              <div className="p-5 bg-blue-50 text-blue-600 rounded-[30px] group-hover:scale-110 transition-transform duration-500 shadow-sm">
                <FileImage size={40} />
              </div>
              <div className="p-5 bg-emerald-50 text-emerald-600 rounded-[30px] group-hover:scale-110 transition-transform duration-500 shadow-sm">
                <FileText size={40} />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                點擊或拖放檔案至此
              </h3>
              <p className="text-slate-400 font-bold text-sm">
                支援 Excel 截圖圖片 或 標準 CSV 檔案格式
              </p>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <button className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl group-hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-3">
                <Upload size={20} />
                選擇檔案匯入
              </button>
              
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
                <Info size={12} />
                Multifile selection supported
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 裝飾性背景元素 */}
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        <Upload size={200} />
      </div>
    </div>
  );
};

export default FileUpload;