import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { api } from '../services/api';

const AnalyticsDashboard = ({ dateRange = {} }) => {
    const [salesData, setSalesData] = useState([]);
    const [topItems, setTopItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAnalytics();
    }, [dateRange?.startDate, dateRange?.endDate]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const [trend, items] = await Promise.all([
                api.getSalesTrend(dateRange),
                api.getTopItems(dateRange)
            ]);
            setSalesData(trend || []);
            setTopItems(items || []);
            setLoading(false);
        } catch (error) {
            console.error("Failed to load analytics:", error);
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">กำลังโหลดข้อมูลวิเคราะห์...</div>;

    const titleDate = dateRange.startDate && dateRange.endDate
        ? `(${new Date(dateRange.startDate).toLocaleDateString('th-TH')} - ${new Date(dateRange.endDate).toLocaleDateString('th-TH')})`
        : '(7 วันล่าสุด)';

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sales Trend Chart */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="flex flex-col gap-1 mb-6">
                        <h4 className="text-slate-900 font-black tracking-tight text-lg">Daily Revenue Trend</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Growth Performance</p>
                    </div>

                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(str) => {
                                        const date = new Date(str);
                                        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                                    }}
                                    style={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => `฿${val / 1000}k`}
                                    style={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    formatter={(value) => [`฿${value.toLocaleString()}`, 'ยอดขาย']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    contentStyle={{
                                        borderRadius: '20px',
                                        border: 'none',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                        padding: '16px',
                                        fontSize: '12px',
                                        fontWeight: '900'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#f97316"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorTotal)"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Selling Items Chart */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="flex flex-col gap-1 mb-6">
                        <h4 className="text-slate-900 font-black tracking-tight text-lg">Top High-Performance Dishes</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Inventory Velocity</p>
                    </div>

                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={topItems} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="product_name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={120}
                                    style={{ fontSize: 10, fontWeight: 900, fill: '#1e293b' }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F8FAFC' }}
                                    formatter={(value) => [`${value} รายการ`, 'จำนวนขาย']}
                                    contentStyle={{
                                        borderRadius: '20px',
                                        border: 'none',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                        padding: '16px',
                                        fontSize: '12px',
                                        fontWeight: '900'
                                    }}
                                />
                                <Bar dataKey="quantity" radius={[0, 12, 12, 0]} barSize={24} animationDuration={2500}>
                                    {topItems.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#f97316', '#334155', '#fb923c', '#475569', '#fdba74'][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
