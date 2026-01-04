
import React, { useState } from 'react';
import { Customer } from '../types';
import { MapPin, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock } from 'lucide-react';

interface CustomerTableProps {
  customers: Customer[];
}

const CustomerTable: React.FC<CustomerTableProps> = ({ customers }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil(customers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentData = customers.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 uppercase tracking-wider text-[11px]">客戶代號</th>
              <th className="px-6 py-4">客戶名稱</th>
              <th className="px-6 py-4">送貨地址</th>
              <th className="px-6 py-4">縣市</th>
              <th className="px-6 py-4 text-center">同步時間</th>
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {currentData.length > 0 ? (
              currentData.map((c, idx) => (
                <tr key={`${c.id}-${idx}`} className="hover:bg-blue-50/40 transition-colors group">
                  <td className="px-6 py-4 font-mono font-bold text-blue-600">{c.id}</td>
                  <td className="px-6 py-4 font-bold">{c.name}</td>
                  <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{c.address}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600 border border-slate-200">
                      {c.city}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-xs text-slate-400 font-medium">
                    <div className="flex items-center justify-center gap-1.5">
                      <Clock size={12} />
                      {c.createdAt || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {c.mapUrl ? (
                      <a 
                        href={c.mapUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold transition-colors"
                      >
                        <MapPin size={14} />
                        開啟地圖
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs italic">無定位</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-medium">資料庫目前無任何紀錄</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {customers.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-slate-500 font-bold">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Page Size</span>
              <select 
                value={pageSize}
                onChange={handlePageSizeChange}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs"
              >
                {[10, 20, 30, 40, 50].map(size => (
                  <option key={size} value={size}>{size} 筆 / 頁</option>
                ))}
              </select>
            </div>
            <span className="text-xs">
              顯示 {startIndex + 1}-{Math.min(startIndex + pageSize, customers.length)} / 共 {customers.length} 筆
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all"
            >
              <ChevronsLeft size={16} />
            </button>
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="px-4 text-xs font-black text-slate-700">
              {currentPage} / {totalPages}
            </div>

            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all"
            >
              <ChevronRight size={16} />
            </button>
            <button 
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerTable;
