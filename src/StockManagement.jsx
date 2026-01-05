import React, { useState, useEffect } from 'react';
import MasterLayout from './layouts/MasterLayout';
import { api } from './services/api';
import { useAuth } from './contexts/AuthContext';

const StockManagement = () => {
    const { user } = useAuth(); // Auth
    const isOwner = user?.role === 'owner'; // Permission

    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Form State
    const [formData, setFormData] = useState({ name: '', total_quantity: '', unit: 'kg' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await api.getIngredients();
            setIngredients(data);
            setLoading(false);
        } catch (error) {
            console.error("Error loading ingredients:", error);
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await api.updateIngredient(editingItem.id, formData);
            } else {
                await api.addIngredient(formData);
            }
            setShowModal(false);
            setEditingItem(null);
            setFormData({ name: '', total_quantity: '', unit: 'kg' });
            loadData();
        } catch (error) {
            alert('Error saving data');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('ยืนยันการลบวัตถุดิบนี้? (สูตรอาหารที่ใช้วัตถุดิบนี้อาจมีปัญหา)')) return;
        try {
            await api.deleteIngredient(id);
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const openModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({ name: item.name, total_quantity: item.total_quantity, unit: item.unit });
        } else {
            setEditingItem(null);
            setFormData({ name: '', total_quantity: '', unit: 'kg' });
        }
        setShowModal(true);
    };

    return (
        <MasterLayout>
            <div className="space-y-10">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">คลังวัตถุดิบ <span className="text-orange-500">Inventory</span></h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Stock Levels & Ingredient Management</p>
                    </div>

                    {isOwner && (
                        <button
                            onClick={() => openModal()}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                        >
                            <span>+</span> เพิ่มวัตถุดิบ
                        </button>
                    )}
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="tasty-card p-6 bg-slate-900 text-white border-none">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Total Skus</div>
                        <div className="text-3xl font-bold font-heading">{ingredients.length}</div>
                        <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">รายการวัตถุดิบ</p>
                        <div className="w-full h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
                            <div className="h-full bg-orange-500 w-2/3"></div>
                        </div>
                    </div>
                    <div className="tasty-card p-6 bg-emerald-50 border-emerald-100">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-2">Healthy Stock</div>
                        <div className="text-3xl font-bold font-heading text-emerald-600">{ingredients.filter(i => i.total_quantity > 10).length}</div>
                        <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase">Active & Optimized</p>
                    </div>
                    <div className="tasty-card p-6 bg-rose-50 border-rose-100">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-rose-600/60 mb-2">Low Inventory</div>
                        <div className="text-3xl font-bold font-heading text-rose-600">{ingredients.filter(i => i.total_quantity <= 10).length}</div>
                        <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase">Requires Action</p>
                    </div>
                </div>

                {/* Inventory Table */}
                <div className="tasty-card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#F8FAFC]">
                                <tr>
                                    <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingredient Detail</th>
                                    <th className="px-6 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Remaining</th>
                                    <th className="px-6 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Unit</th>
                                    <th className="px-6 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    {isOwner && <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {ingredients.map((item) => (
                                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${item.total_quantity <= 0 ? 'bg-rose-100 text-rose-600' :
                                                    item.total_quantity <= 10 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    📦
                                                </div>
                                                <div className="font-bold text-slate-900">{item.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="text-lg font-bold text-slate-900 font-mono">
                                                {parseFloat(item.total_quantity).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">{item.unit}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {item.total_quantity <= 0 ? (
                                                <span className="px-3 py-1 bg-rose-500 text-white rounded-full text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-rose-500/20">Out Of Stock</span>
                                            ) : item.total_quantity <= 10 ? (
                                                <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-amber-500/20">Running Low</span>
                                            ) : (
                                                <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20">Optimized</span>
                                            )}
                                        </td>
                                        {isOwner && (
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => openModal(item)}
                                                        className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modern Stock Modal */}
            {showModal && (
                <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 font-heading">{editingItem ? 'แก้ไขรายการ' : 'เพิ่มวัตถุดิบ'}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Inventory Asset Update</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-300 hover:text-slate-500 text-xl font-bold transition-colors">✕</button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Asset Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all"
                                        value={formData.total_quantity}
                                        onChange={e => setFormData({ ...formData, total_quantity: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Metric Unit</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all appearance-none"
                                        value={formData.unit}
                                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="g">g</option>
                                        <option value="l">l</option>
                                        <option value="ml">ml</option>
                                        <option value="pcs">pcs</option>
                                        <option value="units">units</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                                >
                                    {editingItem ? 'Update Asset' : 'Commit Stock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MasterLayout>
    );
};

export default StockManagement;
