import React, { useState, useEffect } from 'react';
import MasterLayout from '../layouts/MasterLayout';

const RiderReports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await fetch('/api/riders/reports');
            const data = await res.json();
            setReports(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id, newStatus) => {
        try {
            const res = await fetch(`/api/riders/reports/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
            }
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'resolved': return 'bg-emerald-100 text-emerald-600';
            case 'investigating': return 'bg-blue-100 text-blue-600';
            case 'rejected': return 'bg-rose-100 text-rose-600';
            default: return 'bg-amber-100 text-amber-600';
        }
    };

    return (
        <MasterLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-heading">Rider Reports</h1>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Issues reported by riders</p>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-400">Loading reports...</div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 italic text-slate-300">
                        <span className="text-6xl block mb-4">👍</span>
                        <p className="font-bold uppercase tracking-widest text-xs">No reports found</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rider</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order ID</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reason</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Details</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-xs font-medium text-slate-600">
                                                {new Date(report.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                                                        {report.rider_name ? report.rider_name.charAt(0) : 'R'}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-900">{report.rider_name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {report.order_id ? (
                                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">#{report.order_id}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-slate-800">{report.topic || report.reason}</span>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs relative">
                                                <p className="text-xs text-slate-500 leading-relaxed truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                                                    {report.description || report.details}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={report.status || 'pending'}
                                                    onChange={(e) => updateStatus(report.id, e.target.value)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border-none outline-none cursor-pointer appearance-none text-center ${getStatusColor(report.status || 'pending')}`}
                                                >
                                                    <option value="pending">Pending</option>
                                                    <option value="investigating">Investigating</option>
                                                    <option value="resolved">Resolved</option>
                                                    <option value="rejected">Rejected</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </MasterLayout>
    );
};

export default RiderReports;
