import React, { useState, useEffect } from 'react';
import { api, socket } from './services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

const KitchenDisplay = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [recipeLoading, setRecipeLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [lineOrders, setLineOrders] = useState([]); // LINE orders section
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        loadOrders();

        // Listen for new orders
        socket.on('new-order', () => {
            playNotificationSound();
            loadOrders();
        });

        // Listen for LINE order updates
        socket.on('line-order-update', () => {
            playNotificationSound();
            loadOrders();
        });

        // Polling Fallback (Every 10 seconds)
        const interval = setInterval(() => {
            loadOrders();
        }, 10000);

        // Timer Tick (Every 10 seconds to update relative time display)
        const timerInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 10000);

        return () => {
            socket.off('new-order');
            socket.off('line-order-update');
            clearInterval(interval);
            clearInterval(timerInterval);
        };
    }, []);

    const loadOrders = async () => {
        try {
            const [inStoreData, lineData] = await Promise.all([
                api.getKitchenOrders(),
                api.getKitchenLineOrders()
            ]);
            setOrders(inStoreData);
            setLineOrders(lineData);
            setLoading(false);
        } catch (error) {
            console.error("Error loading kitchen orders:", error);
            setLoading(false);
        }
    };

    const handleViewRecipe = async (order) => {
        setRecipeLoading(true);
        // Prepare structure for multiple items
        setSelectedRecipe({ ...order, items: [] });

        try {
            // Fetch recipe for each item in the order
            const itemsWithRecipes = await Promise.all(order.items.map(async (item) => {
                const baseIngredients = await api.getProductRecipe(item.product_id);
                let ingredients = [...(Array.isArray(baseIngredients) ? baseIngredients : [])];

                // Fetch ingredients for each option
                if (item.options && item.options.length > 0) {
                    const optionsIngredients = await Promise.all(item.options.map(opt => api.getOptionRecipe(opt.option_id || opt.id)));
                    optionsIngredients.forEach(optRecipe => {
                        if (Array.isArray(optRecipe)) {
                            optRecipe.forEach(oi => {
                                const existing = ingredients.find(ing => ing.ingredient_id === oi.ingredient_id);
                                if (existing) {
                                    existing.quantity_used += parseFloat(oi.quantity_used);
                                } else {
                                    ingredients.push({
                                        ...oi,
                                        name: oi.ingredient_name || oi.name // Ensure name property exists
                                    });
                                }
                            });
                        }
                    });
                }

                return { ...item, ingredients };
            }));

            setSelectedRecipe({ ...order, items: itemsWithRecipes });
        } catch (error) {
            console.error(error);
            alert('ไม่สามารถโหลดสูตรอาหารได้');
        } finally {
            setRecipeLoading(false);
        }
    };

    // Handle view recipe for LINE orders (different format - uses 'id' and 'name' instead of 'product_id' and 'product_name')
    const handleViewLineRecipe = async (order) => {
        setRecipeLoading(true);
        setSelectedRecipe({ ...order, table_name: order.customer_name, items: [] });

        try {
            const itemsWithRecipes = await Promise.all(order.items.map(async (item) => {
                // LINE orders use 'id' for product, while in-store uses 'product_id'
                const productId = item.product_id || item.id;
                const baseIngredients = await api.getProductRecipe(productId);
                let ingredients = [...(Array.isArray(baseIngredients) ? baseIngredients : [])];

                // Fetch ingredients for each option (LINE orders store options in the item object)
                if (item.options && item.options.length > 0) {
                    const optionsIngredients = await Promise.all(item.options.map(opt => api.getOptionRecipe(opt.option_id || opt.id)));
                    optionsIngredients.forEach(optRecipe => {
                        if (Array.isArray(optRecipe)) {
                            optRecipe.forEach(oi => {
                                const existing = ingredients.find(ing => ing.ingredient_id === oi.ingredient_id);
                                if (existing) {
                                    existing.quantity_used += parseFloat(oi.quantity_used);
                                } else {
                                    ingredients.push({
                                        ...oi,
                                        name: oi.ingredient_name || oi.name
                                    });
                                }
                            });
                        }
                    });
                }
                return { ...item, product_name: item.product_name || item.name, ingredients };
            }));

            setSelectedRecipe({ ...order, table_name: order.customer_name, items: itemsWithRecipes });
        } catch (error) {
            console.error(error);
            alert('ไม่สามารถโหลดสูตรอาหารได้');
        } finally {
            setRecipeLoading(false);
        }
    };

    // Helper for Smart Unit Display
    const formatIngredient = (qty, unit) => {
        // Large values: Convert small to large (e.g., 1500g -> 1.5kg)
        if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
        if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} l`;

        // Small decimal values: Convert large to small (e.g., 0.14kg -> 140g)
        if (unit === 'kg' && qty < 1) return `${(qty * 1000).toLocaleString()} g`;
        if (unit === 'l' && qty < 1) return `${(qty * 1000).toLocaleString()} ml`;

        return `${qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
    };

    const playNotificationSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Simple bell sound
        audio.play().catch(e => console.log("Audio play failed (user interaction required first)"));
    };

    // Parse UTC Date from DB (Append 'Z' if missing)
    const parseDate = (dateString) => {
        if (!dateString) return new Date();
        // If no timezone indicator, assume UTC (Z)
        if (!dateString.endsWith('Z') && !dateString.includes('+')) {
            return new Date(dateString + 'Z');
        }
        return new Date(dateString);
    };

    if (loading) return <div className="bg-gray-900 h-screen flex items-center justify-center text-white text-2xl font-bold animate-pulse">กำลังโหลดข้อมูลครัว...</div>;

    return (
        <div className="min-h-screen bg-slate-950 font-['Outfit'] p-4 md:p-8 overflow-x-hidden selection:bg-orange-500/30 selection:text-orange-200">
            {/* Background Texture Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

            {/* Recipe Modal - Premium Dark Interface */}
            {selectedRecipe && (
                <div className="fixed inset-0 backdrop-blur-2xl bg-slate-950/80 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedRecipe(null)}>
                    <div className="bg-slate-900 rounded-[48px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(249,115,22,0.1)] relative border border-white/10 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        {/* Status bar */}
                        <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>

                        {/* Modal Header */}
                        <div className="px-10 py-10 bg-slate-900/50 border-b border-white/5 relative flex justify-between items-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent">
                            <div>
                                <h3 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
                                    📖 Cooking <span className="text-orange-500 underline decoration-4 underline-offset-8">Blueprint</span>
                                </h3>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-3">Precision Kitchen Operations</p>
                            </div>
                            <button
                                onClick={() => setSelectedRecipe(null)}
                                className="w-14 h-14 bg-white/5 hover:bg-orange-500 text-slate-400 hover:text-white rounded-[24px] transition-all duration-300 border border-white/10 flex items-center justify-center text-xl hover:rotate-90"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-10 py-10 overflow-y-auto space-y-10 custom-scrollbar-dark flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {recipeLoading ? (
                                    <div className="col-span-2 text-center py-20">
                                        <div className="inline-block w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-6 text-[11px] font-black text-slate-500 uppercase tracking-widest">Retrieving Culinary Data...</p>
                                    </div>
                                ) : (selectedRecipe.items || []).length > 0 ? (
                                    selectedRecipe.items.map((item, itemIdx) => (
                                        <div key={itemIdx} className="group relative">
                                            <div className="mb-6 flex justify-between items-end">
                                                <div className="relative">
                                                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] block mb-2">Order Component</span>
                                                    <h4 className="text-2xl font-black text-white tracking-tighter group-hover:text-orange-400 transition-colors">
                                                        {item.product_name}
                                                    </h4>
                                                </div>
                                                <div className="bg-orange-500 text-white font-black px-4 py-1.5 rounded-xl text-lg shadow-[0_5px_15px_rgba(249,115,22,0.3)]">
                                                    x{item.quantity}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {(item.ingredients || []).map((ing, ingIdx) => (
                                                    <div key={ingIdx} className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/5 group-hover:border-orange-500/20 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></div>
                                                            <span className="text-base font-bold text-slate-300">{ing.name}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-lg font-black text-white tabular-nums">{formatIngredient(ing.quantity_used * item.quantity, ing.unit)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(item.ingredients || []).length === 0 && <p className="text-slate-600 italic text-sm py-4">Detailed ingredients not specified.</p>}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 text-center py-20 text-slate-500">
                                        <p className="text-2xl font-black italic opacity-20 uppercase tracking-tighter">No Recipe Data Available</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-10 py-8 bg-slate-900/80 border-t border-white/5 flex gap-4">
                            <button
                                onClick={() => setSelectedRecipe(null)}
                                className="flex-1 py-5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[24px] transition-all shadow-[0_10px_30px_rgba(249,115,22,0.2)] hover:scale-[1.02]"
                            >
                                Acknowledge & Resume
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Interface */}
            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/')}
                        className="w-16 h-16 bg-white/5 hover:bg-orange-500 text-white rounded-[24px] transition-all duration-500 border border-white/10 flex items-center justify-center text-2xl shadow-xl hover:rotate-[-10deg]"
                    >
                        🏠
                    </button>
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
                            KITCHEN <span className="text-orange-500">TERMINAL</span>
                        </h1>
                        <div className="flex items-center gap-4 mt-2">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Neural Display System v2.5</span>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] text-emerald-500 font-black uppercase">Server Sync Active</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-slate-900 border border-white/10 px-6 py-4 rounded-[28px] flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pending Orders</span>
                            <span className="text-2xl font-black text-orange-500 tracking-tighter">
                                {orders.length + lineOrders.length} <span className="text-xs text-slate-600 font-bold">READY TO FIRE</span>
                            </span>
                        </div>
                        <div className="w-px h-10 bg-white/10"></div>
                        <div className="text-3xl font-black text-white font-mono tracking-tighter">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            if (window.confirm('Terminate Kitchen Session?')) {
                                logout();
                                navigate('/login');
                            }
                        }}
                        className="px-6 py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-[28px] transition-all duration-500 flex items-center gap-3 font-black text-[10px] uppercase tracking-widest group"
                    >
                        <span className="text-lg group-hover:scale-125 transition-transform">🚪</span> EXIT SYSTEM
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            {orders.length === 0 && lineOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px]"></div>
                    <div className="w-32 h-32 bg-slate-900 border border-white/5 rounded-[48px] flex items-center justify-center mb-10 shadow-2xl relative group overflow-hidden">
                        <div className="absolute inset-0 bg-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-6xl z-10 group-hover:scale-110 transition-transform duration-700">🧑‍🍳</span>
                    </div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-4 z-10 uppercase">Kitchen is <span className="text-orange-500">Silent</span></h2>
                    <p className="text-slate-500 font-black text-[11px] uppercase tracking-[0.4em] z-10">Monitoring for incoming transmissions...</p>
                </div>
            ) : (
                <div className="space-y-16 relative z-10">
                    {/* Section: In-Store Orders */}
                    {orders.length > 0 && (
                        <div>
                            <header className="flex items-center gap-4 mb-8">
                                <span className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em]">In-Store Queue</span>
                                <div className="h-px bg-white/5 flex-1"></div>
                                <span className="bg-orange-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-tighter">
                                    {orders.length} ACTIVE BATTLES
                                </span>
                            </header>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {orders.map(order => {
                                    const orderTime = parseDate(order.created_at);
                                    const minsAgo = Math.floor((currentTime - orderTime) / 60000);
                                    let timerStyle = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                                    if (minsAgo > 15) timerStyle = "text-red-400 bg-red-500/20 border-red-500/30 animate-pulse";
                                    else if (minsAgo > 10) timerStyle = "text-orange-400 bg-orange-500/10 border-orange-500/20";

                                    const accentColor = order.order_type === 'takeaway' ? 'bg-amber-500' : 'bg-orange-500';

                                    return (
                                        <div key={order.id} className="bg-slate-900 rounded-2xl border border-white/5 shadow-lg flex flex-col group hover:border-orange-500/30 transition-all duration-300 overflow-hidden relative">
                                            <div className={`h-1 ${accentColor} absolute top-0 left-0 right-0`}></div>

                                            <div className="p-4 pb-2 flex justify-between items-start">
                                                <div>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                                                        {order.order_type === 'takeaway' ? 'Customer' : 'Table'}
                                                    </span>
                                                    <h3 className="text-lg font-bold text-white tracking-tight">
                                                        {order.order_type === 'takeaway' ? order.customer_name : order.table_name || 'N/A'}
                                                    </h3>
                                                    {order.order_type === 'takeaway' && order.customer_phone && (
                                                        <span className="text-[10px] text-slate-400 font-mono block leading-tight">{order.customer_phone}</span>
                                                    )}
                                                </div>
                                                <div className={`px-2 py-1 rounded-lg border font-bold text-[10px] tabular-nums ${timerStyle}`}>
                                                    {minsAgo}M
                                                </div>
                                            </div>

                                            <div className="px-4 flex items-center gap-2 mb-3">
                                                <span className="text-[9px] font-bold text-slate-600 font-mono">#{order.id}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border ${order.order_type === 'takeaway'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                    }`}>
                                                    {order.order_type === 'takeaway' ? 'กลับบ้าน' : 'ทานที่ร้าน'}
                                                </span>
                                            </div>

                                            <div className="px-4 flex-1 space-y-1.5 mb-4">
                                                {order.items.map((item, idx) => (
                                                    <div key={idx} className="space-y-1">
                                                        <div className="flex gap-2 items-start">
                                                            <span className="flex-shrink-0 w-5 h-5 bg-slate-800 rounded-md flex items-center justify-center text-[10px] font-bold text-white">
                                                                {item.quantity}
                                                            </span>
                                                            <span className="text-sm font-black text-white leading-tight">
                                                                {item.product_name}
                                                            </span>
                                                        </div>
                                                        {item.options && item.options.length > 0 && (
                                                            <div className="pl-7 space-y-0.5">
                                                                {item.options.map((opt, oIdx) => (
                                                                    <div key={oIdx} className="text-[10px] text-orange-400 font-bold flex items-center gap-1.5 uppercase tracking-wide">
                                                                        <span className="w-1 h-1 rounded-full bg-orange-500/50"></span>
                                                                        {opt.option_name || opt.name}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="p-3 bg-white/5 grid grid-cols-2 gap-2 mt-auto border-t border-white/5">
                                                <button onClick={() => handleViewRecipe(order)} className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] uppercase rounded-lg transition-all">
                                                    Manual
                                                </button>
                                                <button onClick={() => handleServeOrder(order.id)} className="py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-[9px] uppercase rounded-lg transition-all shadow-lg shadow-orange-500/20">
                                                    Serve ✓
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Section: LINE Orders */}
                    {lineOrders.length > 0 && (
                        <div>
                            <header className="flex items-center gap-4 mb-6">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.3em]">Digital Stream (LINE)</span>
                                <div className="h-px bg-white/5 flex-1"></div>
                                <span className="bg-blue-600 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase">
                                    {lineOrders.length} ออเดอร์ LINE
                                </span>
                            </header>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {lineOrders.map(order => {
                                    const orderTime = parseDate(order.created_at);
                                    const minsAgo = Math.floor((currentTime - orderTime) / 60000);
                                    let timerStyle = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                                    if (minsAgo > 15) timerStyle = "text-red-400 bg-red-500/20 border-red-500/30 animate-pulse";
                                    else if (minsAgo > 10) timerStyle = "text-orange-400 bg-orange-500/10 border-orange-500/20";

                                    const accentColor = order.order_type === 'delivery' ? 'bg-blue-500' : 'bg-purple-500';

                                    return (
                                        <div key={`line-${order.id}`} className="bg-slate-900 rounded-2xl border border-white/5 shadow-lg flex flex-col group hover:border-blue-500/30 transition-all duration-300 overflow-hidden relative">
                                            <div className={`h-1 ${accentColor} absolute top-0 left-0 right-0`}></div>

                                            <div className="p-4 pb-2 flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">LINE Customer</span>
                                                    <h3 className="text-lg font-bold text-white tracking-tight truncate pr-2">
                                                        {order.order_type === 'reservation' ? `🪑 ${order.assigned_table || '??'}` : order.customer_name}
                                                    </h3>
                                                </div>
                                                <div className={`px-2 py-1 rounded-lg border font-bold text-[10px] tabular-nums ${timerStyle}`}>
                                                    {minsAgo}M
                                                </div>
                                            </div>

                                            <div className="px-4 flex flex-wrap items-center gap-1 mb-3">
                                                <span className="text-[9px] font-bold text-blue-400/80 font-mono uppercase">L-{order.id}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border ${order.order_type === 'delivery' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    (order.order_type === 'reservation' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')
                                                    }`}>
                                                    {order.order_type === 'delivery' ? 'Delivery' : (order.order_type === 'reservation' ? 'Reserv' : 'Pickup')}
                                                </span>
                                                {order.order_type === 'reservation' && <span className="text-[8px] text-slate-400 font-bold">{order.reservation_time}</span>}
                                            </div>

                                            <div className="px-4 flex-1 space-y-2 mb-4">
                                                {(order.items || []).map((item, idx) => (
                                                    <div key={idx} className="space-y-1">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex gap-2 items-start">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 rounded-md flex items-center justify-center text-[10px] font-bold text-blue-400">
                                                                    {item.quantity}
                                                                </span>
                                                                <span className="text-sm font-black text-white leading-tight">
                                                                    {item.product_name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {item.options && item.options.length > 0 && (
                                                            <div className="pl-7 space-y-0.5">
                                                                {item.options.map((opt, oIdx) => (
                                                                    <div key={oIdx} className="text-[10px] text-blue-400 font-bold flex items-center gap-1.5 uppercase tracking-wide">
                                                                        <span className="w-1 h-1 rounded-full bg-blue-500/50"></span>
                                                                        {opt.name}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="p-3 bg-white/5 grid grid-cols-2 gap-2 mt-auto border-t border-white/5">
                                                <button onClick={() => handleViewLineRecipe(order)} className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] uppercase rounded-lg transition-all">
                                                    Manual
                                                </button>
                                                <button onClick={() => handleServeLineOrder(order.id)} className="py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[9px] uppercase rounded-lg transition-all shadow-lg shadow-blue-500/20">
                                                    Ready ✓
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    async function handleServeOrder(orderId) {
        if (!confirm('ยืนยันเสิร์ฟออเดอร์นี้?')) return;
        try {
            await api.serveOrder(orderId);
            loadOrders(); // Refresh list
        } catch (err) {
            console.error(err);
            alert('Error serving order');
        }
    }

    async function handleServeLineOrder(orderId) {
        if (!confirm('ยืนยันออเดอร์ LINE พร้อมแล้ว?')) return;
        try {
            await api.post(`/line-orders/${orderId}/ready`);
            loadOrders(); // Refresh list
        } catch (err) {
            console.error(err);
            alert('Error updating LINE order');
        }
    }
};

export default KitchenDisplay;
