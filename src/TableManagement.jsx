import React, { useState, useEffect, useRef } from 'react';
import { api } from './services/api';
import MasterLayout from './layouts/MasterLayout';
import {
    FaUtensils, FaGlassMartiniAlt, FaRestroom, FaTree,
    FaLeaf, FaRoad, FaHome, FaBorderAll, FaArrowsAlt,
    FaSync, FaTrashAlt, FaSave, FaPlus, FaCheckCircle,
    FaLayerGroup, FaChair
} from 'react-icons/fa';

const TableManagement = () => {
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'editor'
    const [zones, setZones] = useState([]);
    const [tables, setTables] = useState([]);
    const [mapObjects, setMapObjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editor States
    const [selectedItem, setSelectedItem] = useState(null); // { type: 'table'|'object', id: number }
    const [dragItem, setDragItem] = useState(null);
    const [resizeHandle, setResizeHandle] = useState(null); // 'tl', 'tr', 'bl', 'br', 'tc', 'bc', 'ml', 'mr'
    const [isOverTrash, setIsOverTrash] = useState(false);
    const [canvasScale, setCanvasScale] = useState(1);
    const trashRef = useRef(null);
    const canvasRef = useRef(null);

    // --- STYLIZED COMPONENTS (Editor Version) ---
    const Chair = ({ side, color, occupied = true }) => {
        const rotations = { top: 180, bottom: 0, left: 90, right: 270 };
        const rotation = rotations[side] || 0;
        return (
            <div style={{ transform: `rotate(${rotation}deg)` }} className="w-4 h-4 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-2.5 h-1 rounded-t-sm -mb-0.5" style={{ backgroundColor: color }} />
                <div className="w-3.5 h-3 rounded-sm relative flex items-center justify-center shadow-sm" style={{ backgroundColor: color }}>
                    <div className="absolute -top-0.5 -left-0.5 w-0.5 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                    <div className="absolute -top-0.5 -right-0.5 w-0.5 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                    <div className="absolute -bottom-0.5 -left-0.5 w-0.5 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-0.5 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                </div>
            </div>
        );
    };

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
            const [zonesData, tablesData, mapObjectsData] = await Promise.all([
                api.getZones(),
                api.getTables(),
                api.getMapObjects()
            ]);
            setZones(zonesData);
            setTables(tablesData);
            setMapObjects(mapObjectsData);
            if (zonesData.length > 0 && !newTableZone) {
                setNewTableZone(zonesData[0].name);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- DRAG AND DROP / RESIZE LOGIC ---
    const handleMouseDown = (e, type, id, handle = null) => {
        if (viewMode !== 'editor') return;
        e.stopPropagation();

        const item = type === 'table'
            ? tables.find(t => t.id === id)
            : mapObjects.find(o => o.id === id);

        if (!item) return;

        setSelectedItem({ type, id });

        if (handle) {
            setResizeHandle(handle);
        }

        setDragItem({
            type,
            id,
            startX: e.clientX,
            startY: e.clientY,
            origX: item.x,
            origY: item.y,
            origW: item.w || 80,
            origH: item.h || 80
        });
    };

    const handleMouseMove = (e) => {
        if (!dragItem) return;

        const dx = (e.clientX - dragItem.startX) / canvasScale;
        const dy = (e.clientY - dragItem.startY) / canvasScale;

        // --- CHECK TRASH COLLISION ---
        if (trashRef.current) {
            const trashRect = trashRef.current.getBoundingClientRect();
            const over = e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                e.clientY >= trashRect.top && e.clientY <= trashRect.bottom;
            setIsOverTrash(over);
        }

        if (resizeHandle) {
            // --- RESIZING LOGIC ---
            const updateItem = (prev) => prev.map(item => {
                if (item.id !== dragItem.id) return item;

                let { x, y, w, h } = { ...item };
                const minSize = 20;

                // Handle logic (simplified for non-rotated resizing visually, 
                // but updates coordinates correctly)
                // For a more advanced version, we'd need to consider current rotation
                if (resizeHandle.includes('r')) w = Math.max(minSize, dragItem.origW + dx);
                if (resizeHandle.includes('b')) h = Math.max(minSize, dragItem.origH + dy);
                if (resizeHandle.includes('l')) {
                    const newW = Math.max(minSize, dragItem.origW - dx);
                    if (newW > minSize) {
                        w = newW;
                        x = dragItem.origX + dx;
                    }
                }
                if (resizeHandle.includes('t')) {
                    const newH = Math.max(minSize, dragItem.origH - dy);
                    if (newH > minSize) {
                        h = newH;
                        y = dragItem.origY + dy;
                    }
                }

                return { ...item, x, y, w, h };
            });

            if (dragItem.type === 'table') setTables(updateItem);
            else setMapObjects(updateItem);

        } else {
            // --- DRAGGING LOGIC ---
            if (dragItem.type === 'table') {
                setTables(prev => prev.map(t =>
                    t.id === dragItem.id ? { ...t, x: Math.round(dragItem.origX + dx), y: Math.round(dragItem.origY + dy) } : t
                ));
            } else {
                setMapObjects(prev => prev.map(o =>
                    o.id === dragItem.id ? { ...o, x: Math.round(dragItem.origX + dx), y: Math.round(dragItem.origY + dy) } : o
                ));
            }
        }
    };

    const handleMouseUp = () => {
        if (dragItem && isOverTrash) {
            if (dragItem.type === 'table') {
                deleteTable(dragItem.id);
            } else {
                deleteObject(dragItem.id);
            }
        }
        setDragItem(null);
        setResizeHandle(null);
        setIsOverTrash(false);
    };

    // --- ACTIONS ---
    const handleSaveLayout = async () => {
        try {
            setSaving(true);
            // 1. Batch update tables
            await api.batchUpdateTableLayout(tables.map(t => ({
                id: t.id,
                x: t.x,
                y: t.y,
                rotation: t.rotation,
                shape: t.shape,
                seats: t.seats,
                w: t.w,
                h: t.h
            })));

            // 2. Update map objects (one by one for simplicity in this version, or batch if optimized)
            for (const obj of mapObjects) {
                await api.updateMapObject(obj.id, obj);
            }

            alert('Floor plan saved successfully! ✨');
        } catch (error) {
            console.error(error);
            alert('Failed to save layout');
        } finally {
            setSaving(false);
        }
    };

    const addObject = async (type) => {
        const names = {
            kitchen: 'Kitchen Area',
            water_station: 'Water Bar',
            restroom: 'Restroom',
            fence: 'Fence',
            tree: 'Tree',
            garden: 'Garden',
            walkway: 'Walkway',
            hut: 'Hut',
            area_zone: 'New Area Zone'
        };

        const defaultSizes = {
            kitchen: { w: 200, h: 120 },
            water_station: { w: 100, h: 80 },
            restroom: { w: 80, h: 80 },
            fence: { w: 120, h: 20 },
            tree: { w: 60, h: 60 },
            garden: { w: 150, h: 100 },
            walkway: { w: 200, h: 60 },
            hut: { w: 140, h: 140 },
            area_zone: { w: 300, h: 200 }
        };

        const size = defaultSizes[type] || { w: 100, h: 100 };

        try {
            const res = await api.addMapObject({
                name: names[type],
                type,
                x: 100,
                y: 100,
                w: size.w,
                h: size.h,
                rotation: 0,
                zone: zones[0]?.name || 'Indoor'
            });
            if (res.success) {
                fetchData();
            }
        } catch (error) {
            alert('Error adding object');
        }
    };

    const deleteObject = async (id) => {
        // Only confirm if not dragging to trash
        if (!isOverTrash && !confirm('Remove this object?')) return;
        try {
            await api.deleteMapObject(id);
            setMapObjects(prev => prev.filter(o => o.id !== id));
            setSelectedItem(null);
        } catch (error) {
            alert('Error deleting object');
        }
    };

    const deleteTable = async (id) => {
        if (!isOverTrash && !confirm('Permanently delete this table?')) return;
        try {
            await api.deleteTable(id);
            setTables(prev => prev.filter(t => t.id !== id));
            setSelectedItem(null);
        } catch (error) {
            alert('Error deleting table');
        }
    };

    const updateSelectedItem = (key, value) => {
        if (!selectedItem) return;
        if (selectedItem.type === 'table') {
            setTables(prev => prev.map(t => {
                if (t.id === selectedItem.id) {
                    const updated = { ...t, [key]: value };
                    // Papa Rule: If shape is Hut, fixed at 4 seats
                    if (updated.shape === 'hut') {
                        updated.seats = 4;
                    }
                    return updated;
                }
                return t;
            }));
        } else {
            setMapObjects(prev => prev.map(o => o.id === selectedItem.id ? { ...o, [key]: value } : o));
        }
    };

    // --- TABLE MGMT ---
    const handleAddTable = async (e) => {
        e.preventDefault();
        try {
            await api.addTable({
                name: newTableName,
                zone: newTableZone,
                seats: parseInt(newTableSeats),
                x: 150,
                y: 150,
                shape: 'rectangle'
            });
            setNewTableName('');
            setShowTableModal(false);
            fetchData();
        } catch (error) {
            alert('Error adding table');
        }
    };

    const renderObjectIcon = (type, color = 'currentColor') => {
        const props = { size: 20, color };
        switch (type) {
            case 'kitchen': return <FaUtensils {...props} />;
            case 'water_station': return <FaGlassMartiniAlt {...props} />;
            case 'restroom': return <FaRestroom {...props} />;
            case 'tree': return <FaTree {...props} />;
            case 'garden': return <FaLeaf {...props} />;
            case 'walkway': return <FaRoad {...props} />;
            case 'hut': return <FaHome {...props} />;
            case 'area_zone': return <FaLayerGroup {...props} />;
            case 'fence': return <div className="w-full h-1 border-y-2 border-dashed border-amber-800/30" />;
            default: return <FaBorderAll {...props} />;
        }
    };

    if (loading) return <div className="p-8 text-center text-white">Loading...</div>;

    const currentItem = selectedItem
        ? (selectedItem.type === 'table' ? tables.find(t => t.id === selectedItem.id) : mapObjects.find(o => o.id === selectedItem.id))
        : null;

    return (
        <MasterLayout>
            <div className="max-w-[1600px] mx-auto space-y-6 pb-20 px-4">
                {/* Header Sub-Nav */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-xl shadow-slate-200/50">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading flex items-center gap-3">
                            {viewMode === 'list' ? '📋 Table Management' : '🏗️ Floor Plan Designer'}
                        </h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                            {viewMode === 'list' ? 'Manage your physical tables and zones' : 'Drag and drop to design your store layout'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 mr-2">
                            <div className="px-5 py-2.5 rounded-xl bg-white text-orange-500 shadow-sm font-bold text-xs uppercase tracking-widest">
                                List View
                            </div>
                        </div>

                        {viewMode === 'editor' ? (
                            <button
                                onClick={handleSaveLayout}
                                disabled={saving}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                            >
                                <FaSave className={saving ? 'animate-spin' : ''} />
                                {saving ? 'Saving...' : 'Save Layout'}
                            </button>
                        ) : (
                            <>
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
                                    <FaPlus /> Add Table
                                </button>
                            </>
                        )}
                    </div>
                </header>

                {viewMode === 'list' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Zone Sidebar */}
                        <div className="lg:col-span-1 space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <FaLayerGroup /> Active Zones
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {zones.map(zone => (
                                    <div key={zone.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group">
                                        <span className="font-bold text-slate-700">{zone.name}</span>
                                        <button onClick={() => api.deleteZone(zone.id).then(fetchData)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <FaTrashAlt />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Table Grid */}
                        <div className="lg:col-span-3 space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <FaChair /> Physical Tables
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {tables.map(table => (
                                    <div key={table.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center relative group">
                                        <button onClick={() => api.deleteTable(table.id).then(fetchData)} className="absolute top-4 right-4 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100">✕</button>
                                        <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center text-xl mb-4">🪑</div>
                                        <h4 className="font-bold text-slate-900">{table.name}</h4>
                                        <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-1 rounded-full mt-2 font-bold uppercase">{table.zone} • {table.seats} Seats</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-280px)] min-h-[600px]">
                        {/* Palette Sidebar */}
                        <aside className="w-full xl:w-72 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="bg-white p-6 rounded-[32px] border border-white shadow-xl">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Area Elements</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { type: 'kitchen', label: 'ครัว', icon: <FaUtensils /> },
                                        { type: 'water_station', label: 'ร้านน้ำ', icon: <FaGlassMartiniAlt /> },
                                        { type: 'restroom', label: 'ห้องน้ำ', icon: <FaRestroom /> },
                                        { type: 'hut', label: 'กระท่อม', icon: <FaHome /> }
                                    ].map(item => (
                                        <button
                                            key={item.type}
                                            onClick={() => addObject(item.type)}
                                            className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-orange-200 hover:text-orange-500 transition-all group"
                                        >
                                            <div className="mb-2 text-slate-400 group-hover:text-orange-500">{item.icon}</div>
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">Decorations</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { type: 'tree', label: 'ต้นไม้', icon: <FaTree /> },
                                        { type: 'garden', label: 'สวน/ดอกไม้', icon: <FaLeaf /> },
                                        { type: 'walkway', label: 'ทางเดิน', icon: <FaRoad /> },
                                        { type: 'fence', label: 'รั้ว', icon: <FaBorderAll /> }
                                    ].map(item => (
                                        <button
                                            key={item.type}
                                            onClick={() => addObject(item.type)}
                                            className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-orange-200 hover:text-orange-500 transition-all group"
                                        >
                                            <div className="mb-2 text-slate-400 group-hover:text-orange-500">{item.icon}</div>
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">Zone Layout</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => addObject('area_zone')}
                                        className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl hover:bg-white hover:border-orange-500 hover:text-orange-500 transition-all group"
                                    >
                                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                                            <FaLayerGroup />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-[10px] font-black uppercase block leading-none">สร้างโซนบริเวณ</span>
                                            <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Assign Sub-Area</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Selection Properties */}
                            {selectedItem && currentItem && (
                                <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl space-y-4 animate-fade-in">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-orange-400">Properties</h3>
                                        <button onClick={() => selectedItem.type === 'object' ? deleteObject(selectedItem.id) : deleteTable(selectedItem.id)} className="text-red-400 hover:text-red-300">
                                            <FaTrashAlt size={14} />
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] block mb-1 opacity-50 uppercase font-bold">Rotation ({currentItem.rotation}°)</label>
                                            <input
                                                type="range" min="0" max="360" step="15"
                                                value={currentItem.rotation}
                                                onChange={(e) => updateSelectedItem('rotation', parseInt(e.target.value))}
                                                className="w-full accent-orange-500"
                                            />
                                        </div>
                                        {selectedItem.type === 'table' && (
                                            <>
                                                <div>
                                                    <label className="text-[10px] block mb-2 opacity-50 uppercase font-bold">Shape</label>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => updateSelectedItem('shape', 'rectangle')}
                                                            className={`flex-1 py-2 rounded-lg border text-[10px] font-bold uppercase ${currentItem.shape === 'rectangle' ? 'bg-orange-500 border-orange-500' : 'border-slate-700'}`}
                                                        >Rect</button>
                                                        <button
                                                            onClick={() => updateSelectedItem('shape', 'circle')}
                                                            className={`flex-1 py-2 rounded-lg border text-[10px] font-bold uppercase ${currentItem.shape === 'circle' ? 'bg-orange-500 border-orange-500' : 'border-slate-700'}`}
                                                        >Circle</button>
                                                        <button
                                                            onClick={() => updateSelectedItem('shape', 'hut')}
                                                            className={`flex-1 py-2 rounded-lg border text-[10px] font-bold uppercase ${currentItem.shape === 'hut' ? 'bg-orange-500 border-orange-500' : 'border-slate-700'}`}
                                                        >Hut</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] block mb-1 opacity-50 uppercase font-bold">Seats ({currentItem.seats})</label>
                                                    <input
                                                        type="number"
                                                        value={currentItem.seats}
                                                        onChange={(e) => updateSelectedItem('seats', parseInt(e.target.value))}
                                                        className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none border border-slate-700 focus:border-orange-500"
                                                    />
                                                </div>
                                            </>
                                        )}
                                        {/* Editable Name for Area Zones */}
                                        {selectedItem.type === 'object' && currentItem.type === 'area_zone' && (
                                            <div>
                                                <label className="text-[10px] block mb-1 opacity-50 uppercase font-bold">Zone Name</label>
                                                <input
                                                    type="text"
                                                    value={currentItem.name || ''}
                                                    onChange={(e) => updateSelectedItem('name', e.target.value)}
                                                    placeholder="Enter zone name..."
                                                    className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none border border-slate-700 focus:border-orange-500"
                                                />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] block mb-1 opacity-50 uppercase font-bold">Width</label>
                                                <input type="number" value={currentItem.w} onChange={e => updateSelectedItem('w', parseInt(e.target.value))} className="w-full bg-slate-800 rounded-lg px-2 py-1 text-xs outline-none border border-slate-700" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] block mb-1 opacity-50 uppercase font-bold">Height</label>
                                                <input type="number" value={currentItem.h} onChange={e => updateSelectedItem('h', parseInt(e.target.value))} className="w-full bg-slate-800 rounded-lg px-2 py-1 text-xs outline-none border border-slate-700" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </aside>

                        {/* Design Canvas */}
                        <main className="flex-1 bg-slate-200 rounded-[48px] border-8 border-slate-100 shadow-inner relative overflow-hidden group/canvas focus-within:ring-4 focus-within:ring-orange-500/10 transition-all">
                            {/* Grid Pattern Overlay */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                            {/* Zoom/Scale Controls */}
                            <div className="absolute top-6 right-6 flex flex-col gap-2 z-50">
                                <button onClick={() => setCanvasScale(s => Math.min(s + 0.1, 2))} className="w-10 h-10 bg-white shadow-lg rounded-xl flex items-center justify-center text-slate-600 hover:text-orange-500 transition-all">+</button>
                                <button onClick={() => setCanvasScale(s => Math.max(s - 0.1, 0.5))} className="w-10 h-10 bg-white shadow-lg rounded-xl flex items-center justify-center text-slate-600 hover:text-orange-500 transition-all">-</button>
                                <button onClick={() => setCanvasScale(1)} className="w-10 h-10 bg-white shadow-lg rounded-xl flex items-center justify-center text-slate-600 hover:text-orange-500 transition-all"><FaSync size={12} /></button>
                            </div>

                            <div
                                ref={canvasRef}
                                className="absolute inset-0 cursor-crosshair"
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onClick={() => setSelectedItem(null)}
                            >
                                <div style={{ transform: `scale(${canvasScale})`, transformOrigin: 'top left', transition: dragItem ? 'none' : 'transform 0.2s' }}>

                                    {/* Map Objects (Decorations) */}
                                    {mapObjects.map(obj => (
                                        <div
                                            key={`obj-${obj.id}`}
                                            onMouseDown={(e) => handleMouseDown(e, 'object', obj.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                position: 'absolute',
                                                left: obj.x,
                                                top: obj.y,
                                                width: obj.w,
                                                height: obj.h,
                                                transform: `rotate(${obj.rotation}deg)`,
                                                cursor: 'move',
                                                zIndex: obj.type === 'walkway' ? 1 : 10,
                                                opacity: (dragItem?.type === 'object' && dragItem.id === obj.id && isOverTrash) ? 0.3 : 1
                                            }}
                                            className={`flex items-center justify-center transition-shadow group/obj ${selectedItem?.type === 'object' && selectedItem.id === obj.id ? 'ring-2 ring-orange-500 shadow-2xl z-[100]' : ''}`}
                                        >
                                            <div
                                                className={`w-full h-full rounded-2xl flex flex-col items-center justify-center relative transition-all duration-700
                                                    ${(dragItem?.type === 'object' && dragItem.id === obj.id && isOverTrash) ? 'bg-red-500 border-red-300 shadow-inner' : ''}
                                                    ${obj.type === 'kitchen' && !isOverTrash ? 'bg-slate-200 border-2 border-slate-400 shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]' : ''}
                                                    ${obj.type === 'water_station' && !isOverTrash ? 'bg-sky-50 border-2 border-sky-200' : ''}
                                                    ${obj.type === 'restroom' && !isOverTrash ? 'bg-slate-100 border-2 border-slate-200' : ''}
                                                    ${obj.type === 'tree' && !isOverTrash ? 'bg-emerald-600 rounded-full border-4 border-emerald-800/20 shadow-[0_10px_20px_rgba(5,150,105,0.3)]' : ''}
                                                    ${obj.type === 'garden' && !isOverTrash ? 'bg-emerald-100 border-2 border-emerald-200 shadow-inner' : ''}
                                                    ${obj.type === 'walkway' && !isOverTrash ? 'bg-slate-200/40 border-y border-slate-300/20' : ''}
                                                    ${obj.type === 'hut' && !isOverTrash ? 'bg-[#D2B48C] border-2 border-amber-900 shadow-xl' : ''}
                                                    ${obj.type === 'area_zone' && !isOverTrash ? 'bg-orange-50/10 border-2 border-dashed border-orange-200' : ''}
                                                `}
                                            >
                                                {obj.type === 'area_zone' && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden opacity-50 pointer-events-none">
                                                        <span className="text-3xl font-black text-slate-400 uppercase tracking-tighter">{obj.name || 'NEW ZONE'}</span>
                                                        <div className="w-12 h-0.5 bg-slate-300 rounded-full mt-2" />
                                                    </div>
                                                )}
                                                {/* Visual Realistic Elements for Editor */}
                                                {obj.type === 'tree' && !isOverTrash && (
                                                    <div className="absolute inset-0 rounded-full overflow-hidden opacity-30">
                                                        <div className="absolute top-1 left-1 w-1/2 h-1/2 bg-white rounded-full blur-sm" />
                                                    </div>
                                                )}
                                                {obj.type === 'hut' && !isOverTrash && (
                                                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg, transparent 0deg 30deg, rgba(0,0,0,0.1) 30deg 60deg)' }} />
                                                )}

                                                {renderObjectIcon(obj.type, (isOverTrash && dragItem?.id === obj.id) ? '#fff' : (obj.type === 'tree' || obj.type === 'hut' ? 'white' : undefined))}
                                                <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 px-2 line-clamp-1 ${(isOverTrash && dragItem?.id === obj.id || obj.type === 'tree' || obj.type === 'hut') ? 'text-white' : 'opacity-40'}`}>{obj.name}</span>
                                            </div>

                                            {/* Resize Handles (Only show if selected and NOT dragging) */}
                                            {selectedItem?.type === 'object' && selectedItem.id === obj.id && !dragItem && (
                                                <>
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'object', obj.id, 'br')} className="absolute -right-1 -bottom-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nwse-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'object', obj.id, 'tr')} className="absolute -right-1 -top-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nesw-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'object', obj.id, 'bl')} className="absolute -left-1 -bottom-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nesw-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'object', obj.id, 'tl')} className="absolute -left-1 -top-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nwse-resize z-[110]" />

                                                    {/* Edge Handles for Stretching */}
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'object', obj.id, 'mr')} className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-5 bg-white border-2 border-orange-500 rounded-sm cursor-ew-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'object', obj.id, 'ml')} className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-5 bg-white border-2 border-orange-500 rounded-sm cursor-ew-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'object', obj.id, 'bc')} className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-5 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ns-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'object', obj.id, 'tc')} className="absolute left-1/2 -translate-x-1/2 -top-1 w-5 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ns-resize z-[110]" />
                                                </>
                                            )}
                                        </div>
                                    ))}

                                    {/* Tables */}
                                    {tables.map(table => (
                                        <div
                                            key={`table-${table.id}`}
                                            onMouseDown={(e) => handleMouseDown(e, 'table', table.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                position: 'absolute',
                                                left: table.x,
                                                top: table.y,
                                                width: table.w,
                                                height: table.h,
                                                transform: `rotate(${table.rotation}deg)`,
                                                cursor: 'move',
                                                zIndex: 50,
                                                opacity: (dragItem?.type === 'table' && dragItem.id === table.id && isOverTrash) ? 0.3 : 1
                                            }}
                                            className={`flex items-center justify-center group/table ${selectedItem?.type === 'table' && selectedItem.id === table.id ? 'ring-2 ring-orange-500 shadow-2xl z-[100]' : ''}`}
                                        >
                                            <div className={`
                                                relative w-full h-full border-2 flex flex-col items-center justify-center shadow-md transition-all
                                                ${table.shape === 'circle' ? 'rounded-full' : (table.shape === 'hut' ? 'rounded-2xl' : 'rounded-3xl')}
                                                ${(dragItem?.type === 'table' && dragItem.id === table.id && isOverTrash) ? 'bg-red-100 border-red-500 text-red-500' :
                                                    (table.shape === 'hut' ? 'bg-[#D2B48C] border-amber-900 overflow-hidden' :
                                                        (table.shape === 'circle' ? 'bg-[#FFF1F2] border-[#FECDD3]' : 'bg-[#E0F2F1] border-[#80CBC4]'))}
                                            `}>
                                                {/* Hut Roof Texture for Table */}
                                                {table.shape === 'hut' && !isOverTrash && (
                                                    <>
                                                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg, transparent 0deg 30deg, rgba(0,0,0,0.1) 30deg 60deg)' }} />
                                                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-amber-900/10 pointer-events-none" />
                                                    </>
                                                )}

                                                <span className={`font-black tracking-tighter transition-colors relative z-10 
                                                    ${isOverTrash && dragItem?.id === table.id ? 'text-red-500' :
                                                        (table.shape === 'hut' ? 'text-amber-950' :
                                                            (table.shape === 'circle' ? 'text-[#E11D48]' : 'text-[#00695C]'))}
                                                `} style={{ fontSize: Math.min(table.w, table.h) / 4 }}>{table.name}</span>

                                                <div className="flex items-center gap-1 opacity-40 relative z-10">
                                                    <FaChair size={8} />
                                                    <span className="text-[8px] font-bold">{table.seats}</span>
                                                </div>

                                                {/* Chairs Placeholder in Editor */}
                                                {(() => {
                                                    const seatsCount = parseInt(table.seats || 2);
                                                    const isLandscape = (table.w || 80) >= (table.h || 80);
                                                    const chairs = [];
                                                    const chairColor = (table.shape === 'circle' ? '#f97316' : '#0d9488');

                                                    const sides = isLandscape ? ['top', 'bottom'] : ['left', 'right'];
                                                    const perSide = Math.floor(seatsCount / 2);
                                                    const remainder = seatsCount % 2;

                                                    sides.forEach((side, sideIdx) => {
                                                        const count = perSide + (sideIdx === 0 ? remainder : 0);
                                                        for (let i = 0; i < count; i++) {
                                                            const step = 100 / (count + 1);
                                                            const pos = (i + 1) * step;
                                                            let style = { position: 'absolute' };
                                                            if (side === 'top') { style.top = '-8px'; style.left = `${pos}%`; style.transform = 'translateX(-50%)'; }
                                                            if (side === 'bottom') { style.bottom = '-8px'; style.left = `${pos}%`; style.transform = 'translateX(-50%)'; }
                                                            if (side === 'left') { style.left = '-8px'; style.top = `${pos}%`; style.transform = 'translateY(-50%)'; }
                                                            if (side === 'right') { style.right = '-8px'; style.top = `${pos}%`; style.transform = 'translateY(-50%)'; }

                                                            chairs.push(
                                                                <div key={`${side}-${i}`} style={style} className="scale-75">
                                                                    <Chair side={side} color={chairColor} />
                                                                </div>
                                                            );
                                                        }
                                                    });
                                                    return chairs;
                                                })()}
                                            </div>

                                            {/* Resize Handles (Only show if selected) */}
                                            {selectedItem?.type === 'table' && selectedItem.id === table.id && !dragItem && (
                                                <>
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'table', table.id, 'br')} className="absolute -right-1 -bottom-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nwse-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'table', table.id, 'tr')} className="absolute -right-1 -top-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nesw-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'table', table.id, 'bl')} className="absolute -left-1 -bottom-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nesw-resize z-[110]" />
                                                    <div onMouseDown={(e) => handleMouseDown(e, 'table', table.id, 'tl')} className="absolute -left-1 -top-1 w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nwse-resize z-[110]" />
                                                </>
                                            )}
                                        </div>
                                    ))}

                                </div>
                            </div>

                            {/* Trash Area */}
                            <div
                                ref={trashRef}
                                className={`absolute bottom-8 right-8 w-20 h-20 rounded-full flex items-center justify-center transition-all z-[200] border-4 cursor-default
                                    ${isOverTrash ? 'bg-red-500 border-red-300 scale-125 shadow-2xl text-white' : 'bg-slate-100/50 border-slate-200/50 text-slate-400 shadow-lg'}
                                    ${dragItem ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}
                                `}
                            >
                                <div className="flex flex-col items-center">
                                    <FaTrashAlt size={24} className={isOverTrash ? 'animate-bounce' : ''} />
                                    <span className="text-[10px] font-black uppercase tracking-tighter mt-1">Drop to Delete</span>
                                </div>
                            </div>

                            {/* Empty State / Hint */}
                            {tables.length === 0 && mapObjects.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6">
                                        <FaArrowsAlt size={40} />
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-400">Canvas Is Empty</h4>
                                    <p className="text-slate-400 text-sm max-w-xs mt-2">Add tables from the list view or use the side palette to bring your floor plan to life.</p>
                                </div>
                            )}
                        </main>
                    </div>
                )}
            </div>

            {/* Modals from original version */}
            {showZoneModal && (
                <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center z-[200] p-4" onClick={() => setShowZoneModal(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold text-slate-900 mb-6">Create New Zone</h3>
                        <form onSubmit={async (e) => { e.preventDefault(); await api.addZone(newZoneName); setNewZoneName(''); setShowZoneModal(false); fetchData(); }} className="space-y-6">
                            <input type="text" placeholder="Ex. Rooftop, Terrace" value={newZoneName} onChange={e => setNewZoneName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 outline-none font-bold" required />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowZoneModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest">Commit Zone</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showTableModal && (
                <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center z-[200] p-4" onClick={() => setShowTableModal(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold text-slate-900 mb-6">Setup New Table</h3>
                        <form onSubmit={handleAddTable} className="space-y-6">
                            <input type="text" placeholder="Ex. A10" value={newTableName} onChange={e => setNewTableName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 outline-none font-bold" required />
                            <select value={newTableZone} onChange={e => setNewTableZone(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 outline-none font-bold appearance-none">
                                {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                            </select>
                            <input type="number" value={newTableSeats} onChange={e => setNewTableSeats(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 outline-none font-bold" min="1" />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowTableModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest">Forge Table</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Global CSS for the editor */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            ` }} />
        </MasterLayout>
    );
};

export default TableManagement;
