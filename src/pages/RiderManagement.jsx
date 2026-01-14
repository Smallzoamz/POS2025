import { useState, useEffect } from 'react';
import { User, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '../services/api';

export default function RiderManagement() {
    const [riders, setRiders] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRiders = async () => {
        try {
            const res = await api.get('/admin/riders');
            setRiders(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRiders();
    }, []);

    const updateStatus = async (id, status) => {
        if (!confirm(`Are you sure you want to ${status} this rider?`)) return;
        try {
            await api.put(`/admin/riders/${id}/status`, { status });
            fetchRiders(); // Refresh list
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const StatusBadge = ({ status }) => {
        switch (status) {
            case 'approved': return <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1"><CheckCircle size={12} /> Approved</span>;
            case 'rejected': return <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1"><XCircle size={12} /> Rejected</span>;
            case 'pending': return <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1"><Clock size={12} /> Pending</span>;
            default: return <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">


            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="text-left py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Rider Info</th>
                                <th className="text-left py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Personal Details</th>
                                <th className="text-left py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Vehicle Info</th>
                                <th className="text-left py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Bank Account</th>
                                <th className="text-left py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="text-right py-4 px-6 text-xs font-black text-slate-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {riders.map((rider) => (
                                <tr key={rider.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{rider.name}</p>
                                                <p className="text-xs text-slate-400">@{rider.username}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <p className="text-sm font-medium text-slate-600">Age: {rider.age}</p>
                                        <p className="text-xs text-slate-400">{rider.phone || '-'}</p>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">{rider.vehicle_plate || '-'}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{rider.vehicle_type || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <p className="text-sm font-mono text-slate-600">{rider.bank_account || '-'}</p>
                                    </td>
                                    <td className="py-4 px-6">
                                        <StatusBadge status={rider.status} />
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        {rider.status === 'pending' && (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => updateStatus(rider.id, 'approved')}
                                                    className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                                    title="Approve"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button
                                                    onClick={() => updateStatus(rider.id, 'rejected')}
                                                    className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                    title="Reject"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </div>
                                        )}
                                        {rider.status === 'approved' && (
                                            <button
                                                onClick={() => updateStatus(rider.id, 'suspended')}
                                                className="text-xs font-bold text-red-500 hover:underline"
                                            >
                                                Suspend
                                            </button>
                                        )}
                                        {rider.status === 'suspended' && (
                                            <button
                                                onClick={() => updateStatus(rider.id, 'approved')}
                                                className="text-xs font-bold text-emerald-500 hover:underline"
                                            >
                                                Re-Activate
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {riders.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center opacity-40">
                                        <p className="font-bold text-slate-400">No riders found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
