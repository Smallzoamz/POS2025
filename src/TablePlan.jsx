import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import generatePayload from 'promptpay-qr';
import { api, socket } from './services/api';
import MasterLayout from './layouts/MasterLayout';
import {
    FaUtensils, FaGlassMartiniAlt, FaRestroom, FaTree,
    FaLeaf, FaRoad, FaHome, FaBorderAll, FaLayerGroup
} from 'react-icons/fa';

const TablePlan = () => {
    const navigate = useNavigate();
    const [selectedZone, setSelectedZone] = useState('Indoor');
    const [tables, setTables] = useState([]);
    const [mapObjects, setMapObjects] = useState([]);
    const [takeawayOrders, setTakeawayOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [qrTable, setQrTable] = useState(null); // Table Name to show QR for
    const [hostUrl, setHostUrl] = useState(window.location.origin);
    const [paymentOrder, setPaymentOrder] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'qr'
    const [settings, setSettings] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'visual'

    // --- STYLIZED COMPONENTS ---
    const Chair = ({ side, occupied, color, tableRotation }) => {
        // Rotation based on which side of the table the chair is on
        const rotations = { top: 180, bottom: 0, left: 90, right: 270 };
        const rotation = rotations[side] || 0;

        return (
            <div
                style={{ transform: `rotate(${rotation}deg)` }}
                className={`w-6 h-6 flex flex-col items-center justify-center transition-all duration-500`}
            >
                {/* Backrest */}
                <div className={`w-4 h-1.5 rounded-t-lg -mb-0.5 ${occupied ? '' : 'border-t border-x border-slate-300'}`} style={{ backgroundColor: occupied ? color : 'transparent' }} />
                {/* Seat */}
                <div className={`w-5 h-4 rounded-md relative flex items-center justify-center ${occupied ? 'shadow-sm' : 'border border-slate-300 bg-white'}`} style={{ backgroundColor: occupied ? color : '' }}>
                    {/* Legs (stylized dots) */}
                    <div className={`absolute -top-0.5 -left-0.5 w-1 h-1 rounded-full ${occupied ? '' : 'bg-slate-200'}`} style={{ backgroundColor: occupied ? color : '' }} />
                    <div className={`absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full ${occupied ? '' : 'bg-slate-200'}`} style={{ backgroundColor: occupied ? color : '' }} />
                    <div className={`absolute -bottom-0.5 -left-0.5 w-1 h-1 rounded-full ${occupied ? '' : 'bg-slate-200'}`} style={{ backgroundColor: occupied ? color : '' }} />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-1 h-1 rounded-full ${occupied ? '' : 'bg-slate-200'}`} style={{ backgroundColor: occupied ? color : '' }} />

                    {/* Stripes on backrest look */}
                    <div className="flex gap-0.5 opacity-20">
                        <div className="w-0.5 h-2 bg-white rounded-full" />
                        <div className="w-0.5 h-2 bg-white rounded-full" />
                    </div>
                </div>
            </div>
        );
    };

    // Layout Utilities
    const renderObjectIcon = (type, color = 'currentColor') => {
        const props = { size: 24, color };
        switch (type) {
            case 'kitchen': return <FaUtensils {...props} />;
            case 'water_station': return <FaGlassMartiniAlt {...props} />;
            case 'restroom': return <FaRestroom {...props} />;
            case 'tree': return <FaTree {...props} />;
            case 'garden': return <FaLeaf {...props} />;
            case 'walkway': return <FaRoad {...props} />;
            case 'hut': return <FaHome {...props} />;
            case 'area_zone': return <FaLayerGroup {...props} />;
            default: return <FaBorderAll {...props} />;
        }
    };

    useEffect(() => {
        loadTables();
        loadTakeawayOrders();
        loadSettings();

        // Fetch Network Status for correct QR Code URL
        const fetchNetwork = async () => {
            try {
                const net = await api.getNetworkStatus();
                if (net.cloudUrl && net.isCloudActive) {
                    setHostUrl(net.cloudUrl);
                } else if (net.localIp) {
                    const displayPort = window.location.port === '5173' ? '5173' : (net.port || 3000);
                    setHostUrl(`http://${net.localIp}:${displayPort}`);
                }
            } catch (e) {
                console.error("Failed to load network status for QR", e);
            }
        };
        fetchNetwork();

        // Real-time listener
        socket.on('table-update', () => {
            loadTables();
        });

        socket.on('call-bill', ({ tableName }) => {
            // Play notification sound if possible
            const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
            audio.play().catch(e => console.log('Audio play failed', e));

            alert(`🔔 โต๊ะ ${tableName} เรียกเช็คบิลครับ!`);
        });

        socket.on('order-update', () => {
            loadTables();
            loadTakeawayOrders();
        });

        return () => {
            socket.off('table-update');
            socket.off('call-bill');
            socket.off('order-update');
        };
    }, []);

    const loadTables = async () => {
        try {
            const [tablesData, mapObjectsData] = await Promise.all([
                api.getTables(),
                api.getMapObjects()
            ]);

            if (Array.isArray(tablesData)) {
                setTables(tablesData);
            }
            if (Array.isArray(mapObjectsData)) {
                setMapObjects(mapObjectsData);
            }
        } catch (err) {
            console.error('Failed to load table plan data:', err);
        } finally {
            setLoading(false);
        }
    };

    const getTableUrl = (tableName) => {
        const baseUrl = window.location.origin; // e.g., http://localhost:5173
        return `${baseUrl}/order/${tableName}`; // Standard URL for BrowserRouter
        // Or better: http://<IP>:5173/order/T-01
        // Since we are running on local network for mobile, we should use the IP.
        // For now, let's rely on the browser's current host which is correct if accessed via IP.
    };

    const loadTakeawayOrders = async () => {
        try {
            const data = await api.getActiveTakeawayOrders();
            if (Array.isArray(data)) {
                setTakeawayOrders(data);
            }
        } catch (err) {
            console.error("Failed to load takeaway orders", err);
        }
    };

    const loadSettings = async () => {
        try {
            const data = await api.getSettings();
            setSettings(data);
        } catch (err) {
            console.error("Failed to load settings", err);
        }
    };

    const handleCompleteTakeaway = async (order) => {
        setPaymentOrder(order);
        setPaymentMethod('cash');
    };

    const confirmPayment = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await api.completeOrder(paymentOrder.id, paymentMethod);
            setPaymentOrder(null);
            loadTakeawayOrders();
        } catch (err) {
            console.error(err);
            alert('Error completing payment');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredTables = tables.filter(t => t.zone === selectedZone);

    return (
        <MasterLayout>
            <div className="no-print space-y-10">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">ผังโต๊ะ <span className="text-orange-500">Tasty Station</span></h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Live Table Management • Select a table to start</p>
                    </div>

                    {/* View Mode & Zone Picker */}
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        {/* View Mode Toggle */}
                        <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
                            <div className="px-5 py-2 rounded-xl bg-white text-slate-900 shadow-sm font-bold text-[10px] uppercase tracking-widest">
                                Grid View
                            </div>
                        </div>

                        {/* Zone Picker */}
                        <div className="bg-white p-1.5 rounded-[20px] flex gap-1 shadow-sm border border-slate-100">
                            {(() => {
                                const zones = tables.length > 0
                                    ? [...new Set(tables.map(t => t.zone))]
                                    : ['Indoor', 'Outdoor', 'VIP'];

                                return zones.map(zone => (
                                    <button
                                        key={zone}
                                        onClick={() => setSelectedZone(zone)}
                                        className={`px-6 py-2.5 rounded-[14px] text-xs font-bold uppercase tracking-widest transition-all ${selectedZone === zone
                                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {zone}
                                    </button>
                                ));
                            })()}
                        </div>
                    </div>
                </header>

                {/* Takeaway Orders Section (NEW) */}
                {takeawayOrders.length > 0 && (
                    <section className="animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-sm">🛍️</div>
                            <div>
                                <h3 className="font-bold text-slate-900 leading-none">ออเดอร์รอรับกลับบ้าน</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ready for pickup ({takeawayOrders.length} items)</p>
                            </div>
                        </div>

                        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                            {takeawayOrders.map(order => (
                                <div key={order.id} className="min-w-[280px] bg-white rounded-2xl shadow-sm border border-orange-100 p-4 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-slate-900 leading-tight">{order.customer_name}</h4>
                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">#{order.id} • {order.customer_phone || 'no phone'}</p>
                                        </div>
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg uppercase">พร้อมเสิร์ฟ</span>
                                    </div>

                                    <div className="space-y-1 mb-4">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="text-xs text-slate-600">
                                                <div className="flex justify-between">
                                                    <span>{item.quantity}x {item.product_name}</span>
                                                </div>
                                                {item.options && item.options.length > 0 && (
                                                    <p className="text-[10px] text-orange-500 font-medium ml-4">
                                                        + {item.options.map(o => o.name || o.option_name).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handleCompleteTakeaway(order)}
                                        className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-95"
                                    >
                                        ชำระเงิน & รับของ ✓
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Tables Display */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">กำลังโหลด...</div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {filteredTables.map(table => {
                            const isOccupied = table.status === 'occupied';
                            const isCalling = table.status === 'checking' || table.status === 'payment';
                            const isReserved = !!table.reservation_time && table.status === 'available';

                            const getStatusTheme = () => {
                                if (isCalling) return { bg: 'bg-[#FFE1E1]', border: 'border-[#FFC5C5]', text: 'text-red-500', badge: 'bg-red-500' };
                                if (isOccupied) return { bg: 'bg-[#FFF4E5]', border: 'border-[#FFD8A8]', text: 'text-orange-500', badge: 'bg-orange-500' };
                                if (isReserved) return { bg: 'bg-[#E1F2FF]', border: 'border-[#C5E4FF]', text: 'text-blue-500', badge: 'bg-blue-500' };
                                return { bg: 'bg-white', border: 'border-slate-100', text: 'text-slate-300', badge: 'bg-slate-200' };
                            };

                            const theme = getStatusTheme();

                            return (
                                <div key={table.id} className="relative group">
                                    <div
                                        onClick={() => navigate(`/order/${table.name}`)}
                                        className={`tasty-card p-6 border-2 flex flex-col items-center justify-between text-center cursor-pointer transition-all hover:scale-[1.05] hover:shadow-xl ${theme.bg} ${theme.border} h-[240px]`}
                                    >
                                        <div className="flex flex-col items-center">
                                            <div className={`w-3 h-3 rounded-full ${theme.badge} mb-4 ${isCalling ? 'animate-pulse' : ''}`}></div>
                                            <h3 className="text-4xl font-black text-slate-900 tracking-tighter font-heading mb-1">{table.name}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{table.seats} Seats</p>
                                        </div>

                                        {(isOccupied || isCalling) ? (
                                            <div className="w-full space-y-2 pt-4 border-t border-black/5">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    <span>Time</span>
                                                    <span className="text-slate-900">{table.order_time ? Math.floor((new Date() - new Date(table.order_time)) / 60000) + 'm' : '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span className="text-slate-400 uppercase tracking-widest text-[10px]">Total</span>
                                                    <span className="text-orange-600 font-black text-base">฿{(table.total_amount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ) : isReserved ? (
                                            <div className="w-full pt-4 border-t border-blue-100">
                                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Reserved</p>
                                                <p className="text-xs font-bold text-slate-900 truncate">@{table.reservation_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1">🕒 {table.reservation_time}</p>
                                            </div>
                                        ) : (
                                            <div className="w-full flex flex-col items-center pt-4 border-t border-slate-50">
                                                <div className="text-2xl text-slate-200 group-hover:text-orange-400 transition-colors">+</div>
                                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-orange-400 transition-colors">Start Order</p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); setQrTable(table.name); }}
                                        className="absolute -top-3 -right-3 w-10 h-10 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-xl hover:bg-orange-50 hover:text-orange-500 transition-all z-10 text-xl"
                                    >
                                        📱
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="relative w-full overflow-hidden bg-slate-50 rounded-[40px] border border-slate-200 shadow-inner min-h-[600px] select-none p-10 animate-fade-in">
                        {/* Map Backdrop Decor */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                        {/* Zone Label Overlay */}
                        <div className="absolute top-8 left-10">
                            <h4 className="text-4xl font-black text-slate-200 uppercase tracking-tighter opacity-50">{selectedZone} ZONE</h4>
                        </div>

                        {/* Interactive Map Area */}
                        <div className="relative w-full h-[600px]">
                            {/* Map Objects (Decorations) */}
                            {mapObjects.map(obj => (
                                <div
                                    key={`obj-${obj.id}`}
                                    style={{
                                        position: 'absolute',
                                        left: obj.x || 0,
                                        top: obj.y || 0,
                                        width: obj.w || 100,
                                        height: obj.h || 100,
                                        transform: `rotate(${obj.rotation || 0}deg)`,
                                        zIndex: obj.type === 'walkway' ? 1 : (obj.type === 'area_zone' ? 0 : 10)
                                    }}
                                    className="flex items-center justify-center pointer-events-none"
                                >
                                    <div
                                        className={`w-full h-full rounded-2xl flex flex-col items-center justify-center relative transition-all duration-700
                                            ${obj.type === 'kitchen' ? 'bg-slate-200 border-2 border-slate-400 shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]' : ''}
                                            ${obj.type === 'water_station' ? 'bg-sky-50 border-2 border-sky-200' : ''}
                                            ${obj.type === 'restroom' ? 'bg-slate-100 border-2 border-slate-200' : ''}
                                            ${obj.type === 'tree' ? 'bg-emerald-600 rounded-full border-4 border-emerald-800/20 shadow-[0_10px_20px_rgba(5,150,105,0.3)]' : ''}
                                            ${obj.type === 'garden' ? 'bg-emerald-100 border-2 border-emerald-200 shadow-inner' : ''}
                                            ${obj.type === 'walkway' ? 'bg-slate-200/40 border-y border-slate-300/20' : ''}
                                            ${obj.type === 'hut' ? 'bg-[#D2B48C] border-2 border-amber-900 shadow-xl' : ''}
                                            ${obj.type === 'area_zone' ? 'bg-orange-50/10 border-2 border-dashed border-orange-200' : ''}
                                            ${obj.type === 'fence' ? 'border-y-4 border-dashed border-amber-800/30' : ''}
                                        `}
                                    >
                                        {obj.type === 'area_zone' && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden opacity-50 pointer-events-none">
                                                <span className="text-3xl font-black text-slate-400 uppercase tracking-tighter">{obj.name || 'NEW ZONE'}</span>
                                                <div className="w-12 h-0.5 bg-slate-300 rounded-full mt-2" />
                                            </div>
                                        )}
                                        {/* Realistic Details */}
                                        {obj.type === 'tree' && (
                                            <div className="absolute inset-0 rounded-full overflow-hidden">
                                                <div className="absolute top-1 left-1 w-1/2 h-1/2 bg-white/20 rounded-full blur-sm" />
                                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
                                            </div>
                                        )}
                                        {obj.type === 'garden' && (
                                            <div className="absolute inset-0 p-1 grid grid-cols-4 gap-1 opacity-60">
                                                {[...Array(8)].map((_, i) => (
                                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${['bg-pink-400', 'bg-yellow-400', 'bg-purple-400'][i % 3]} animate-pulse`} style={{ animationDelay: `${i * 0.2}s` }} />
                                                ))}
                                            </div>
                                        )}
                                        {obj.type === 'hut' && (
                                            <>
                                                {/* Roof Top View */}
                                                <div className="absolute inset-0 bg-amber-900/10" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg, transparent 0deg 30deg, rgba(0,0,0,0.05) 30deg 60deg)' }} />
                                                <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.2)]" />
                                                <div className="w-2 h-2 bg-amber-900 rounded-full z-10 shadow-lg" />
                                            </>
                                        )}

                                        {obj.type !== 'fence' && renderObjectIcon(obj.type, (obj.type === 'tree' || obj.type === 'hut') ? 'rgba(255,255,255,0.8)' : 'currentColor')}
                                        <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 px-2 line-clamp-1 ${(obj.type === 'tree' || obj.type === 'hut') ? 'text-white' : 'opacity-50'}`}>{obj.name}</span>
                                    </div>
                                </div>
                            ))}

                            {/* Tables */}
                            {filteredTables.map(table => {
                                const isOccupied = table.status === 'occupied';
                                const isCalling = table.status === 'checking' || table.status === 'payment';
                                const isReserved = !!table.reservation_time && table.status === 'available';

                                const getStatusColor = () => {
                                    if (isCalling) return 'bg-red-500 shadow-lg shadow-red-500/20';
                                    if (isOccupied) return 'bg-orange-500 shadow-lg shadow-orange-500/20';
                                    if (isReserved) return 'bg-blue-500 shadow-lg shadow-blue-500/20';
                                    return 'bg-white border-2 border-slate-200 hover:border-orange-300';
                                };

                                return (
                                    <div
                                        key={table.id}
                                        style={{
                                            left: table.x || 0,
                                            top: table.y || 0,
                                            width: table.w || 80,
                                            height: table.h || 80,
                                            transform: `rotate(${table.rotation || 0}deg)`
                                        }}
                                        className="absolute transition-all duration-500 cursor-pointer group z-50"
                                        onClick={() => navigate(`/order/${table.name}`)}
                                    >
                                        {/* Chairs Rendering based on Seat Count */}
                                        {/* Chairs Rendering based on Seat Count & Side-Alignment */}
                                        {(() => {
                                            const seatsCount = parseInt(table.seats || 2);
                                            const isLandscape = (table.w || 80) >= (table.h || 80);
                                            const chairs = [];
                                            const color = isOccupied || isCalling ? (table.shape === 'circle' ? '#f97316' : '#0d9488') : '#94a3b8';

                                            // Logic to place chairs along the longest sides
                                            const sides = isLandscape ? ['top', 'bottom'] : ['left', 'right'];
                                            const perSide = Math.floor(seatsCount / 2);
                                            const remainder = seatsCount % 2;

                                            sides.forEach((side, sideIdx) => {
                                                const count = perSide + (sideIdx === 0 ? remainder : 0);
                                                for (let i = 0; i < count; i++) {
                                                    const step = 100 / (count + 1);
                                                    const pos = (i + 1) * step;

                                                    let style = { position: 'absolute' };
                                                    if (side === 'top') { style.top = '-12px'; style.left = `${pos}%`; style.transform = 'translateX(-50%)'; }
                                                    if (side === 'bottom') { style.bottom = '-12px'; style.left = `${pos}%`; style.transform = 'translateX(-50%)'; }
                                                    if (side === 'left') { style.left = '-12px'; style.top = `${pos}%`; style.transform = 'translateY(-50%)'; }
                                                    if (side === 'right') { style.right = '-12px'; style.top = `${pos}%`; style.transform = 'translateY(-50%)'; }

                                                    chairs.push(
                                                        <div key={`${side}-${i}`} style={style}>
                                                            <Chair side={side} occupied={isOccupied || isCalling} color={color} />
                                                        </div>
                                                    );
                                                }
                                            });
                                            return chairs;
                                        })()}

                                        {/* Main Table Body */}
                                        <div className={`w-full h-full flex flex-col items-center justify-center transition-all duration-500 ${table.shape === 'circle' ? 'rounded-full' : (table.shape === 'hut' ? 'rounded-2xl' : 'rounded-3xl')} relative group-hover:scale-110 active:scale-95 border-2
                                            ${isCalling ? 'bg-red-50 border-red-500 shadow-xl shadow-red-500/20' :
                                                isOccupied ? (table.shape === 'hut' ? 'bg-[#D2B48C] border-amber-900 overflow-hidden' : (table.shape === 'circle' ? 'bg-[#FFF1F2] border-[#FECDD3]' : 'bg-[#E0F2F1] border-[#80CBC4]')) :
                                                    isReserved ? 'bg-blue-50 border-blue-200' :
                                                        (table.shape === 'hut' ? 'bg-[#D2B48C] border-amber-900 overflow-hidden' : 'bg-white border-slate-200')}
                                        `}>
                                            {/* Hut Roof Texture for Table */}
                                            {table.shape === 'hut' && (
                                                <>
                                                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg, transparent 0deg 30deg, rgba(0,0,0,0.1) 30deg 60deg)' }} />
                                                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-amber-900/10 pointer-events-none" />
                                                    <div className="w-1.5 h-1.5 bg-amber-950 rounded-full z-20 shadow-sm border border-amber-800/20" />
                                                </>
                                            )}

                                            <span className={`font-black tracking-tighter transition-colors relative z-10
                                                ${isCalling ? 'text-red-500 text-base' :
                                                    isOccupied ? (table.shape === 'hut' ? 'text-amber-950' : (table.shape === 'circle' ? 'text-[#E11D48]' : 'text-[#00695C]')) :
                                                        (table.shape === 'hut' ? 'text-amber-950' : 'text-slate-800')}
                                            `} style={{ fontSize: Math.min(table.w, table.h) / 4 }}>
                                                {table.name}
                                            </span>

                                            {/* Seat Indicator Icon */}
                                            <div className="flex items-center gap-1 opacity-40 mt-0.5 relative z-10">
                                                <FaUtensils size={8} className={isOccupied ? 'animate-bounce' : ''} />
                                                <span className="text-[9px] font-bold">{table.seats}</span>
                                            </div>

                                            {isCalling && <div className="absolute -top-3 -right-3 w-7 h-7 bg-white rounded-full flex items-center justify-center animate-bounce shadow-lg text-sm border-2 border-red-500 z-[60]">🔔</div>}
                                        </div>

                                        {/* Hover Quick Card */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
                                            <div className="bg-slate-900 text-white text-[10px] py-1.5 px-4 rounded-2xl whitespace-nowrap font-black shadow-2xl border border-white/10 uppercase tracking-widest flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                                                {table.status} • {table.seats} Seats
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Decoration Elements */}
                        <div className="absolute bottom-10 right-10 flex gap-10 items-end opacity-20 pointer-events-none">
                            <div className="w-40 h-10 border-4 border-slate-900 rounded-t-3xl flex items-center justify-center font-black text-slate-500">ENTRANCE</div>
                            <div className="w-20 h-20 bg-slate-300 rounded-3xl flex items-center justify-center font-black text-slate-500 text-xs">RESTROOM</div>
                        </div>
                    </div>
                )}
            </div>


            {/* QR Code Modal - Premium Glassmorphism */}
            {qrTable && (
                <div
                    className="fixed inset-0 backdrop-blur-md bg-slate-900/60 flex items-center justify-center z-[100] p-4 animate-fade-in"
                    onClick={() => setQrTable(null)}
                >
                    <div
                        className="bg-white rounded-[48px] p-10 max-w-sm w-full text-center shadow-2xl animate-fade-in-up relative overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>

                        <div className="mb-8">
                            <div className="text-6xl mb-4">🏪</div>
                            <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">โต๊ะ {qrTable}</h3>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest font-sans">Self-Ordering QR System</p>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-[40px] border-2 border-orange-100 inline-block shadow-inner hover:scale-[1.02] transition-transform duration-500 mb-8">
                            <QRCode
                                value={`${hostUrl}/order/${qrTable}?mode=customer`}
                                size={220}
                                level="H"
                                fgColor="#0f172a"
                                className="rounded-2xl"
                            />
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={() => window.print()}
                                className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
                            >
                                🖨️ Print QR Label
                            </button>
                            <button
                                onClick={() => setQrTable(null)}
                                className="text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest px-4 py-2"
                            >
                                [ Close Terminal ]
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Payment Modal for Takeaway */}
            {paymentOrder && (
                <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 flex items-center justify-center z-[110] p-4 animate-fade-in">
                    <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl animate-fade-in-up relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"></div>

                        <div className="text-center mb-6">
                            <div className="text-4xl mb-2">💰</div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tighter">ชำระเงินกลับบ้าน</h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Order #{paymentOrder.id} • {paymentOrder.customer_name}</p>
                        </div>

                        <div className="bg-slate-50 rounded-3xl p-6 mb-6 text-center border border-slate-100">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">ยอดรวมทั้งสิ้น</p>
                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter">฿{parseFloat(paymentOrder.total_amount).toLocaleString()}</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${paymentMethod === 'cash' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-500/10' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                                <span className="text-2xl">💵</span>
                                <span className="text-sm font-bold">เงินสด</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('qr')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${paymentMethod === 'qr' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-lg shadow-blue-500/10' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                                <span className="text-2xl">📱</span>
                                <span className="text-sm font-bold">QR Scan</span>
                            </button>
                        </div>

                        {paymentMethod === 'qr' && (
                            <div className="mb-6 flex flex-col items-center animate-fade-in">
                                <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-blue-200 mb-2">
                                    <QRCode
                                        value={generatePayload(settings.promptpay_number || '0000000000', { amount: parseFloat(paymentOrder.total_amount) })}
                                        size={140}
                                    />
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">สแกนเพื่อจ่าย • PromptPay</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={confirmPayment}
                                disabled={submitting}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? 'กำลังบันทึก...' : '✅ ยืนยันรับเงิน'}
                            </button>
                            <button
                                onClick={() => setPaymentOrder(null)}
                                className="w-full py-3 bg-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-colors"
                            >
                                [ ยกเลิก ]
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Printable QR Label (Table) */}
            {qrTable && (
                <div className="print-only printable-qr-wrapper">
                    <div className="flex flex-col items-center justify-center p-12 bg-white min-h-screen w-full">
                        <div className="border-[12px] border-slate-900 rounded-[80px] p-20 flex flex-col items-center max-w-2xl w-full bg-white text-center">
                            <div className="text-7xl mb-10">🍽️</div>
                            <h1 className="text-5xl font-black text-slate-900 mb-2 uppercase tracking-tight">{settings.shop_name || 'Tasty Station'}</h1>
                            <div className="w-24 h-2 bg-slate-900 rounded-full mb-10"></div>

                            <h2 className="text-[120px] font-black text-slate-900 leading-none mb-12 tracking-tighter">โต๊ะ {qrTable}</h2>

                            <div className="bg-white p-6 rounded-[40px] shadow-none border-2 border-slate-100 mb-12">
                                <QRCode
                                    value={`${hostUrl}/order/${qrTable}?mode=customer`}
                                    size={350}
                                    level="H"
                                    fgColor="#0f172a"
                                />
                            </div>

                            <p className="text-2xl font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">Scan to Order</p>
                            <p className="text-xl text-slate-300 font-medium">Please scan to view menu and order items</p>

                            <div className="mt-16 text-slate-200 font-black uppercase tracking-[0.5em] text-xs">
                                Tasty Station POS System
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MasterLayout>
    );
};

export default TablePlan;
