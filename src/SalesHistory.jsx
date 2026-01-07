import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import MasterLayout from './layouts/MasterLayout';
import AnalyticsDashboard from './components/AnalyticsDashboard';

const SalesHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'transactions'
    const getLocalDate = (date = new Date()) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    const [dateRange, setDateRange] = useState({
        startDate: getLocalDate(new Date(new Date().setDate(new Date().getDate() - 7))),
        endDate: getLocalDate()
    });

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [viewingOrder, setViewingOrder] = useState(null);

    useEffect(() => {
        loadHistory();
    }, [dateRange]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await api.getSalesHistory(dateRange);
            if (Array.isArray(data)) {
                setHistory(data);
            } else {
                setHistory([]);
            }
        } catch (error) {
            console.error("Error loading history:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewOrder = async (order) => {
        try {
            const url = order.source === 'line'
                ? `/api/line-orders/${order.id}/details`
                : `/api/orders/${order.id}`;
            const res = await fetch(url);
            const data = await res.json();
            setViewingOrder({ ...data, source: order.source });
        } catch (err) {
            alert('ไม่สามารถดึงข้อมูลออเดอร์ได้');
        }
    };

    const handleQuickDate = (days) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);

        setDateRange({
            startDate: getLocalDate(start),
            endDate: getLocalDate(end)
        });
    };

    // Calculate Summary from History Data (filtered by date)
    const totalRevenue = history.reduce((sum, order) => sum + order.total_amount, 0);
    const totalOrders = history.length;
    const averageBill = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return (
        <MasterLayout>
            {/* Header Section */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">ประวัติ <span className="text-orange-500">ยอดขาย</span></h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Sales & Transaction Tracking</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Quick Date Selectors */}
                    <div className="bg-white p-1 rounded-[16px] border border-slate-100 shadow-sm flex gap-1">
                        <button onClick={() => handleQuickDate(0)} className="px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all">Today</button>
                        <button onClick={() => handleQuickDate(7)} className="px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all">Weekly</button>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-[20px] border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="text-xs font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0"
                        />
                        <span className="text-slate-200">|</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="text-xs font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0"
                        />
                    </div>
                </div>
            </header>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {[
                    { label: "Total Revenue", value: `฿${totalRevenue.toLocaleString()}`, icon: "💰", color: "text-orange-500", bg: "bg-orange-50" },
                    { label: "Total Orders", value: `${totalOrders} Bills`, icon: "🧾", color: "text-blue-500", bg: "bg-blue-50" },
                    { label: "Average Bill", value: `฿${Math.round(averageBill).toLocaleString()}`, icon: "💎", color: "text-emerald-500", bg: "bg-emerald-50" },
                ].map((stat, index) => (
                    <div key={index} className="tasty-card p-6 flex flex-col justify-between group h-40">
                        <div className="flex justify-between items-start">
                            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                                {stat.icon}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</h3>
                            <div className="mt-3 h-1 w-8 bg-orange-500 rounded-full group-hover:w-full transition-all duration-500"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs Navigation */}
            <div className="mb-8 flex gap-2 p-1.5 bg-white border border-slate-100 rounded-[24px] w-fit shadow-sm">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-8 py-3 rounded-[18px] text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'overview'
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    📊 Overview
                </button>
                <button
                    onClick={() => setActiveTab('transactions')}
                    className={`px-8 py-3 rounded-[18px] text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'transactions'
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    📑 Transactions
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'overview' ? (
                <AnalyticsDashboard dateRange={dateRange} />
            ) : (
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden mb-12 animate-fade-in-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#F8FAFC]">
                                <tr>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Receipt ID</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Channel / Origin</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Payment</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Revenue</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="6" className="px-10 py-24 text-center">
                                        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing Records...</p>
                                    </td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan="6" className="px-10 py-24 text-center text-slate-300 font-bold uppercase tracking-widest italic">No matching records found for this period.</td></tr>
                                ) : (
                                    history.map((order) => {
                                        const getOrderTypeBadge = () => {
                                            if (order.source === 'line') {
                                                if (order.order_type === 'delivery') return { label: '🚚 Delivery', style: 'bg-blue-50 text-blue-600 border-blue-100' };
                                                if (order.order_type === 'pickup') return { label: '🏃 รับเอง', style: 'bg-purple-50 text-purple-600 border-purple-100' };
                                                return { label: '📱 LINE CMS', style: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
                                            } else {
                                                if (order.order_type === 'takeaway') return { label: '🛍️ Takeaway', style: 'bg-amber-50 text-amber-600 border-amber-100' };
                                                return { label: '🍽️ Dine-In', style: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
                                            }
                                        };
                                        const badge = getOrderTypeBadge();

                                        return (
                                            <tr key={`${order.source}-${order.id}`} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-10 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-900 tracking-tighter">
                                                            {new Date(order.updated_at).toLocaleDateString('th-TH')}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(order.updated_at).toLocaleTimeString('th-TH')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 font-black text-slate-400 font-mono text-xs uppercase">
                                                    {order.source === 'line' ? `L#${order.id}` : `ORD-${order.id}`}
                                                </td>
                                                <td className="px-6 py-6">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">{order.table_name || `DIRECT ORDER`}</span>
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border w-fit ${badge.style}`}>
                                                            {badge.label}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <span className="px-3 py-1.5 bg-slate-900 rounded-xl text-[9px] font-black text-white uppercase tracking-widest">
                                                        {order.payment_method || 'CASH'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-6 text-right font-black text-orange-600 tabular-nums">
                                                    ฿{order.total_amount.toLocaleString()}
                                                </td>
                                                <td className="px-10 py-6 text-right">
                                                    <button
                                                        onClick={() => handleViewOrder(order)}
                                                        className="w-10 h-10 bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-500 rounded-2xl transition-all flex items-center justify-center border border-slate-100 group-hover:scale-110"
                                                    >
                                                        💎
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Details Modal - Premium Interface */}
            {viewingOrder && (
                <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingOrder(null)}>
                    <div className="bg-white rounded-[48px] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up relative border border-white" onClick={e => e.stopPropagation()}>
                        {/* Status bar */}
                        <div className="h-2 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>

                        {/* Modal Header */}
                        <div className="px-10 py-8 bg-[#f8fafc] border-b border-slate-100 relative">
                            <h3 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
                                🧾 บิล <span className="text-orange-500">#{viewingOrder.id}</span>
                            </h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">
                                {new Date(viewingOrder.updated_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'medium' })}
                            </p>
                            <button
                                onClick={() => setViewingOrder(null)}
                                className="absolute top-8 right-8 w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-300 hover:text-slate-600 transition-colors flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-10 py-8 overflow-y-auto space-y-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Destination</p>
                                    <p className="text-base font-black text-slate-900 border-l-4 border-orange-500 pl-3">
                                        {viewingOrder.customer_name || viewingOrder.table_name || 'Counter Service'}
                                    </p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Payment Method</p>
                                    <p className="text-base font-black text-slate-900 border-l-4 border-blue-500 pl-3 uppercase">
                                        {viewingOrder.payment_method || 'Cash / PromptPay'}
                                    </p>
                                </div>
                            </div>

                            {/* Item List */}
                            <div className="space-y-4">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-4">Transaction Items</h4>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {(viewingOrder.items || []).map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center group">
                                            <div className="flex gap-4 items-center">
                                                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-xs font-black text-orange-600 border border-orange-100">
                                                    {item.quantity}x
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.product_name || item.name}</p>
                                                    {item.options && item.options.length > 0 && (
                                                        <p className="text-[10px] text-orange-500 font-medium">
                                                            + {item.options.map(o => o.name || o.option_name).join(', ')}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">@ ฿{item.price.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900 tabular-nums">฿{(item.price * item.quantity).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Final Total */}
                            <div className="pt-8 border-t-4 border-dotted border-slate-100">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Net Revenue</p>
                                    <p className="text-4xl font-black text-orange-600 tracking-tighter tabular-nums">฿{viewingOrder.total_amount?.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-10 py-8 bg-[#f8fafc] border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() => window.print()}
                                className="flex-1 py-4 bg-white shadow-sm border border-slate-200 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-[24px] hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                            >
                                🖨️ Print Receipt
                            </button>
                            <button
                                onClick={() => setViewingOrder(null)}
                                className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-[24px] hover:scale-[1.05] transition-all shadow-xl shadow-slate-900/10"
                            >
                                Finished
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MasterLayout>
    );
};

export default SalesHistory;
