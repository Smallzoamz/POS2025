import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { useNavigate } from 'react-router-dom';
import MasterLayout from './layouts/MasterLayout';

const TableManagement = () => {
    const navigate = useNavigate();
    const [zones, setZones] = useState([]);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [showZoneModal, setShowZoneModal] = useState(false);
    const [showTableModal, setShowTableModal] = useState(false);

    // Form States
    const [newZoneName, setNewZoneName] = useState('');
    const [newTableName, setNewTableName] = useState('');
    const [newTableZone, setNewTableZone] = useState('');
    const [newTableSeats, setNewTableSeats] = useState(4);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [zonesData, tablesData] = await Promise.all([
                api.getZones(),
                api.getTables()
            ]);
            setZones(zonesData);
            setTables(tablesData);
            // Set default zone for new table if available
            if (zonesData.length > 0 && !newTableZone) {
                setNewTableZone(zonesData[0].name);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddZone = async (e) => {
        e.preventDefault();
        try {
            await api.addZone(newZoneName);
            setNewZoneName('');
            setShowZoneModal(false);
            fetchData();
        } catch (error) {
            alert('Error adding zone');
        }
    };

    const handleDeleteZone = async (id) => {
        if (!confirm('ต้องการลบโซนนี้? (โต๊ะในโซนนี้จะไม่ถูกลบ แต่ชื่อโซนจะค้างอยู่)')) return;
        try {
            await api.deleteZone(id);
            fetchData();
        } catch (error) {
            alert('Error deleting zone');
        }
    };

    const handleAddTable = async (e) => {
        e.preventDefault();
        try {
            await api.addTable({
                name: newTableName,
                zone: newTableZone,
                seats: parseInt(newTableSeats)
            });
            setNewTableName('');
            setNewTableSeats(4);
            setShowTableModal(false);
            fetchData();
        } catch (error) {
            alert('Error adding table');
        }
    };

    const handleDeleteTable = async (id) => {
        if (!confirm('ยืนยันลบโต๊ะนี้?')) return;
        try {
            await api.deleteTable(id);
            fetchData();
        } catch (error) {
            alert('Error deleting table');
        }
    };

    if (loading) return <div className="p-8 text-center text-white">Loading...</div>;

    return (
        <MasterLayout>
            <div className="max-w-6xl mx-auto space-y-12 pb-20">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">โครงสร้างพื้นที่ <span className="text-orange-500">Floor Plan</span></h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Zones & Table Configuration</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowZoneModal(true)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                        >
                            + New Zone
                        </button>
                        <button
                            onClick={() => setShowTableModal(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <span>🪑</span> Add Table
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                    {/* Zone Management Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                            <span>📍</span> Active Zones
                        </div>
                        <div className="space-y-4">
                            {zones.map(zone => (
                                <div key={zone.id} className="tasty-card p-4 flex justify-between items-center group">
                                    <span className="font-bold text-slate-700">{zone.name}</span>
                                    <button
                                        onClick={() => handleDeleteZone(zone.id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Table Management Grid */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                            <span>🪑</span> Physical Tables
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                            {tables.map(table => (
                                <div key={table.id} className="tasty-card p-6 flex flex-col items-center relative group">
                                    <div className="absolute top-4 right-4">
                                        <button
                                            onClick={() => handleDeleteTable(table.id)}
                                            className="text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center text-xl mb-4 shadow-sm">
                                        🪑
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-1">{table.name}</h3>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[9px] font-bold text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                            {table.zone}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            {table.seats} Seats
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Modals - Tasty Style */}
                {showZoneModal && (
                    <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowZoneModal(false)}>
                        <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
                            <h3 className="text-2xl font-bold text-slate-900 font-heading mb-6">Create New Zone</h3>
                            <form onSubmit={handleAddZone} className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Zone Identity</label>
                                    <input
                                        type="text"
                                        placeholder="Ex. Rooftop, 2nd Floor"
                                        value={newZoneName}
                                        onChange={e => setNewZoneName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all"
                                        required
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setShowZoneModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Cancel</button>
                                    <button type="submit" className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-orange-500/20">Commit Zone</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showTableModal && (
                    <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowTableModal(false)}>
                        <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
                            <h3 className="text-2xl font-bold text-slate-900 font-heading mb-6">Setup New Table</h3>
                            <form onSubmit={handleAddTable} className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Table Identifier</label>
                                    <input
                                        type="text"
                                        placeholder="Ex. A10, VIP-2"
                                        value={newTableName}
                                        onChange={e => setNewTableName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assigned Zone</label>
                                    <select
                                        value={newTableZone}
                                        onChange={e => setNewTableZone(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all appearance-none"
                                    >
                                        {zones.map(z => (
                                            <option key={z.id} value={z.name}>{z.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Capacity (Seats)</label>
                                    <input
                                        type="number"
                                        value={newTableSeats}
                                        onChange={e => setNewTableSeats(e.target.value)}
                                        min="1"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-bold text-slate-900 transition-all"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowTableModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Cancel</button>
                                    <button type="submit" className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-orange-500/20">Forge Table</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </MasterLayout>
    );
};

export default TableManagement;
