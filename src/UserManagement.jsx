import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import MasterLayout from './layouts/MasterLayout';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        full_name: '',
        phone: '',
        pin: '',
        role: 'staff',
        hourly_rate: 0,
        off_day: 7, // 7 = No holiday
        off_day2: 7,
        can_deliver: false // Multi-role: เป็น Rider ด้วย
    });
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Error loading users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                name: user.name,
                full_name: user.full_name || '',
                phone: user.phone || '',
                pin: user.pin,
                role: user.role,
                hourly_rate: user.hourly_rate || 0,
                off_day: user.off_day ?? 7,
                off_day2: user.off_day2 ?? 7,
                can_deliver: user.can_deliver || false
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: '',
                full_name: '',
                phone: '',
                pin: '',
                role: 'staff',
                hourly_rate: 0,
                off_day: 7,
                off_day2: 7,
                can_deliver: false
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Confirmation before saving
        if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการ${editingUser ? 'แก้ไขข้อมูล' : 'เพิ่มผู้ใช้งาน'}?`)) return;

        setSaving(true);
        try {
            if (editingUser) {
                await api.updateUser(editingUser.id, formData);
            } else {
                await api.addUser(formData);
            }

            setNotification({
                type: 'success',
                message: editingUser ? 'แก้ไขข้อมูลพนักงานสำเร็จ' : 'เพิ่มพนักงานใหม่สำเร็จ'
            });

            setTimeout(() => {
                setShowModal(false);
                setNotification(null);
            }, 1500);

            loadUsers();
        } catch (error) {
            console.error("Save error:", error);
            setNotification({ type: 'error', message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('ยืนยันการลบผู้ใช้งานนี้?')) return;
        try {
            await api.deleteUser(id);
            loadUsers();
        } catch (error) {
            alert('Error deleting user');
        }
    };

    const roleLabels = {
        owner: 'Owner (เจ้าของร้าน)',
        admin: 'Admin (ผู้จัดการ)',
        finance: 'Finance (บัญชี)',
        kitchen: 'Chef (ครัว)',
        staff: 'Staff (พนักงาน)'
    };

    const roleColors = {
        owner: 'bg-purple-100 text-purple-800',
        admin: 'bg-blue-100 text-blue-800',
        finance: 'bg-green-100 text-green-800',
        kitchen: 'bg-orange-100 text-orange-800',
        staff: 'bg-gray-100 text-gray-800'
    };

    if (loading) return <div className="p-8 text-center text-white">Loading...</div>;

    return (
        <MasterLayout>
            <div className="space-y-10">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">ทีมงาน <span className="text-orange-500">Tasty Station</span></h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Personnel Management • Roles & Permissions</p>
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                    >
                        <span>+</span> เพิ่มพนักงาน
                    </button>
                </header>

                {/* Staff Table */}
                <div className="tasty-card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#F8FAFC]">
                                <tr>
                                    <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name / Display</th>
                                    <th className="px-6 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role (Permissions)</th>
                                    <th className="px-6 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">PIN Code</th>
                                    <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users.map(user => (
                                    <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-slate-200 uppercase">
                                                    {user.name?.[0] || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 leading-tight">{user.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                        {user.phone ? `📞 ${user.phone}` : (user.full_name || 'Generic Asset')}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${user.role === 'owner' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                    user.role === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                        user.role === 'finance' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                            user.role === 'kitchen' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                'bg-slate-50 text-slate-600 border-slate-100'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                                {user.can_deliver && (
                                                    <span className="px-2 py-1 bg-cyan-500 text-white rounded-lg text-[8px] font-bold uppercase animate-pulse">🛵 Rider</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <code className="bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 font-mono tracking-[0.3em]">****</code>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm"
                                                >
                                                    ✏️
                                                </button>
                                                {user.role !== 'owner' && (
                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* User Modal */}
            {showModal && (
                <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 font-heading">{editingUser ? 'แก้ไขโปรไฟล์' : 'เพิ่มทีมงาน'}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Staff Member Detail</p>
                            </div>
                            {saving && <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>}
                        </div>

                        {notification && (
                            <div className={`mb-6 p-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest flex items-center gap-3 animate-fade-in ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                                }`}>
                                {notification.type === 'success' ? '✨' : '⚠️'} {notification.message}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className={`space-y-5 ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nickname</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all text-sm"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all text-sm"
                                        placeholder="08x-xxx-xxxx"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Position / Role</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all appearance-none"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="owner">Owner (เจ้าของร้าน)</option>
                                    <option value="admin">Admin (ผู้จัดการ)</option>
                                    <option value="finance">Finance (บัญชี)</option>
                                    <option value="kitchen">Chef (ครัว)</option>
                                    <option value="staff">Staff (พนักงาน)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Access PIN (4 Digits)</label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    required
                                    maxLength="4"
                                    placeholder="••••"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-center text-2xl font-mono tracking-[0.5em] text-slate-900 transition-all"
                                    value={formData.pin}
                                    onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                                />
                            </div>

                            {/* Hourly Rate */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">รายได้ต่อชั่วโมง (฿/ชม.)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all"
                                    value={formData.hourly_rate}
                                    onChange={e => setFormData({ ...formData, hourly_rate: Number(e.target.value) })}
                                />
                            </div>

                            {/* Off Days */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">วันหยุดที่ 1</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all appearance-none text-sm"
                                        value={formData.off_day}
                                        onChange={e => setFormData({ ...formData, off_day: Number(e.target.value) })}
                                    >
                                        <option value={7}>ไม่มีวันหยุด</option>
                                        <option value={0}>วันอาทิตย์</option>
                                        <option value={1}>วันจันทร์</option>
                                        <option value={2}>วันอังคาร</option>
                                        <option value={3}>วันพุธ</option>
                                        <option value={4}>วันพฤหัสบดี</option>
                                        <option value={5}>วันศุกร์</option>
                                        <option value={6}>วันเสาร์</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">วันหยุดที่ 2</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all appearance-none text-sm"
                                        value={formData.off_day2}
                                        onChange={e => setFormData({ ...formData, off_day2: Number(e.target.value) })}
                                    >
                                        <option value={7}>ไม่มีวันหยุด</option>
                                        <option value={0}>วันอาทิตย์</option>
                                        <option value={1}>วันจันทร์</option>
                                        <option value={2}>วันอังคาร</option>
                                        <option value={3}>วันพุธ</option>
                                        <option value={4}>วันพฤหัสบดี</option>
                                        <option value={5}>วันศุกร์</option>
                                        <option value={6}>วันเสาร์</option>
                                    </select>
                                </div>
                            </div>

                            {/* Can Deliver Toggle */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">สามารถเป็นไรเดอร์ได้</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Can Deliver Orders</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, can_deliver: !formData.can_deliver })}
                                    className={`w-14 h-8 rounded-full transition-all relative p-1 ${formData.can_deliver ? 'bg-orange-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-6 h-6 bg-white rounded-full transition-all shadow-sm ${formData.can_deliver ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:grayscale"
                                >
                                    {saving ? 'Saving...' : 'Confirm'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MasterLayout>
    );
};

export default UserManagement;
