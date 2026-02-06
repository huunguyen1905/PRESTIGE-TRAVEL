
import React, { useState } from 'react';
import { Shirt, LayoutList, PieChart } from 'lucide-react';
import { LinenTable } from './LinenTable';
import { LinenDashboard } from './LinenDashboard';

export const LinenManager: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Main Header with Toggle */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2 w-full md:w-auto">
                <Shirt className="text-brand-600" size={24} />
                <div>
                    <h2 className="font-bold text-slate-800 text-lg">Quản lý Đồ Vải (Linen)</h2>
                    <p className="text-xs text-slate-500 font-medium">Theo dõi tồn kho, công nợ nhà giặt và hư hao</p>
                </div>
            </div>
            
            <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200">
                <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        viewMode === 'list' 
                        ? 'bg-white text-brand-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <LayoutList size={16} /> Danh sách
                </button>
                <button
                    onClick={() => setViewMode('analytics')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        viewMode === 'analytics' 
                        ? 'bg-white text-brand-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <PieChart size={16} /> Phân tích
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
            {viewMode === 'list' ? <LinenTable /> : <LinenDashboard />}
        </div>
    </div>
  );
};
