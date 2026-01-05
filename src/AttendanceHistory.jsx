import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { useNavigate } from 'react-router-dom';
import MasterLayout from './layouts/MasterLayout';

const AttendanceHistory = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ late: 0, absent: 0, leave: 0, present: 0 });
    const [showSettings, setShowSettings] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [workStartTime, setWorkStartTime] = useState('09:00');

    // Manual Form State
    const [manualForm, setManualForm] = useState({
        userId: '',
        date: new Date().toISOString().split('T')[0],
        status: 'leave'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [data, settingsData, usersData] = await Promise.all([
                api.getAttendanceLogs(),
                api.getSettings(),
                api.getUsers()
            ]);
            setLogs(data);
            setUsers(usersData);

            // Calculate Stats from loaded logs
            const newStats = { late: 0, absent: 0, leave: 0, present: 0 };
            data.forEach(log => {
                if (log.status === 'late') newStats.late++;
                else if (log.status === 'present') newStats.present++;
                else if (log.status === 'leave') newStats.leave++;
                else if (log.status === 'absent') newStats.absent++;
            });
            setStats(newStats);

            if (settingsData && settingsData.work_start_time) {
                setWorkStartTime(settingsData.work_start_time);
            }

        } catch (error) {
            console.error("Error loading attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.addAttendanceManual(manualForm);
            setShowManualModal(false);
            loadData();
            alert("บันทึกข้อมูลสำเร็จ");
        } catch (error) {
            console.error(error);
            alert("ไม่สามารถบันทึกข้อมูลได้");
        }
    };

    const saveSettings = async () => {
        try {
            await api.saveSettings({ work_start_time: workStartTime });
            setShowSettings(false);
            alert("บันทึกตั้งค่าสำเร็จ");
        } catch (error) {
            console.error(error);
            alert("บันทึกไม่สำเร็จ");
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const calculateDuration = (inTime, outTime) => {
        if (!outTime) return 'กำลังทำงาน...';
        const start = new Date(inTime);
        const end = new Date(outTime);
        const diffMs = end - start;
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        return `${diffHrs} ชม. ${diffMins} นาที`;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'late': return <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-red-200">Late</span>;
            case 'leave': return <span className="bg-amber-100 text-amber-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-amber-200">Leave</span>;
            case 'absent': return <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-slate-200">Absent</span>;
            default: return <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-200">Present</span>;
        }
    }

    return (
        <MasterLayout>
            <div className="space-y-10">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">ประวัติการเข้างาน <span className="text-orange-500">Attendance</span></h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Clock-in Records & Absence Logs</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowManualModal(true)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95"
                        >
                            + Manual Entry
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            ⚙️ Shift Setup
                        </button>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="tasty-card p-6 bg-emerald-50 border-emerald-100">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-2">Present</div>
                        <div className="text-3xl font-bold font-heading text-emerald-600">{stats.present}</div>
                        <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-tight">Active Duty</p>
                    </div>
                    <div className="tasty-card p-6 bg-rose-50 border-rose-100">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-rose-600/60 mb-2">Late Arrivals</div>
                        <div className="text-3xl font-bold font-heading text-rose-600">{stats.late}</div>
                        <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-tight">Shift Delays</p>
                    </div>
                    <div className="tasty-card p-6 bg-amber-50 border-amber-100">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600/60 mb-2">Leave Taken</div>
                        <div className="text-3xl font-bold font-heading text-amber-600">{stats.leave}</div>
                        <p className="text-[10px] font-bold text-amber-500 mt-1 uppercase tracking-tight">Approved Requests</p>
                    </div>
                    <div className="tasty-card p-6 bg-slate-100 border-slate-200">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600/60 mb-2">Absences</div>
                        <div className="text-3xl font-bold font-heading text-slate-700">{stats.absent}</div>
                        <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">Unaccounted Logs</p>
                    </div>
                </div>


                {/* Attendance Table */}
                <div className="tasty-card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#F8FAFC]">
                                <tr>
                                    <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee</th>
                                    <th className="px-6 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clock In</th>
                                    <th className="px-6 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clock Out</th>
                                    <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="5" className="text-center py-12 text-slate-400 font-bold">Initializing Records...</td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-12 text-slate-400 font-bold">No Records Found</td></tr>
                                ) : (
                                    logs.map(log => (
                                        <tr key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-white shadow-sm">
                                                        {log.nickname?.[0] || log.name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900">{log.nickname || log.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{log.full_name}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {getStatusBadge(log.status)}
                                            </td>
                                            <td className="px-6 py-5 font-mono text-slate-600 text-[13px]">
                                                {formatDate(log.clock_in)}
                                            </td>
                                            <td className="px-6 py-5 font-mono text-slate-600 text-[13px]">
                                                {formatDate(log.clock_out)}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold">
                                                    {calculateDuration(log.clock_in, log.clock_out)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Manual Entry Modal */}
            {showManualModal && (
                <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowManualModal(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 font-heading">Manual Override</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Record Leave or Absence</p>
                            </div>
                            <button onClick={() => setShowManualModal(false)} className="text-slate-300 hover:text-slate-500 text-xl font-bold transition-colors">✕</button>
                        </div>

                        <form onSubmit={handleManualSubmit} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Employee Select</label>
                                <select
                                    required
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all appearance-none"
                                    value={manualForm.userId}
                                    onChange={(e) => setManualForm({ ...manualForm, userId: e.target.value })}
                                >
                                    <option value="">Select Personnel...</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.nickname || u.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Effective Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all"
                                        value={manualForm.date}
                                        onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Status Type</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all appearance-none"
                                        value={manualForm.status}
                                        onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                                    >
                                        <option value="leave">Leave (Approved)</option>
                                        <option value="absent">Absent (Skipped)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex gap-3 italic">
                                <span className="text-lg">💡</span>
                                <p className="text-[10px] font-bold text-orange-600/80 leading-relaxed uppercase tracking-widest self-center">
                                    Manual overrides directly impact payroll calculations based on system policy.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowManualModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-orange-500/20">Commit Log</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowSettings(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 font-heading">Shift Settings</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Operational Benchmarks</p>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="text-slate-300 hover:text-slate-500 text-xl font-bold transition-colors">✕</button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 text-center block">Standard Work Start Time</label>
                                <input
                                    type="time"
                                    value={workStartTime}
                                    onChange={(e) => setWorkStartTime(e.target.value)}
                                    className="w-full text-4xl font-bold text-center bg-slate-50 border border-slate-100 rounded-[24px] p-6 focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none text-slate-900 transition-all font-heading"
                                />
                                <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest mt-4 italic">
                                    Late arrival counts after this timestamp.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowSettings(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Cancel</button>
                                <button onClick={saveSettings} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-lg">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MasterLayout>
    );
};

export default AttendanceHistory;
