
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Collaborator, ShiftSchedule, AttendanceAdjustment, LeaveRequest, TimeLog } from '../types';
import { CollaboratorModal } from '../components/CollaboratorModal';
import { 
  Pencil, Trash2, Plus, Search, ClipboardList,
  ChevronLeft, ChevronRight, Calendar, Edit2, FileDown, Wallet, DollarSign, Sun, Moon, 
  CheckCircle, AlertCircle, Send, User, Cake, HeartPulse, ShieldCheck, CalendarDays, Palmtree, UserCheck, Loader2, X, Check, Clock, MapPin, ToggleLeft, ToggleRight, List, QrCode
} from 'lucide-react';
import { HRTabs, HRTabType } from '../components/HRTabs';
import { ListFilter, FilterOption } from '../components/ListFilter';
import { ShiftScheduleModal } from '../components/ShiftScheduleModal';
import { AttendanceAdjustmentModal } from '../components/AttendanceAdjustmentModal';
import { PayrollQrModal } from '../components/PayrollQrModal';
import { format, addDays, isSameDay, isWithinInterval, parseISO, startOfWeek, isSameMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Modal } from '../components/Modal';

export const Collaborators: React.FC = () => {
  const { collaborators, deleteCollaborator, schedules, adjustments, notify, currentUser, leaveRequests, addLeaveRequest, updateLeaveRequest, triggerWebhook, timeLogs, salaryAdvances, approveAdvance } = useAppContext();
  const [activeTab, setActiveTab] = useState<HRTabType>('overview');
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCollab, setEditingCollab] = useState<Collaborator | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedMonthStr = format(currentDate, 'yyyy-MM');

  const [timesheetMode, setTimesheetMode] = useState<'schedule' | 'realtime'>('schedule');
  const [mobileSelectedDate, setMobileSelectedDate] = useState(new Date());

  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Collaborator | null>(null);
  const [selectedDateSlot, setSelectedDateSlot] = useState<Date>(new Date());
  const [activeSchedule, setActiveSchedule] = useState<ShiftSchedule | null>(null);

  const [isAdjModalOpen, setAdjModalOpen] = useState(false);
  const [selectedAdjStaff, setSelectedAdjStaff] = useState<Collaborator | null>(null);

  const [isLeaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveRequest>>({
      leave_type: 'Nghỉ phép năm',
      reason: '',
      start_date: new Date().toISOString().substring(0, 10),
      end_date: new Date().toISOString().substring(0, 10)
  });
  
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);

  // Payroll Modal
  const [isPayrollModalOpen, setPayrollModalOpen] = useState(false);
  const [payrollStaff, setPayrollStaff] = useState<Collaborator | null>(null);
  const [payrollAmount, setPayrollAmount] = useState(0);

  const isRestricted = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Buồng phòng';

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0,0,0,0);

    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  useEffect(() => {
      const start = weekDays[0];
      const end = weekDays[6];
      if (!isWithinInterval(mobileSelectedDate, { start, end })) {
          setMobileSelectedDate(start);
      }
  }, [weekDays, mobileSelectedDate]);

  const timesheetData = useMemo(() => {
     const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
     const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
     end.setHours(23, 59, 59, 999);
     
     return collaborators.filter(c => c.role !== 'Nhà đầu tư').map(staff => {
        let standardDays = 0;
        let nightShifts = 0;
        let dayShifts = 0;
        let lateCount = 0;
        let totalLateMinutes = 0;

        if (timesheetMode === 'schedule') {
            const monthlySchedules = schedules.filter(s => 
               s.staff_id === staff.id && 
               isWithinInterval(new Date(s.date), { start, end })
            );

            monthlySchedules.forEach(s => {
               if (s.shift_type === 'Sáng' || s.shift_type === 'Chiều' as any) {
                   standardDays += 1;
                   dayShifts += 1;
               } else if (s.shift_type === 'Tối') {
                   standardDays += 1.2;
                   nightShifts += 1;
               }
            });
        } else {
            const validLogs = timeLogs.filter(l => 
                l.staff_id === staff.id && 
                isSameMonth(parseISO(l.check_in_time), currentDate) &&
                (l.status === 'Valid' || l.status === 'Pending')
            );

            validLogs.forEach(log => {
                const checkIn = parseISO(log.check_in_time);
                const hour = checkIn.getHours();
                const minutes = checkIn.getMinutes();
                
                if (hour >= 14) {
                    nightShifts += 1;
                    standardDays += 1.2;
                    if (hour > 18 || (hour === 18 && minutes > 15)) {
                        lateCount++;
                        totalLateMinutes += ((hour - 18) * 60 + (minutes - 0));
                    }
                } else {
                    dayShifts += 1;
                    standardDays += 1;
                    if (hour > 6 || (hour === 6 && minutes > 15)) {
                        lateCount++;
                        totalLateMinutes += ((hour - 6) * 60 + (minutes - 0));
                    }
                }
            });
        }

        const adj = adjustments.find(a => a.staff_id === staff.id && a.month === selectedMonthStr);
        if (adj) {
            standardDays += Number(adj.standard_days_adj || 0);
        }

        const baseSalary = Number(staff.baseSalary) || 0;
        const dailyWage = baseSalary / 26; 
        const calculatedSalary = dailyWage * standardDays;

        return {
           staff,
           standardDays,
           dayShifts,
           nightShifts,
           lateCount,
           totalLateMinutes,
           calculatedSalary,
           adjustment: adj
        };
     });
  }, [collaborators, schedules, adjustments, currentDate, selectedMonthStr, timesheetMode, timeLogs]);

  const roleOptions: FilterOption[] = useMemo(() => {
    const counts = collaborators.reduce((acc, c) => {
      acc[c.role] = (acc[c.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { label: 'Tất cả', value: 'All', count: collaborators.length },
      { label: 'Admin', value: 'Admin', count: counts['Admin'] || 0 },
      { label: 'Quản lý', value: 'Quản lý', count: counts['Quản lý'] || 0 },
      { label: 'Lễ tân', value: 'Nhân viên', count: counts['Nhân viên'] || 0 },
      { label: 'Buồng phòng', value: 'Buồng phòng', count: counts['Buồng phòng'] || 0 },
    ];
  }, [collaborators]);

  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(c => {
      const nameMatch = (c.collaboratorName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'All' || c.role === roleFilter;
      return nameMatch && matchesRole;
    });
  }, [collaborators, searchTerm, roleFilter]);

  const overviewStats = useMemo(() => {
      const totalStaff = collaborators.length;
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      const onLeaveToday = leaveRequests.filter(lr => 
          lr.status === 'Approved' && 
          todayStr >= lr.start_date && 
          todayStr <= lr.end_date
      );

      const pendingLeaves = leaveRequests.filter(lr => lr.status === 'Pending');
      const totalSalaryEstimate = timesheetData.reduce((acc, curr) => acc + curr.calculatedSalary, 0);

      const todayShifts = schedules.filter(s => s.date === todayStr);
      const morningStaff = collaborators.filter(c => todayShifts.some(s => s.staff_id === c.id && s.shift_type === 'Sáng'));
      const nightStaff = collaborators.filter(c => todayShifts.some(s => s.staff_id === c.id && s.shift_type === 'Tối'));

      return { totalStaff, onLeaveToday, pendingLeaves, totalSalaryEstimate, morningStaff, nightStaff };
  }, [collaborators, leaveRequests, timesheetData, schedules]);

  const handleEdit = (c: Collaborator) => {
    setEditingCollab(c);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingCollab(null);
    setModalOpen(true);
  };

  const openScheduleSlot = (staff: Collaborator, date: Date) => {
    const existing = schedules.find(s => s.staff_id === staff.id && s.date === format(date, 'yyyy-MM-dd'));
    setSelectedStaff(staff);
    setSelectedDateSlot(date);
    setActiveSchedule(existing || null);
    setScheduleModalOpen(true);
  };

  const openAdjustment = (staff: Collaborator) => {
      setSelectedAdjStaff(staff);
      setAdjModalOpen(true);
  };

  const handleOpenPayroll = (staff: Collaborator, amount: number) => {
      setPayrollStaff(staff);
      setPayrollAmount(amount);
      setPayrollModalOpen(true);
  };

  const submitLeaveRequest = async () => {
      if (!leaveForm.reason || !currentUser) {
          notify('error', 'Vui lòng nhập lý do nghỉ.');
          return;
      }
      
      const req: LeaveRequest = {
          id: `LR${Date.now()}`,
          staff_id: currentUser.id,
          staff_name: currentUser.collaboratorName,
          start_date: leaveForm.start_date!,
          end_date: leaveForm.end_date!,
          leave_type: leaveForm.leave_type as any,
          reason: leaveForm.reason,
          status: 'Pending',
          created_at: new Date().toISOString()
      };

      await addLeaveRequest(req);
      setLeaveModalOpen(false);
      setLeaveForm({ ...leaveForm, reason: '' }); 
      notify('success', 'Đã gửi đơn xin nghỉ.');
      
      triggerWebhook('leave_update', {
          event: 'new_request',
          staff: req.staff_name,
          type: req.leave_type,
          dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`,
          reason: req.reason,
          status: 'Chờ duyệt'
      });

      triggerWebhook('general_notification', {
          type: 'STAFF_LEAVE',
          payload: {
              staff_name: req.staff_name,
              reason: req.reason,
              dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`,
              status: 'PENDING'
          }
      });
  };

  const handleApproveLeave = async (req: LeaveRequest, isApproved: boolean) => {
      if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Quản lý') {
          notify('error', 'Bạn không có quyền duyệt đơn này.');
          return;
      }

      setProcessingLeaveId(req.id);
      try {
          const status = isApproved ? 'Approved' : 'Rejected';
          await updateLeaveRequest({ ...req, status });
          
          if (isApproved) {
              notify('success', `Đã duyệt đơn của ${req.staff_name}.`);
          } else {
              notify('info', `Đã từ chối đơn của ${req.staff_name}.`);
          }

          triggerWebhook('leave_update', {
              event: 'status_update',
              staff: req.staff_name,
              status: isApproved ? 'ĐÃ DUYỆT ✅' : 'ĐÃ TỪ CHỐI ❌',
              dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`,
              approver: currentUser?.collaboratorName || 'Admin'
          });

          triggerWebhook('general_notification', {
              type: 'STAFF_LEAVE_UPDATE', 
              payload: {
                  staff_name: req.staff_name,
                  status: isApproved ? 'APPROVED' : 'REJECTED',
                  approver: currentUser?.collaboratorName
              }
          });
      } catch (err) {
          notify('error', 'Có lỗi khi cập nhật trạng thái.');
      } finally {
          setProcessingLeaveId(null);
      }
  };

  const handleApproveAdvance = async (id: string, approved: boolean) => {
      await approveAdvance(id, approved);
  };

  const getShiftColor = (type: string) => {
    switch(type) {
      case 'Sáng': return 'bg-amber-500 text-white shadow-amber-200';
      case 'Tối': return 'bg-indigo-700 text-white shadow-indigo-200';
      case 'OFF': return 'bg-slate-200 text-slate-500';
      default: return 'bg-slate-100 text-slate-400';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'Admin': return 'bg-rose-50 text-rose-600 border border-rose-100';
      case 'Quản lý': return 'bg-violet-50 text-violet-600 border border-violet-100';
      case 'Buồng phòng': return 'bg-blue-50 text-blue-600 border border-blue-100';
      default: return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    }
  };

  return (
    <div className="space-y-6 animate-enter pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Quản Lý Nhân Sự</h1>
          <p className="text-slate-500 text-sm mt-1">Hệ thống quản lý chấm công & nghỉ phép tập trung.</p>
        </div>
        
        {!isRestricted && activeTab === 'employees' && (
            <button 
            onClick={handleAdd} 
            className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 transition-all shadow-md font-bold active:scale-95"
            >
            <Plus size={20} /> <span className="inline">Thêm nhân viên</span>
            </button>
        )}
      </div>

      <HRTabs activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* --- TAB 1: OVERVIEW DASHBOARD --- */}
      {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              {/* TOP CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:border-blue-200 transition-all relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><User size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><User size={20}/></div>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">Total</span>
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.totalStaff}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Tổng nhân sự</div>
                      </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:border-rose-200 transition-all relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><HeartPulse size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><HeartPulse size={20}/></div>
                          {overviewStats.onLeaveToday.length > 0 && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span></span>}
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.onLeaveToday.length}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Nghỉ hôm nay</div>
                      </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 cursor-pointer hover:border-amber-200 hover:shadow-md transition-all relative overflow-hidden group" onClick={() => setActiveTab('leave')}>
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldCheck size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><ShieldCheck size={20}/></div>
                          {overviewStats.pendingLeaves.length > 0 && (
                              <span className="text-xs font-black bg-red-500 text-white px-2 py-0.5 rounded-full shadow-md animate-bounce">
                                  {overviewStats.pendingLeaves.length}
                              </span>
                          )}
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.pendingLeaves.length}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">Đơn chờ duyệt <ChevronRight size={12}/></div>
                      </div>
                  </div>

                  {!isRestricted && (
                      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg flex flex-col justify-between h-32 text-white relative overflow-hidden">
                          <div className="absolute right-0 top-0 p-4 opacity-10"><Wallet size={64}/></div>
                          <div className="flex justify-between items-start relative z-10">
                              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm"><Wallet size={20}/></div>
                          </div>
                          <div className="relative z-10">
                              <div className="text-2xl font-black">{overviewStats.totalSalaryEstimate.toLocaleString()} ₫</div>
                              <div className="text-xs text-emerald-100 font-bold uppercase tracking-wider mt-1">Lương dự tính T{format(currentDate, 'MM')}</div>
                          </div>
                      </div>
                  )}
              </div>

              {/* COLUMNS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* COL 1: SHIFT MONITOR */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                              <Clock size={18} className="text-brand-600"/> Ca Trực Hôm Nay
                          </h3>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                              {format(new Date(), 'EEEE, dd/MM', {locale: vi})}
                          </span>
                      </div>
                      
                      <div className="space-y-4 flex-1">
                          {/* Morning */}
                          <div className="relative">
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm"><Sun size={16}/></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700 uppercase">Ca Sáng</div>
                                      <div className="text-[10px] text-slate-400 font-medium">06:00 - 18:00</div>
                                  </div>
                              </div>
                              <div className="bg-amber-50/30 rounded-xl p-3 border border-amber-100 space-y-2 min-h-[80px]">
                                  {overviewStats.morningStaff.length > 0 ? (
                                      overviewStats.morningStaff.map(s => (
                                          <div key={s.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-amber-50/50 shadow-sm">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{backgroundColor: s.color}}>{s.collaboratorName.charAt(0)}</div>
                                              <div>
                                                  <div className="text-xs font-bold text-slate-700">{s.collaboratorName}</div>
                                                  <div className="text-[9px] text-slate-400 uppercase font-medium">{s.role}</div>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa phân ca</div>
                                  )}
                              </div>
                          </div>

                          {/* Night */}
                          <div className="relative pt-2">
                              <div className="absolute left-4 top-[-10px] bottom-full w-[2px] bg-slate-100 -z-10"></div>
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm"><Moon size={16}/></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700 uppercase">Ca Tối</div>
                                      <div className="text-[10px] text-slate-400 font-medium">18:00 - 06:00</div>
                                  </div>
                              </div>
                              <div className="bg-indigo-50/30 rounded-xl p-3 border border-indigo-100 space-y-2 min-h-[80px]">
                                  {overviewStats.nightStaff.length > 0 ? (
                                      overviewStats.nightStaff.map(s => (
                                          <div key={s.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-indigo-50/50 shadow-sm">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{backgroundColor: s.color}}>{s.collaboratorName.charAt(0)}</div>
                                              <div>
                                                  <div className="text-xs font-bold text-slate-700">{s.collaboratorName}</div>
                                                  <div className="text-[9px] text-slate-400 uppercase font-medium">{s.role}</div>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa phân ca</div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* COL 2: LEAVE STATUS */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                              <Palmtree size={18} className="text-rose-500"/> Nghỉ Phép
                          </h3>
                          <button onClick={() => setLeaveModalOpen(true)} className="text-[10px] font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100 hover:bg-brand-100 transition-colors flex items-center gap-1">
                              <Plus size={12}/> Xin nghỉ
                          </button>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                          {leaveRequests.length === 0 ? (
                              <div className="h-40 flex items-center justify-center text-slate-300 text-xs italic">Không có đơn nghỉ phép nào.</div>
                          ) : (
                              <div className="space-y-3">
                                  {leaveRequests.map(req => {
                                      const isPending = req.status === 'Pending';
                                      return (
                                          <div key={req.id} className={`p-3 rounded-xl border transition-all ${isPending ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-100'}`}>
                                              <div className="flex justify-between items-start mb-2">
                                                  <div>
                                                      <div className="text-xs font-bold text-slate-700">{req.staff_name}</div>
                                                      <div className="text-[10px] text-slate-500">{req.leave_type}</div>
                                                  </div>
                                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase border ${isPending ? 'bg-amber-100 text-amber-700 border-amber-200' : req.status === 'Approved' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                      {req.status === 'Pending' ? 'Chờ duyệt' : req.status === 'Approved' ? 'Đã duyệt' : 'Từ chối'}
                                                  </span>
                                              </div>
                                              
                                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono bg-slate-50/50 p-1.5 rounded mb-2">
                                                  <Calendar size={12}/> {format(parseISO(req.start_date), 'dd/MM')} - {format(parseISO(req.end_date), 'dd/MM')}
                                              </div>
                                              
                                              {req.reason && <div className="text-[11px] text-slate-600 italic mb-2">"{req.reason}"</div>}

                                              {/* APPROVAL ACTIONS */}
                                              {isPending && !isRestricted && (
                                                  <div className="flex gap-2 pt-2 border-t border-amber-200/50">
                                                      <button 
                                                          onClick={() => handleApproveLeave(req, true)}
                                                          disabled={processingLeaveId === req.id}
                                                          className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1 shadow-sm"
                                                      >
                                                          {processingLeaveId === req.id ? <Loader2 size={10} className="animate-spin"/> : <Check size={10}/>} Duyệt
                                                      </button>
                                                      <button 
                                                          onClick={() => handleApproveLeave(req, false)}
                                                          disabled={processingLeaveId === req.id}
                                                          className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                                                      >
                                                          <X size={10}/> Từ chối
                                                      </button>
                                                  </div>
                                              )}
                                          </div>
                                      )
                                  })}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* COL 3: RECENT ACTIVITIES (Placeholders) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-full min-h-[400px] relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                          <ClipboardList size={100} />
                      </div>
                      <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <CalendarDays size={18} className="text-slate-400"/> Lịch sử hoạt động
                      </h3>
                      <div className="space-y-4">
                          {[1,2,3].map(i => (
                              <div key={i} className="flex gap-3 relative pl-4 border-l-2 border-slate-100 pb-4 last:border-0">
                                  <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white shadow-sm"></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700">Cập nhật lịch làm việc</div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">Admin • 2 giờ trước</div>
                                  </div>
                              </div>
                          ))}
                          <div className="text-center text-xs text-slate-400 italic pt-4">Đang cập nhật thêm...</div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB 2: EMPLOYEES LIST --- */}
      {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
              <div className="p-4 border-b border-slate-100">
                  <ListFilter 
                      searchTerm={searchTerm} 
                      onSearchChange={setSearchTerm} 
                      options={roleOptions} 
                      selectedFilter={roleFilter} 
                      onFilterChange={setRoleFilter}
                      placeholder="Tìm theo tên, chức vụ..."
                  />
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          <tr>
                              <th className="p-4">Nhân viên</th>
                              <th className="p-4">Liên hệ</th>
                              <th className="p-4">Lương cơ bản</th>
                              <th className="p-4 text-center">Thao tác</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                          {filteredCollaborators.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="p-4">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{backgroundColor: c.color}}>{c.collaboratorName.charAt(0)}</div>
                                          <div>
                                              <div className="font-bold text-slate-800">{c.collaboratorName}</div>
                                              <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase border ${getRoleBadgeColor(c.role)}`}>{c.role}</span>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="p-4">
                                      <div className="text-slate-600 font-mono text-xs">{c.username}</div>
                                      <div className="text-[10px] text-slate-400">••••••</div>
                                  </td>
                                  <td className="p-4 font-mono font-bold text-slate-700">{(c.baseSalary || 0).toLocaleString()} ₫</td>
                                  <td className="p-4 text-center">
                                      {!isRestricted && (
                                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Pencil size={16}/></button>
                                              <button onClick={() => { if(confirm('Xóa nhân viên này?')) deleteCollaborator(c.id); }} className="p-2 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button>
                                          </div>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- TAB 3: SHIFTS CALENDAR --- */}
      {activeTab === 'shifts' && (
          <div className="space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} className="text-slate-500"/></button>
                      <span className="font-bold text-slate-800 text-sm w-32 text-center">
                          Tuần {format(currentDate, 'ww')} ({format(weekDays[0], 'dd/MM')} - {format(weekDays[6], 'dd/MM')})
                      </span>
                      <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} className="text-slate-500"/></button>
                  </div>
                  <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold text-brand-600 hover:bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200 transition-colors">Hôm nay</button>
              </div>

              {/* Responsive Calendar View */}
              <div className="hidden md:grid grid-cols-8 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 p-4 font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center justify-center">Nhân viên</div>
                  {weekDays.map(day => (
                      <div key={day.toISOString()} className={`bg-slate-50 p-3 text-center ${isSameDay(day, new Date()) ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}>
                          <div className="text-[10px] font-bold uppercase">{format(day, 'EEE', {locale: vi})}</div>
                          <div className="text-lg font-black">{format(day, 'dd')}</div>
                      </div>
                  ))}

                  {collaborators.filter(c => c.role !== 'Nhà đầu tư').map(staff => (
                      <React.Fragment key={staff.id}>
                          <div className="bg-white p-3 flex items-center gap-2 border-r border-slate-100">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{backgroundColor: staff.color}}>{staff.collaboratorName.charAt(0)}</div>
                              <span className="text-xs font-bold text-slate-700 truncate">{staff.collaboratorName}</span>
                          </div>
                          {weekDays.map(day => {
                              const schedule = schedules.find(s => s.staff_id === staff.id && s.date === format(day, 'yyyy-MM-dd'));
                              return (
                                  <div 
                                      key={day.toISOString()} 
                                      onClick={() => !isRestricted && openScheduleSlot(staff, day)}
                                      className={`bg-white hover:bg-slate-50 transition-colors cursor-pointer p-2 flex items-center justify-center border-b border-r border-slate-50 last:border-r-0 h-16 relative group`}
                                  >
                                      {schedule ? (
                                          <div className={`w-full h-full rounded-lg flex flex-col items-center justify-center text-[10px] font-bold uppercase shadow-sm ${getShiftColor(schedule.shift_type)}`}>
                                              {schedule.shift_type}
                                              {schedule.note && <div className="w-1.5 h-1.5 bg-white rounded-full mt-1 opacity-50"></div>}
                                          </div>
                                      ) : (
                                          !isRestricted && <Plus size={16} className="text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      )}
                                  </div>
                              );
                          })}
                      </React.Fragment>
                  ))}
              </div>

              {/* Mobile Agenda View */}
              <div className="md:hidden flex flex-col h-[calc(100vh-250px)]">
                  <div className="flex overflow-x-auto no-scrollbar py-2 bg-white border-b border-slate-100 sticky top-0 z-10 gap-2 px-2">
                      {weekDays.map(day => {
                          const isSelected = isSameDay(day, mobileSelectedDate);
                          const isToday = isSameDay(day, new Date());
                          return (
                              <button 
                                  key={day.toISOString()} 
                                  onClick={() => setMobileSelectedDate(day)}
                                  className={`flex flex-col items-center min-w-[50px] p-2 rounded-xl transition-all border ${isSelected ? 'bg-brand-600 text-white border-brand-600 shadow-md transform scale-105' : 'bg-white text-slate-500 border-slate-100'}`}
                              >
                                  <span className="text-[10px] font-bold uppercase">{format(day, 'EEE', {locale: vi})}</span>
                                  <span className="text-lg font-black">{format(day, 'dd')}</span>
                                  {isToday && <div className="w-1 h-1 bg-current rounded-full mt-1"></div>}
                              </button>
                          )
                      })}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                      {collaborators.filter(c => c.role !== 'Nhà đầu tư').map(staff => {
                          const schedule = schedules.find(s => s.staff_id === staff.id && s.date === format(mobileSelectedDate, 'yyyy-MM-dd'));
                          return (
                              <div 
                                  key={staff.id} 
                                  onClick={() => !isRestricted && openScheduleSlot(staff, mobileSelectedDate)}
                                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between active:scale-98 transition-transform"
                              >
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{backgroundColor: staff.color}}>{staff.collaboratorName.charAt(0)}</div>
                                      <div>
                                          <div className="font-bold text-slate-800">{staff.collaboratorName}</div>
                                          <div className="text-[10px] text-slate-400 font-bold uppercase">{staff.role}</div>
                                      </div>
                                  </div>
                                  {schedule ? (
                                      <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${getShiftColor(schedule.shift_type)}`}>
                                          {schedule.shift_type}
                                      </span>
                                  ) : (
                                      <span className="text-xs text-slate-300 italic">Chưa xếp</span>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB 4: TIMESHEET & PAYROLL (ADMIN ONLY) --- */}
      {activeTab === 'timesheet' && !isRestricted && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-3">
                 <button onClick={() => setCurrentDate(addMonths(currentDate, -1))} className="p-2 hover:bg-slate-50 rounded-lg"><ChevronLeft size={20} className="text-slate-500"/></button>
                 <span className="font-bold text-slate-800 text-sm uppercase tracking-widest min-w-[120px] text-center">Tháng {format(currentDate, 'MM/yyyy')}</span>
                 <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-50 rounded-lg"><ChevronRight size={20} className="text-slate-500"/></button>
             </div>
             
             <div className="flex bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => setTimesheetMode('schedule')} className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${timesheetMode === 'schedule' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                     <Calendar size={14}/> Theo Lịch Phân Ca
                 </button>
                 <button onClick={() => setTimesheetMode('realtime')} className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${timesheetMode === 'realtime' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>
                     <MapPin size={14}/> Theo GPS Chấm Công
                 </button>
             </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Họ tên nhân viên</th>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">Tổng công</th>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Lương tạm tính</th>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {timesheetData.map(row => (
                    <tr key={row.staff.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black" style={{ backgroundColor: row.staff.color || '#3b82f6' }}>
                            {(row.staff.collaboratorName || '?').charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{row.staff.collaboratorName}</div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase">{row.staff.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                         <div className="text-lg font-black text-brand-700 underline decoration-brand-200 underline-offset-4">{row.standardDays.toFixed(1)}</div>
                         <div className="text-[9px] text-slate-400 font-bold uppercase">{timesheetMode === 'schedule' ? 'Công kế hoạch' : 'Công thực tế'}</div>
                      </td>
                      <td className="p-4 text-right">
                         <div className="text-base font-black text-slate-900 flex items-center justify-end gap-1">
                            <DollarSign size={14} className="text-emerald-500"/>
                            {row.calculatedSalary.toLocaleString(undefined, {maximumFractionDigits: 0})} ₫
                         </div>
                      </td>
                      <td className="p-4 text-center">
                         <div className="flex items-center justify-center gap-1">
                             <button onClick={() => openAdjustment(row.staff)} className="p-2 text-slate-400 hover:text-brand-600 transition-all bg-slate-50 rounded-lg hover:bg-brand-50" title="Sửa công"><Edit2 size={16} /></button>
                             <button onClick={() => handleOpenPayroll(row.staff, row.calculatedSalary)} className="p-2 text-emerald-600 hover:text-emerald-700 transition-all bg-emerald-50 rounded-lg hover:bg-emerald-100" title="Thanh toán QR"><QrCode size={16} /></button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
              {timesheetData.map(row => (
                  <div key={row.staff.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm" style={{ backgroundColor: row.staff.color || '#3b82f6' }}>
                                  {(row.staff.collaboratorName || '?').charAt(0)}
                              </div>
                              <div>
                                  <div className="font-bold text-slate-800 text-sm">{row.staff.collaboratorName}</div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase">{row.staff.role}</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="text-[10px] text-slate-400 font-bold uppercase">Tổng công</div>
                              <div className="text-lg font-black text-brand-600">{row.standardDays.toFixed(1)}</div>
                          </div>
                      </div>
                      
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Lương tạm tính</span>
                          <span className="text-sm font-black text-slate-800 flex items-center gap-1">
                              <DollarSign size={14} className="text-emerald-500"/>
                              {row.calculatedSalary.toLocaleString(undefined, {maximumFractionDigits: 0})} ₫
                          </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                          <button 
                              onClick={() => openAdjustment(row.staff)} 
                              className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all"
                          >
                              <Edit2 size={14}/> Sửa công
                          </button>
                          <button 
                              onClick={() => handleOpenPayroll(row.staff, row.calculatedSalary)} 
                              className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all"
                          >
                              <QrCode size={14}/> Thanh toán
                          </button>
                      </div>
                  </div>
              ))}
              {timesheetData.length === 0 && (
                  <div className="text-center py-10 text-slate-400 italic text-sm">Không có dữ liệu công cho tháng này.</div>
              )}
          </div>
        </div>
      )}

      {/* --- TAB 5: LEAVE REQUESTS --- */}
      {activeTab === 'leave' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-end">
                  <button onClick={() => setLeaveModalOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-md hover:bg-brand-700 transition-all active:scale-95">
                      <Plus size={18}/> Tạo đơn nghỉ phép
                  </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          <tr>
                              <th className="p-4">Nhân viên</th>
                              <th className="p-4">Loại nghỉ</th>
                              <th className="p-4">Thời gian</th>
                              <th className="p-4">Lý do</th>
                              <th className="p-4 text-center">Trạng thái</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                          {leaveRequests.map(req => (
                              <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-4 font-bold text-slate-700">{req.staff_name}</td>
                                  <td className="p-4 text-slate-600">{req.leave_type}</td>
                                  <td className="p-4 font-mono text-xs font-bold text-slate-500">
                                      {format(parseISO(req.start_date), 'dd/MM')} - {format(parseISO(req.end_date), 'dd/MM')}
                                  </td>
                                  <td className="p-4 italic text-slate-500 truncate max-w-[200px]">{req.reason}</td>
                                  <td className="p-4 text-center">
                                      <div className="flex flex-col items-center gap-2">
                                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase border ${
                                              req.status === 'Pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                                              req.status === 'Approved' ? 'bg-green-100 text-green-700 border-green-200' : 
                                              'bg-slate-100 text-slate-500 border-slate-200'
                                          }`}>
                                              {req.status === 'Pending' ? 'Chờ duyệt' : req.status === 'Approved' ? 'Đã duyệt' : 'Từ chối'}
                                          </span>
                                          
                                          {req.status === 'Pending' && !isRestricted && (
                                              <div className="flex gap-1">
                                                  <button onClick={() => handleApproveLeave(req, true)} disabled={processingLeaveId === req.id} className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200">
                                                      <Check size={14}/>
                                                  </button>
                                                  <button onClick={() => handleApproveLeave(req, false)} disabled={processingLeaveId === req.id} className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">
                                                      <X size={14}/>
                                                  </button>
                                              </div>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {leaveRequests.length === 0 && (
                              <tr><td colSpan={5} className="p-10 text-center text-slate-400 italic">Chưa có đơn nghỉ phép nào.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- TAB 6: SALARY ADVANCE (PHASE 2) --- */}
      {activeTab === 'advance' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 text-sm uppercase flex items-center gap-2"><Wallet size={16}/> Danh sách ứng lương</h3>
                  </div>
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          <tr>
                              <th className="p-4">Ngày yêu cầu</th>
                              {!isRestricted && <th className="p-4">Nhân viên</th>}
                              <th className="p-4">Số tiền</th>
                              <th className="p-4">Lý do</th>
                              <th className="p-4 text-center">Trạng thái</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                          {salaryAdvances.filter(a => isRestricted ? a.staff_id === currentUser?.id : true).map(adv => (
                              <tr key={adv.id} className="hover:bg-slate-50/50">
                                  <td className="p-4 font-mono text-xs">{format(parseISO(adv.request_date), 'dd/MM/yyyy')}</td>
                                  {!isRestricted && <td className="p-4 font-bold text-slate-700">{collaborators.find(c => c.id === adv.staff_id)?.collaboratorName || 'Unknown'}</td>}
                                  <td className="p-4 font-bold text-brand-600">{adv.amount.toLocaleString()} ₫</td>
                                  <td className="p-4 text-slate-500 italic">{adv.reason}</td>
                                  <td className="p-4 text-center">
                                      <div className="flex flex-col items-center gap-2">
                                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase border ${
                                              adv.status === 'Pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                                              adv.status === 'Approved' ? 'bg-green-100 text-green-700 border-green-200' : 
                                              'bg-slate-100 text-slate-500 border-slate-200'
                                          }`}>
                                              {adv.status === 'Pending' ? 'Chờ duyệt' : adv.status === 'Approved' ? 'Đã duyệt' : 'Từ chối'}
                                          </span>
                                          {adv.status === 'Pending' && !isRestricted && (
                                              <div className="flex gap-1">
                                                  <button onClick={() => handleApproveAdvance(adv.id, true)} className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"><Check size={14}/></button>
                                                  <button onClick={() => handleApproveAdvance(adv.id, false)} className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"><X size={14}/></button>
                                              </div>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {salaryAdvances.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Không có yêu cầu nào.</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- MODALS --- */}
      <CollaboratorModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} collaborator={editingCollab} />
      
      {selectedStaff && (
        <ShiftScheduleModal 
          isOpen={isScheduleModalOpen} 
          onClose={() => setScheduleModalOpen(false)} 
          staff={selectedStaff} 
          date={selectedDateSlot}
          existingSchedule={activeSchedule}
        />
      )}

      {selectedAdjStaff && (
          <AttendanceAdjustmentModal
            isOpen={isAdjModalOpen}
            onClose={() => setAdjModalOpen(false)}
            staff={selectedAdjStaff}
            month={selectedMonthStr}
            adjustment={timesheetData.find(t => t.staff.id === selectedAdjStaff.id)?.adjustment}
          />
      )}

      {/* LEAVE REQUEST MODAL */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => setLeaveModalOpen(false)} title="Tạo Đơn Xin Nghỉ Phép" size="sm">
          <div className="space-y-4">
              <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Loại nghỉ</label>
                  <select 
                      className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-brand-500 bg-white"
                      value={leaveForm.leave_type}
                      onChange={e => setLeaveForm({...leaveForm, leave_type: e.target.value as any})}
                  >
                      <option value="Nghỉ phép năm">Nghỉ phép năm</option>
                      <option value="Nghỉ ốm">Nghỉ ốm</option>
                      <option value="Việc riêng">Việc riêng</option>
                      <option value="Không lương">Không lương</option>
                  </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Từ ngày</label>
                      <input type="date" className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-brand-500" value={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} />
                  </div>
                  <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đến ngày</label>
                      <input type="date" className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-brand-500" value={leaveForm.end_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} />
                  </div>
              </div>
              <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lý do</label>
                  <textarea 
                      className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-brand-500 h-24" 
                      placeholder="VD: Nhà có việc bận, đi khám bệnh..."
                      value={leaveForm.reason}
                      onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                  ></textarea>
              </div>
              <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button onClick={() => setLeaveModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Hủy</button>
                  <button onClick={submitLeaveRequest} className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 flex items-center justify-center gap-2">
                      <Send size={18}/> Gửi đơn
                  </button>
              </div>
          </div>
      </Modal>

      {/* PAYROLL MODAL */}
      {payrollStaff && (
          <PayrollQrModal
              isOpen={isPayrollModalOpen}
              onClose={() => setPayrollModalOpen(false)}
              staff={payrollStaff}
              amount={payrollAmount}
              month={format(currentDate, 'MM/yyyy')}
          />
      )}
    </div>
  );
};
