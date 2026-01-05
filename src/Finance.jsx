import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import MasterLayout from './layouts/MasterLayout';
import { api } from './services/api';
import { SalarySlip } from './components/SalarySlip';

export default function Finance() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('transactions'); // transactions | payroll
    const [loading, setLoading] = useState(false);

    // Data State
    const [transactions, setTransactions] = useState([]);
    const [payroll, setPayroll] = useState([]);
    const [settings, setSettings] = useState({});
    const [printData, setPrintData] = useState(null);
    const printRef = useRef();

    // Filter State
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of current month
        end: new Date().toISOString().split('T')[0]
    });

    // Modal State
    const [showTransModal, setShowTransModal] = useState(false);
    const [transForm, setTransForm] = useState({ type: 'expense', category: '', amount: '', description: '' });

    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [adjustForm, setAdjustForm] = useState({ user_id: '', type: 'bonus', amount: '', reason: '' });

    // Financial Stats (FIXED: Added Number() casting to prevent string concatenation)
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (activeTab === 'transactions') fetchTransactions();
        else fetchPayroll();
    }, [activeTab, dateRange]);

    const fetchSettings = async () => {
        try {
            const data = await api.getSettings();
            setSettings(data);
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const data = await api.get(`/transactions?startDate=${dateRange.start}&endDate=${dateRange.end}`);
            setTransactions(data);
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPayroll = async () => {
        setLoading(true);
        try {
            const data = await api.get(`/payroll/summary?startDate=${dateRange.start}&endDate=${dateRange.end}`);
            setPayroll(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching payroll:", error);
            setPayroll([]);
        } finally {
            setLoading(false);
        }
    };

    const handleTransSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/transactions', { ...transForm, created_by: user.id });
            if (res.success) {
                setShowTransModal(false);
                setTransForm({ type: 'expense', category: '', amount: '', description: '' });
                fetchTransactions();
            }
        } catch (error) {
            console.error("Error adding transaction:", error);
        }
    };

    const handleAdjustSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/payroll/adjustments', { ...adjustForm, created_by: user.id });
            if (res.success) {
                setShowAdjustmentModal(false);
                setAdjustForm({ user_id: '', type: 'bonus', amount: '', reason: '' });
                fetchPayroll();
            }
        } catch (error) {
            console.error("Error adding adjustment:", error);
        }
    };

    const deleteTransaction = async (id) => {
        if (!confirm('Area you sure you want to delete this transaction?')) return;
        try {
            await api.delete(`/transactions/${id}`);
            fetchTransactions();
        } catch (error) {
            console.error("Error deleting:", error);
        }
    };

    const handleUpdateRate = async (userId, newRate) => {
        const rate = parseFloat(newRate);
        if (isNaN(rate)) return;
        try {
            setPayroll(prev => prev.map(p =>
                p.user.id === userId ? { ...p, user: { ...p.user, hourly_rate: rate } } : p
            ));
            const pData = payroll.find(p => p.user.id === userId);
            if (pData) {
                await api.updateUser(userId, { ...pData.user, hourly_rate: rate });
                fetchPayroll();
            }
        } catch (error) {
            console.error("Error updating rate:", error);
            alert("Failed to update rate");
            fetchPayroll();
        }
    };

    const handlePrintSlip = (item) => {
        if (user?.role !== 'owner') return alert('Access Denied');
        setPrintData({
            employee: item.user,
            stats: item.stats,
            financials: item.financials,
            adjustments: item.adjustments,
            period: { start: dateRange.start, end: dateRange.end },
            settings: settings
        });
        setTimeout(() => {
            window.print();
        }, 150);
    };

    return (
        <MasterLayout title="Finance & Intelligence">
            <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pt-4">
                {/* Header & Date Selector */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">การเงิน <span className="text-orange-500">& บัญชี</span></h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Financial Intelligence • Live Statistics</p>
                    </div>

                    <div className="flex items-center gap-3 p-1.5 bg-white border border-slate-100 rounded-[20px] shadow-sm">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-[14px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Start</span>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
                            />
                        </div>
                        <div className="w-4 h-px bg-slate-200"></div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-[14px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">End</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
                            />
                        </div>
                    </div>
                </header>

                {/* Performance Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="tasty-card p-8 group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-2xl">💰</div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Income</p>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                            ฿{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
                        <div className="mt-4 h-1 w-8 bg-emerald-500 rounded-full group-hover:w-full transition-all duration-500"></div>
                    </div>

                    <div className="tasty-card p-8 group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-2xl">🧾</div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Expense</p>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                            ฿{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
                        <div className="mt-4 h-1 w-8 bg-rose-500 rounded-full group-hover:w-full transition-all duration-500"></div>
                    </div>

                    <div className="tasty-card p-8 bg-[#0f172a] border-none group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-orange-500/20">💎</div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Profit</p>
                        </div>
                        <h3 className={`text-3xl font-bold tracking-tight ${netProfit >= 0 ? 'text-white' : 'text-rose-400'}`}>
                            ฿{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
                        <div className="mt-4 h-1 w-8 bg-orange-500 rounded-full group-hover:w-full transition-all duration-500"></div>
                    </div>
                </div>

                {/* Logic Tabs */}
                <div className="bg-white p-1.5 rounded-[20px] flex gap-1 shadow-sm border border-slate-100 w-fit">
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={`px-8 py-3 rounded-[14px] text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'transactions'
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        📝 Transactions
                    </button>
                    {user?.role === 'owner' && (
                        <button
                            onClick={() => setActiveTab('payroll')}
                            className={`px-8 py-3 rounded-[14px] text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'payroll'
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            👥 Payroll
                        </button>
                    )}
                </div>

                {/* Main Ledger Area */}
                <div className="relative min-h-[600px]">
                    {loading && (
                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-[40px]">
                            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    {activeTab === 'transactions' ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Journal <span className="text-orange-600">Records</span></h3>
                                <button
                                    onClick={() => setShowTransModal(true)}
                                    className="group relative px-8 py-4 bg-slate-900 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] overflow-hidden transition-all hover:scale-[1.05] hover:shadow-2xl active:scale-95 shadow-xl"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                    <span className="relative flex items-center gap-3">
                                        <span className="text-lg">+</span> ADD TRANSACTION
                                    </span>
                                </button>
                            </div>

                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#F8FAFC]">
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">TIMESTAMP</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">CLASSIFICATION</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">CATEGORY / MEMO</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">MAGNITUDE</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">OPERATOR</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {transactions.map(t => (
                                                <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-8 py-6">
                                                        <div className="font-black text-slate-900 text-sm tabular-nums tracking-tight">
                                                            {new Date(t.date).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                                            {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${t.type === 'income'
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-100'
                                                            : 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm shadow-rose-100'
                                                            }`}>
                                                            {t.type === 'income' ? 'CREDIT' : 'DEBIT'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="font-black text-slate-900 tracking-tight">{t.category}</div>
                                                        <p className="text-xs text-slate-400 mt-1 max-w-[200px] truncate" title={t.description}>{t.description}</p>
                                                    </td>
                                                    <td className={`px-8 py-6 text-right font-black text-xl tabular-nums tracking-tighter ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {t.type === 'income' ? '+' : '-'}฿{Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-white shadow-sm ${t.created_by_name === 'System' ? 'bg-slate-900 shadow-slate-200' : 'bg-orange-500 shadow-orange-100'}`}>
                                                                {t.created_by_name ? t.created_by_name[0] : 'S'}
                                                            </div>
                                                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{t.created_by_name || 'System'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 text-center">
                                                        {t.created_by_name !== 'System' && (
                                                            <button
                                                                onClick={() => deleteTransaction(t.id)}
                                                                className="w-10 h-10 bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-2xl transition-all flex items-center justify-center border border-slate-100 group-hover:shadow-sm"
                                                            >
                                                                🗑️
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-fade-in px-2 pb-10">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Payroll <span className="text-orange-600">Blueprint</span></h3>
                                <button
                                    onClick={() => setShowAdjustmentModal(true)}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] hover:scale-[1.05] shadow-xl transition-all"
                                >
                                    + ADD ADJUSTMENT
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-12">
                                {['owner', 'admin', 'finance', 'kitchen', 'staff'].map(roleGroup => {
                                    const roleUsers = payroll.filter(p => p.user.role === roleGroup);
                                    if (roleUsers.length === 0) return null;

                                    return (
                                        <div key={roleGroup} className="space-y-6">
                                            <div className="flex items-center gap-4">
                                                <span className="w-12 h-1 px-0 bg-orange-600 rounded-full"></span>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">{roleGroup} LEVEL ASSETS</h4>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                {roleUsers.map((p, idx) => (
                                                    <div key={idx} className="group bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 relative overflow-hidden">
                                                        <div className="absolute right-0 top-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 group-hover:bg-orange-50 transition-colors"></div>

                                                        <div className="relative z-10">
                                                            <div className="flex justify-between items-start mb-8">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-16 h-16 rounded-[24px] bg-slate-900 text-white flex items-center justify-center text-2xl font-black shadow-xl shadow-slate-200 group-hover:scale-110 transition-transform">
                                                                        {p.user.name[0]}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-xl font-black text-slate-900 tracking-tighter">{p.user.name}</h4>
                                                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">{p.user.full_name}</p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handlePrintSlip(p)}
                                                                    className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-lg shadow-sm hover:bg-orange-600 hover:text-white hover:shadow-orange-200 transition-all"
                                                                >
                                                                    📄
                                                                </button>
                                                            </div>

                                                            <div className="space-y-4 mb-8">
                                                                <div className="flex justify-between items-center p-5 bg-slate-50 rounded-[28px] border border-slate-100 shadow-inner">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">HOURLY MAGNITUDE</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-slate-300 font-black text-lg">฿</span>
                                                                            <input
                                                                                type="number"
                                                                                className="w-16 bg-transparent text-xl font-black text-slate-900 outline-none tabular-nums"
                                                                                defaultValue={p.user.hourly_rate}
                                                                                onBlur={(e) => handleUpdateRate(p.user.id, e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CAPACITY</span>
                                                                        <div className="text-xl font-black text-slate-900 tabular-nums">{p.stats.totalHours.toFixed(1)} <span className="text-xs text-slate-300">HRS</span></div>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="p-4 bg-emerald-50 rounded-[24px] border border-emerald-100">
                                                                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block mb-1">TOTAL BONUS</span>
                                                                        <div className="text-sm font-black text-emerald-700 tracking-tight">+฿{p.financials.totalBonus.toLocaleString()}</div>
                                                                    </div>
                                                                    <div className="p-4 bg-rose-50 rounded-[24px] border border-rose-100">
                                                                        <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest block mb-1">DEDUCTIONS</span>
                                                                        <div className="text-sm font-black text-rose-700 tracking-tight">-฿{p.financials.totalDeduction.toLocaleString()}</div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="pt-6 border-t border-slate-100 flex justify-between items-end">
                                                                <div>
                                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">NET PAYOUT</span>
                                                                    <div className="text-3xl font-black text-orange-600 tabular-nums tracking-tighter">
                                                                        ฿{Math.floor(p.financials.netSalary).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                                <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${p.stats.lateCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                                    {p.stats.lateCount > 0 ? 'ANOMALY DETECTED' : 'OPTIMUM'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Glassmorphism Modals */}
                {showTransModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowTransModal(false)}>
                        <div className="bg-white rounded-[48px] w-full max-w-md shadow-2xl animate-fade-in-up relative border border-white" onClick={e => e.stopPropagation()}>
                            <div className="h-2 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                            <div className="p-12">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-8">Execute <span className="text-orange-600">Transaction</span></h3>
                                <form onSubmit={handleTransSubmit} className="space-y-8">
                                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[24px] border border-slate-200 shadow-inner">
                                        <button
                                            type="button"
                                            onClick={() => setTransForm({ ...transForm, type: 'income' })}
                                            className={`flex-1 py-3.5 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${transForm.type === 'income' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}
                                        >
                                            REVENUE (+)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTransForm({ ...transForm, type: 'expense' })}
                                            className={`flex-1 py-3.5 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${transForm.type === 'expense' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}
                                        >
                                            EXPENSE (-)
                                        </button>
                                    </div>

                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Classification</label>
                                        <input
                                            type="text" required placeholder="Rent, Supplies, Electricity..."
                                            className="w-full bg-transparent text-xl font-black text-slate-900 outline-none placeholder:text-slate-300"
                                            value={transForm.category}
                                            onChange={e => setTransForm({ ...transForm, category: e.target.value })}
                                        />
                                    </div>

                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Currency Magnitude (฿)</label>
                                        <input
                                            type="number" step="0.01" required placeholder="0.00"
                                            className="w-full bg-transparent text-3xl font-black text-slate-900 outline-none tabular-nums placeholder:text-slate-300"
                                            value={transForm.amount}
                                            onChange={e => setTransForm({ ...transForm, amount: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setShowTransModal(false)} className="flex-1 px-4 py-5 bg-white border border-slate-200 text-slate-900 rounded-[28px] font-black text-[10px] uppercase tracking-widest shadow-sm">Abort</button>
                                        <button type="submit" className="flex-1 px-4 py-5 bg-slate-900 text-white rounded-[28px] font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.05] transition-all">Authorize</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Adjustment Modal */}
                {showAdjustmentModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowAdjustmentModal(false)}>
                        <div className="bg-white rounded-[48px] w-full max-w-md shadow-2xl animate-fade-in-up relative border border-white" onClick={e => e.stopPropagation()}>
                            <div className="h-2 bg-gradient-to-r from-orange-400 to-orange-600"></div>
                            <div className="p-12">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-8">Execute <span className="text-orange-600">Adjustment</span></h3>
                                <form onSubmit={handleAdjustSubmit} className="space-y-8">
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Personnel</label>
                                        <select
                                            value={adjustForm.user_id}
                                            onChange={e => setAdjustForm({ ...adjustForm, user_id: e.target.value })}
                                            className="w-full bg-transparent text-xl font-black text-slate-900 outline-none cursor-pointer"
                                        >
                                            <option value="">Select Asset...</option>
                                            {payroll.map(p => <option key={p.user.id} value={p.user.id}>{p.user.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[24px] border border-slate-200 shadow-inner">
                                        <button
                                            type="button"
                                            onClick={() => setAdjustForm({ ...adjustForm, type: 'bonus' })}
                                            className={`flex-1 py-3.5 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${adjustForm.type === 'bonus' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}
                                        >
                                            BONUS (+)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAdjustForm({ ...adjustForm, type: 'deduction' })}
                                            className={`flex-1 py-3.5 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${adjustForm.type === 'deduction' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}
                                        >
                                            PENALTY (-)
                                        </button>
                                    </div>

                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Magnitude (฿)</label>
                                        <input
                                            type="number" step="0.01" required placeholder="0.00"
                                            className="w-full bg-transparent text-3xl font-black text-slate-900 outline-none tabular-nums placeholder:text-slate-300"
                                            value={adjustForm.amount}
                                            onChange={e => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setShowAdjustmentModal(false)} className="flex-1 px-4 py-5 bg-white border border-slate-200 text-slate-900 rounded-[28px] font-black text-[10px] uppercase tracking-widest shadow-sm">Abort</button>
                                        <button type="submit" className="flex-1 px-4 py-5 bg-slate-900 text-white rounded-[28px] font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.05] transition-all">Authorize</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden Print Slip */}
            <SalarySlip ref={printRef} data={printData} />
        </MasterLayout>
    );
}
