import React, { useState, useEffect } from 'react';
import MasterLayout from './layouts/MasterLayout';
import { api } from './services/api';
import { Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import QRCode from 'react-qr-code';

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingOrders: 0,
        occupiedTables: 0,
        totalTables: 0,
        recentOrders: []
    });

    const [network, setNetwork] = useState({
        localIp: '...',
        publicIp: '...',
        cloudUrl: null,
        isCloudActive: false,
        isLaunching: false
    });

    useEffect(() => {
        loadStats();
        if (user?.role === 'owner') loadNetwork();
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            const data = await api.getDashboardStats();
            setStats(data);
        } catch (error) {
            console.error("Error loading dashboard stats:", error);
        }
    };

    const loadNetwork = async () => {
        try {
            const data = await api.getNetworkStatus();
            setNetwork(data);
        } catch (err) {
            console.error("Error loading network status:", err);
        }
    };

    const handleCloudToggle = async () => {
        if (network.isLaunching) return;
        const targetState = !network.isCloudActive;
        setNetwork(prev => ({ ...prev, isLaunching: true }));
        try {
            const res = await api.toggleCloud(targetState);
            if (res.success) {
                setTimeout(loadNetwork, 1000);
            }
        } catch (err) {
            console.error("Toggle Cloud Error:", err);
        } finally {
            setNetwork(prev => ({ ...prev, isLaunching: false }));
        }
    };

    return (
        <MasterLayout>
            <div className="space-y-10">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">ภาพรวมระบบ <span className="text-orange-500">Tasty Station</span></h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Operational Overview • {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={loadStats} className="bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                            🔄 Refresh
                        </button>
                        {(user?.role === 'owner' || user?.role === 'finance') && (
                            <Link to="/finance" className="bg-[#00A099] px-6 py-2.5 rounded-2xl shadow-lg shadow-[#00A099]/20 text-white font-bold text-sm hover:bg-[#008c86] transition-all">💰 Finance</Link>
                        )}
                        <Link to="/tables" className="bg-orange-500 px-6 py-2.5 rounded-2xl shadow-lg shadow-orange-500/20 text-white font-bold text-sm hover:bg-orange-600 transition-all">⚡ New Order</Link>
                    </div>
                </header>

                {/* Welcome Banner */}
                <div className="relative overflow-hidden rounded-[32px] bg-[#0f172a] p-8 text-white shadow-2xl group border border-white/5">
                    <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-6">
                        <div className="text-center lg:text-left flex-1">
                            <div className="inline-block px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-3 border border-orange-500/20 backdrop-blur-sm">
                                Tasty Station POS
                            </div>
                            <h2 className="text-3xl lg:text-4xl font-bold mb-2 leading-tight tracking-tight font-heading">
                                สวัสดี, <span className="text-orange-500">{user?.name || 'ผู้ใช้งาน'}</span>
                            </h2>
                            <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-xl">
                                ระบบพร้อมใช้งานแล้ว • คุณสามารถจัดการออเดอร์, ดูยอดขาย และควบคุมระบบได้จากที่นี่
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                            <div className="bg-white/5 p-4 rounded-[24px] border border-white/5 flex items-center gap-4 min-w-[240px] backdrop-blur-md">
                                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-orange-500/30">📱</div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">PWA Installed</p>
                                    <p className="text-xs font-bold text-white">App is ready for Mobile</p>
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-[24px] border border-white/5 flex items-center gap-4 min-w-[240px] backdrop-blur-md">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">⚡</div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">System Latency</p>
                                    <p className="text-xs font-bold text-emerald-400">12ms • Ultra Fast</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: "Today Revenue", value: `฿${stats.totalRevenue.toLocaleString()}`, icon: "💰", color: "text-orange-500", bg: "bg-orange-50" },
                        { label: "Pending Bills", value: `${stats.pendingOrders}`, icon: "🧾", color: "text-blue-500", bg: "bg-blue-50" },
                        { label: "Active Tables", value: `${stats.occupiedTables}/${stats.totalTables}`, icon: "🪑", color: "text-emerald-500", bg: "bg-emerald-50" },
                        { label: "System Health", value: "Optimal", icon: "💎", color: "text-indigo-500", bg: "bg-indigo-50" },
                    ].map((stat, index) => (
                        <div key={index} className="tasty-card p-6 flex flex-col justify-between group hover:-translate-y-1 transition-all">
                            <div className="flex justify-between items-start">
                                <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center text-2xl`}>
                                    {stat.icon}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                            </div>
                            <div className="mt-8">
                                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</h3>
                                <div className="mt-4 h-1 w-8 bg-orange-500 rounded-full group-hover:w-full transition-all duration-500"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Analytics & Control */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <div className="tasty-card p-8 h-full flex flex-col">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 tracking-tight font-heading">Sales Performance</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">7-Day Transaction Trend</p>
                                </div>
                                <div className="bg-slate-50 p-1.5 rounded-xl flex gap-1 border border-slate-100">
                                    <button className="px-4 py-1.5 rounded-lg bg-white shadow-sm text-[10px] font-bold text-slate-900 uppercase">Today</button>
                                    <button className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 uppercase hover:text-slate-600 transition-colors">Weekly</button>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[300px]">
                                <AnalyticsDashboard />
                            </div>
                        </div>
                    </div>

                    {/* Network Control */}
                    {user?.role === 'owner' && (
                        <div className="bg-[#0f172a] p-8 rounded-[32px] text-white shadow-2xl flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-2xl">🛰️</div>
                                <div>
                                    <h3 className="text-lg font-bold font-heading">Master Node</h3>
                                    <p className="text-[10px] text-orange-400 font-bold uppercase">Terminal Infrastructure</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="p-5 rounded-[24px] bg-white/5 border border-white/5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Internal IP</p>
                                    <div className="flex justify-between items-center">
                                        <code className="text-xl font-bold text-slate-200 font-mono">{network.localIp}</code>
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                    </div>
                                </div>

                                <div className={`p-6 rounded-[24px] border-2 transition-all ${network.isCloudActive ? 'border-orange-500/40 bg-orange-500/10' : 'border-white/5 bg-white/5'}`}>
                                    <div className="flex justify-between items-center mb-5">
                                        <div>
                                            <p className="text-xs font-bold uppercase">Cloud Bridge</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Remote POS Access</p>
                                        </div>
                                        <button
                                            onClick={handleCloudToggle}
                                            disabled={network.isLaunching}
                                            className={`w-12 h-6 rounded-full relative transition-all ${network.isCloudActive ? 'bg-orange-500' : 'bg-slate-700'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${network.isCloudActive ? 'left-7' : 'left-1'}`}></div>
                                        </button>
                                    </div>

                                    {network.isCloudActive && network.cloudUrl ? (
                                        <div className="space-y-4">
                                            <div className="bg-white p-3 rounded-2xl flex items-center justify-center">
                                                <QRCode value={network.cloudUrl} size={120} level="M" />
                                            </div>
                                            <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 text-center">
                                                <code className="text-[10px] font-bold text-slate-400 break-all font-mono">{network.cloudUrl}</code>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                                            {network.isLaunching ? (
                                                <p className="text-[9px] font-bold uppercase text-orange-400 animate-pulse">Booting Tunnel...</p>
                                            ) : (
                                                <span className="text-[9px] font-bold uppercase text-slate-500">Tunnel Inactive</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Activity Table */}
                <div className="tasty-card p-0 overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 font-heading">Recent Transactions</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Live Activity Feed</p>
                        </div>
                        <Link to="/sales" className="px-6 py-2.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl">View History</Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase">ID</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Channel</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Table</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Amount</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stats.recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-10 text-center text-slate-300 font-bold uppercase text-xs">No activity yet.</td>
                                    </tr>
                                ) : (
                                    stats.recentOrders.map((order, i) => (
                                        <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-8 py-4 font-bold text-sm text-slate-900">#FO0{order.id}</td>
                                            <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">{order.source === 'line' ? '📱 LINE' : '🏬 Shop'}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-700">{order.table_name || 'Take Away'}</td>
                                            <td className="px-6 py-4 font-bold text-slate-900">฿{(order.total_amount || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase border ${order.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-right text-[10px] font-bold text-slate-400">
                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </MasterLayout>
    );
};

export default Dashboard;
