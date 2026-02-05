
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Expense } from '../types';
import { 
  format, isSameMonth, parseISO, startOfWeek, endOfWeek, 
  isWithinInterval, isSameDay, addDays, addWeeks, addMonths, 
  startOfMonth, endOfMonth 
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ExpenseModal } from '../components/ExpenseModal';
import { Plus, Pencil, Trash2, Calendar, Search, History, Wallet, AlertTriangle, CheckCircle, Clock, User, ArrowRight, Lock, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { ListFilter, FilterOption } from '../components/ListFilter';

type FilterMode = 'day' | 'week' | 'month';

export const Expenses: React.FC = () => {
  const { expenses, deleteExpense, settings, shifts } = useAppContext();
  const [activeTab, setActiveTab] = useState<'expenses' | 'shifts'>('expenses');
  
  // --- EXPENSE LOGIC ---
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // New Filter States
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const categoryOptions: FilterOption[] = useMemo(() => {
    return [
      { label: 'Tất cả mục chi', value: 'All' },
      ...settings.expense_categories.map(cat => ({
        label: cat,
        value: cat
      }))
    ];
  }, [settings.expense_categories]);

  // Navigation Handlers
  const handleNavigate = (direction: number) => {
      if (filterMode === 'day') setCurrentDate(prev => addDays(prev, direction));
      else if (filterMode === 'week') setCurrentDate(prev => addWeeks(prev, direction));
      else setCurrentDate(prev => addMonths(prev, direction));
  };

  const getRangeLabel = () => {
      if (filterMode === 'day') return format(currentDate, 'dd/MM/yyyy');
      if (filterMode === 'month') return `Tháng ${format(currentDate, 'MM/yyyy')}`;
      
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM/yyyy')}`;
  };

  const filteredExpenses = useMemo(() => {
     let start: Date, end: Date;

     if (filterMode === 'day') {
         start = new Date(currentDate); start.setHours(0,0,0,0);
         end = new Date(currentDate); end.setHours(23,59,59,999);
     } else if (filterMode === 'week') {
         start = startOfWeek(currentDate, { weekStartsOn: 1 });
         end = endOfWeek(currentDate, { weekStartsOn: 1 });
     } else {
         start = startOfMonth(currentDate);
         end = endOfMonth(currentDate);
     }
     
     return expenses.filter(e => {
        const eDate = parseISO(e.expenseDate);
        
        // 1. Time Filter
        let matchesTime = false;
        if (filterMode === 'day') matchesTime = isSameDay(eDate, currentDate);
        else matchesTime = isWithinInterval(eDate, { start, end });

        // 2. Category Filter
        const matchesCategory = categoryFilter === 'All' || e.expenseCategory === categoryFilter;
        
        // 3. Search Filter
        const matchesSearch = e.expenseContent.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              e.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (e.note || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesTime && matchesCategory && matchesSearch;
     });
  }, [expenses, currentDate, filterMode, categoryFilter, searchTerm]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredExpenses]);

  const handleAdd = () => {
    setEditingExpense(null);
    setModalOpen(true);
  };

  const handleEdit = (e: Expense) => {
    setEditingExpense(e);
    setModalOpen(true);
  };

  // --- SHIFTS LOGIC ---
  const closedShifts = useMemo(() => {
      return shifts
        .filter(s => s.status === 'Closed')
        .sort((a, b) => new Date(b.end_time || '').getTime() - new Date(a.end_time || '').getTime());
  }, [shifts]);

  return (
    <div className="space-y-6 animate-enter pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">Tài Chính & Giao Ca</h1>
            <p className="text-sm text-slate-500">Quản lý dòng tiền, chi phí và lịch sử ca làm việc.</p>
         </div>
         
         {/* TAB SWITCHER */}
         <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
             <button 
                onClick={() => setActiveTab('expenses')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'expenses' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 <Wallet size={16}/> Quản lý Chi phí
             </button>
             <button 
                onClick={() => setActiveTab('shifts')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'shifts' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 <History size={16}/> Lịch sử Giao Ca
             </button>
         </div>
      </div>

      {/* --- TAB 1: EXPENSES CONTENT --- */}
      {activeTab === 'expenses' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 w-full xl:w-auto">
                    <div className="p-3 bg-rose-50 rounded-xl text-rose-600 border border-rose-100"><Wallet size={24}/></div>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng chi ({getRangeLabel()})</div>
                        <div className="text-2xl font-black text-rose-600">{totalExpense.toLocaleString()} ₫</div>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                    {/* Filter Mode Switcher */}
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button onClick={() => setFilterMode('day')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterMode === 'day' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Ngày</button>
                        <button onClick={() => setFilterMode('week')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterMode === 'week' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Tuần</button>
                        <button onClick={() => setFilterMode('month')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterMode === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Tháng</button>
                    </div>

                    {/* Date Navigator */}
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                        <button onClick={() => handleNavigate(-1)} className="p-2 hover:bg-white text-slate-500 border-r border-slate-200 transition-colors"><ChevronLeft size={18}/></button>
                        <div className="px-4 py-2 text-sm font-bold text-slate-700 min-w-[140px] text-center flex items-center justify-center gap-2">
                            <Calendar size={14} className="text-slate-400"/>
                            {getRangeLabel()}
                        </div>
                        <button onClick={() => handleNavigate(1)} className="p-2 hover:bg-white text-slate-500 border-l border-slate-200 transition-colors"><ChevronRight size={18}/></button>
                    </div>

                    <button onClick={handleAdd} className="w-full md:w-auto bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 active:scale-95 whitespace-nowrap">
                        <Plus size={20} /> <span className="hidden md:inline">Thêm khoản chi</span>
                    </button>
                </div>
            </div>

            <ListFilter 
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                options={categoryOptions}
                selectedFilter={categoryFilter}
                onFilterChange={setCategoryFilter}
                placeholder="Tìm theo nội dung, cơ sở, ghi chú..."
            />

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase font-extrabold text-[10px] tracking-widest">
                        <tr>
                            <th className="p-lg">Ngày chi</th>
                            <th className="p-lg">Cơ sở / Phân loại</th>
                            <th className="p-lg">Nội dung</th>
                            <th className="p-lg text-right">Số tiền</th>
                            <th className="p-lg text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredExpenses.sort((a,b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(e => (
                            <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="p-lg">
                                <div className="font-bold text-slate-700">{format(parseISO(e.expenseDate), 'dd/MM/yyyy')}</div>
                                <div className="text-[10px] text-slate-400 font-medium">ID: {e.id}</div>
                                </td>
                                <td className="p-lg">
                                <div className="text-slate-800 font-bold text-xs">{e.facilityName}</div>
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black text-slate-500 border border-slate-200 uppercase mt-1 inline-block tracking-wider">
                                    {e.expenseCategory}
                                </span>
                                </td>
                                <td className="p-lg">
                                <div className="text-slate-800 font-bold">{e.expenseContent}</div>
                                {e.note && <div className="text-xs text-slate-400 mt-1 italic line-clamp-1">{e.note}</div>}
                                </td>
                                <td className="p-lg text-right font-black text-rose-600 text-lg">
                                -{Number(e.amount).toLocaleString()} ₫
                                </td>
                                <td className="p-lg text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => handleEdit(e)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Sửa">
                                        <Pencil size={18} />
                                    </button>
                                    <button onClick={() => { if(confirm('Bạn có chắc muốn xóa khoản chi này?')) deleteExpense(e.id); }} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Xóa">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                </td>
                            </tr>
                        ))}
                        {filteredExpenses.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-2xl text-center">
                                <div className="flex flex-col items-center gap-md text-slate-400">
                                    <Search size={48} strokeWidth={1} />
                                    <p className="font-bold">Không tìm thấy chi phí phù hợp.</p>
                                </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
                {filteredExpenses.sort((a,b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(e => (
                    <div key={e.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-bold text-slate-800">{e.expenseContent}</div>
                                <div className="text-xs text-slate-500">{format(parseISO(e.expenseDate), 'dd/MM/yyyy')} - {e.facilityName}</div>
                            </div>
                            <span className="font-black text-rose-600">-{Number(e.amount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black text-slate-500 border border-slate-200 uppercase">
                                {e.expenseCategory}
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(e)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Pencil size={16}/></button>
                                <button onClick={() => { if(confirm('Xóa?')) deleteExpense(e.id); }} className="p-2 text-rose-600 bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredExpenses.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        <Search size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Không tìm thấy chi phí.</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- TAB 2: SHIFT HISTORY CONTENT --- */}
      {activeTab === 'shifts' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
              {/* Summary Header if needed, for now just list */}
              
              {/* DESKTOP TABLE */}
              <div className="hidden md:block bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase font-extrabold text-[10px] tracking-widest">
                              <tr>
                                  <th className="p-4">Thời gian (Ca)</th>
                                  <th className="p-4">Nhân sự thực hiện</th>
                                  <th className="p-4 text-center">Dòng tiền trong ca</th>
                                  <th className="p-4 text-right">Két sắt (Bàn giao)</th>
                                  <th className="p-4 text-center">Trạng thái</th>
                                  <th className="p-4">Ghi chú</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {closedShifts.map(s => {
                                  const diff = (s.end_cash_actual || 0) - (s.end_cash_expected || 0);
                                  const isMatched = diff === 0;
                                  
                                  return (
                                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                                          <td className="p-4">
                                              <div className="flex items-center gap-2 font-bold text-slate-700">
                                                  <Clock size={14} className="text-slate-400"/>
                                                  {format(parseISO(s.start_time), 'HH:mm')} 
                                                  <ArrowRight size={12} className="text-slate-300"/>
                                                  {s.end_time ? format(parseISO(s.end_time), 'HH:mm') : '--:--'}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 pl-6">
                                                  {format(parseISO(s.start_time), 'dd/MM/yyyy')}
                                              </div>
                                          </td>
                                          <td className="p-4">
                                              <div className="flex flex-col gap-1">
                                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]"><User size={10}/></div>
                                                      Mở: {s.staff_name}
                                                  </div>
                                                  {s.closed_by_name && (
                                                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                          <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px]"><Lock size={10}/></div>
                                                          Chốt: {s.closed_by_name}
                                                      </div>
                                                  )}
                                              </div>
                                          </td>
                                          <td className="p-4 text-center">
                                              <div className="text-xs font-medium space-y-1">
                                                  <div className="text-emerald-600 flex items-center justify-center gap-1"><span className="font-bold">+</span>{s.total_revenue_cash.toLocaleString()}</div>
                                                  <div className="text-rose-600 flex items-center justify-center gap-1"><span className="font-bold">-</span>{s.total_expense_cash.toLocaleString()}</div>
                                              </div>
                                          </td>
                                          <td className="p-4 text-right">
                                              <div className="text-xs text-slate-500">Lý thuyết: <span className="font-mono">{s.end_cash_expected.toLocaleString()}</span></div>
                                              <div className="font-black text-slate-800 text-sm mt-0.5">{s.end_cash_actual?.toLocaleString() || 0} ₫</div>
                                          </td>
                                          <td className="p-4 text-center">
                                              {isMatched ? (
                                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase border border-emerald-100">
                                                      <CheckCircle size={10}/> Khớp
                                                  </span>
                                              ) : (
                                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black uppercase border border-rose-100 animate-pulse">
                                                      <AlertTriangle size={10}/> Lệch {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                                  </span>
                                              )}
                                          </td>
                                          <td className="p-4">
                                              {s.note ? (
                                                  <div className="text-xs text-slate-600 italic max-w-[200px] truncate" title={s.note}>{s.note}</div>
                                              ) : (
                                                  <span className="text-xs text-slate-300 italic">Không có ghi chú</span>
                                              )}
                                          </td>
                                      </tr>
                                  );
                              })}
                              {closedShifts.length === 0 && (
                                  <tr>
                                      <td colSpan={6} className="p-12 text-center text-slate-400 italic text-sm">Chưa có lịch sử giao ca nào.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* MOBILE LIST */}
              <div className="md:hidden space-y-4">
                  {closedShifts.map(s => {
                      const diff = (s.end_cash_actual || 0) - (s.end_cash_expected || 0);
                      const isMatched = diff === 0;
                      return (
                          <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                              <div className={`absolute top-0 left-0 w-1 h-full ${isMatched ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                              
                              <div className="flex justify-between items-start mb-3 pl-2">
                                  <div>
                                      <div className="text-xs font-bold text-slate-400 uppercase">{format(parseISO(s.start_time), 'dd/MM/yyyy')}</div>
                                      <div className="flex items-center gap-2 font-black text-slate-800 text-lg">
                                          {format(parseISO(s.start_time), 'HH:mm')} - {s.end_time ? format(parseISO(s.end_time), 'HH:mm') : '--:--'}
                                      </div>
                                  </div>
                                  {isMatched ? (
                                      <div className="text-emerald-600 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                          <CheckCircle size={12}/> KHỚP
                                      </div>
                                  ) : (
                                      <div className="text-rose-600 font-bold text-xs flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">
                                          <AlertTriangle size={12}/> {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                      </div>
                                  )}
                              </div>

                              <div className="grid grid-cols-2 gap-3 mb-3 pl-2">
                                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Thực thu</div>
                                      <div className="font-bold text-emerald-600">+{s.total_revenue_cash.toLocaleString()}</div>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Thực chi</div>
                                      <div className="font-bold text-rose-600">-{s.total_expense_cash.toLocaleString()}</div>
                                  </div>
                              </div>

                              <div className="flex justify-between items-center pl-2 pt-2 border-t border-slate-100 text-xs">
                                  <div className="text-slate-600">
                                      <span className="font-bold">Mở:</span> {s.staff_name}
                                  </div>
                                  <div className="text-slate-600">
                                      <span className="font-bold">Chốt:</span> {s.closed_by_name || '--'}
                                  </div>
                              </div>
                              
                              {s.note && (
                                  <div className="mt-3 bg-yellow-50 p-2 rounded text-xs text-slate-600 italic ml-2 border border-yellow-100">
                                      {s.note}
                                  </div>
                              )}
                          </div>
                      )
                  })}
                  {closedShifts.length === 0 && (
                      <div className="text-center py-10 text-slate-400 italic text-sm">Chưa có lịch sử giao ca nào.</div>
                  )}
              </div>
          </div>
      )}

      <ExpenseModal 
         isOpen={isModalOpen} 
         onClose={() => setModalOpen(false)} 
         expense={editingExpense} 
      />
    </div>
  );
};
