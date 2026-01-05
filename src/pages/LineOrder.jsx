import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import generatePayload from 'promptpay-qr';
import QRCode from 'react-qr-code';
import liff from '@line/liff';

const LineOrder = () => {
    // Steps: 1 = Select Type, 2 = Customer Info, 3 = Menu, 4 = Confirm, 5 = Success
    const [step, setStep] = useState(1);
    const [orderType, setOrderType] = useState(''); // reservation, delivery, pickup
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
        address: '',
        latitude: null,
        longitude: null,
        reservationDate: '',
        reservationTime: '',
        guestsCount: 2,
        preOrderFood: true, // Only for reservation
        assignedTable: '',
        note: ''
    });
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [orderId, setOrderId] = useState(null);
    const [shopSettings, setShopSettings] = useState({});
    const [isLocating, setIsLocating] = useState(false);
    const [availableTables, setAvailableTables] = useState([]);
    const [loadingTables, setLoadingTables] = useState(false);

    // LIFF State
    const [liffProfile, setLiffProfile] = useState(null);
    const [liffReady, setLiffReady] = useState(false);
    const [liffError, setLiffError] = useState(null);

    // Initialize LIFF
    useEffect(() => {
        const initLiff = async () => {
            const liffId = import.meta.env.VITE_LIFF_ID;
            if (!liffId) {
                console.log('LIFF ID not configured, running in standalone mode');
                setLiffReady(true);
                return;
            }

            try {
                await liff.init({ liffId });
                console.log('✅ LIFF initialized successfully');

                if (liff.isLoggedIn()) {
                    const profile = await liff.getProfile();
                    setLiffProfile(profile);
                    // Auto-fill customer name from LINE profile
                    setCustomerInfo(prev => ({
                        ...prev,
                        name: profile.displayName || prev.name
                    }));
                    console.log('👤 LINE Profile:', profile.displayName);
                } else if (liff.isInClient()) {
                    // Force login only if not in login process
                    if (!liff.isLoggedIn()) {
                        liff.login({ redirectUri: window.location.href });
                    }
                }

                setLiffReady(true);
            } catch (err) {
                console.error('❌ LIFF init failed:', err);
                setLiffError('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาเช็ค LIFF ID');
                setLiffReady(true);
            }
        };

        if (import.meta.env.VITE_LIFF_ID) {
            initLiff();
        } else {
            setLiffReady(true);
        }
    }, []);

    const handleLogin = () => {
        if (!import.meta.env.VITE_LIFF_ID) {
            alert('❌ ไม่พบ LIFF ID ในระบบ! กรุณาตั้งค่า VITE_LIFF_ID ใน Render ก่อนนะคะ');
            return;
        }
        liff.login({ redirectUri: window.location.href });
    };

    // Load Menu & Settings
    useEffect(() => {
        const loadData = async () => {
            try {
                const [menuRes, settingsRes] = await Promise.all([
                    fetch('/api/public/menu').then(r => r.json()),
                    fetch('/api/public/settings').then(r => r.json())
                ]);
                setCategories(menuRes.categories || []);
                setMenuItems(menuRes.products || []);
                if (menuRes.categories?.length > 0) {
                    setSelectedCategory(menuRes.categories[0].id);
                }
                setShopSettings(settingsRes || {});
            } catch (err) {
                console.error('Failed to load data:', err);
            }
        };
        loadData();
    }, []);

    // Cart Functions
    const addToCart = (item) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const updateQuantity = (itemId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, quantity: Math.max(0, item.quantity + delta) };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Submit Order
    const submitOrder = async () => {
        setLoading(true);
        try {
            const finalCart = customerInfo.preOrderFood ? cart : [];
            const finalTotal = customerInfo.preOrderFood ? cartTotal : 0;

            const res = await fetch('/api/public/line-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderType,
                    customerName: customerInfo.name,
                    customerPhone: customerInfo.phone,
                    customerAddress: customerInfo.address,
                    latitude: customerInfo.latitude,
                    longitude: customerInfo.longitude,
                    reservationDate: customerInfo.reservationDate,
                    reservationTime: customerInfo.reservationTime,
                    guestsCount: customerInfo.guestsCount,
                    assignedTable: customerInfo.assignedTable,
                    lineUserId: liffProfile?.userId || null, // Link to LINE profile for loyalty
                    items: finalCart.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity
                    })),
                    totalAmount: finalTotal,
                    note: customerInfo.note
                })
            });
            const data = await res.json();
            if (data.success) {
                setOrderId(data.orderId);
                setStep(5);
            } else {
                alert(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (err) {
            alert('ไม่สามารถเชื่อมต่อ Server ได้');
        }
        setLoading(false);
    };

    // Load Available Tables
    const loadAvailableTables = useCallback(async () => {
        if (!customerInfo.reservationDate || !customerInfo.guestsCount) return;
        setLoadingTables(true);
        try {
            const res = await fetch(`/api/public/available-tables?date=${customerInfo.reservationDate}&guests=${customerInfo.guestsCount}`);
            const data = await res.json();
            setAvailableTables(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load tables:', err);
        }
        setLoadingTables(false);
    }, [customerInfo.reservationDate, customerInfo.guestsCount]);

    // Order Type Labels
    const orderTypeLabels = {
        reservation: { icon: '🪑', name: 'จองโต๊ะ', desc: 'จองโต๊ะล่วงหน้า + สั่งอาหารรอ', color: 'bg-amber-50 text-amber-600 border-amber-100' },
        delivery: { icon: '🚚', name: 'Delivery', desc: 'สั่งส่งถึงบ้าน', color: 'bg-orange-50 text-orange-600 border-orange-100' },
        takeaway: { icon: '🛍️', name: 'รับเอง', desc: 'สั่งแล้วมารับที่ร้าน', color: 'bg-blue-50 text-blue-600 border-blue-100' }
    };

    // Get today's date for minimum reservation (allow same-day)
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];

    if (!liffReady) {
        return (
            <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium italic font-heading">กำลังเชื่อมต่อกับ LINE...</p>
                </div>
            </div>
        );
    }

    // Force Login Screen if not logged in
    if (!liffProfile && liffReady && !liffError) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-fade-in-up">
                <div className="mb-8 relative">
                    <div className="absolute inset-0 bg-orange-200 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                    <img
                        src="/logo.png"
                        alt="Tasty Station"
                        className="w-32 h-32 relative z-10"
                        onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/3256/3256193.png"; e.target.onerror = null; }}
                    />
                </div>

                <h1 className="text-3xl font-extrabold text-gray-900 mb-2 font-heading">อร่อยง่ายๆ ผ่าน LINE 🍱</h1>
                <p className="text-gray-500 mb-8 max-w-xs text-sm">
                    เข้าสู่ระบบเพื่อสั่งอาหาร ติดตามสถานะออเดอร์ และสะสมแต้มสมาชิก Tasty Station
                </p>

                <div className="space-y-4 w-full max-w-sm">
                    {!import.meta.env.VITE_LIFF_ID ? (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold">
                            ⚠️ ยังไม่ได้ตั้งค่า VITE_LIFF_ID <br />
                            (กรุณาตั้งค่าใน Render Environment)
                        </div>
                    ) : (
                        <button
                            onClick={handleLogin}
                            className="w-full bg-[#06C755] text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 font-heading"
                        >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" className="w-6 h-6 invert" alt="LINE" />
                            เข้าสู่ระบบด้วย LINE
                        </button>
                    )}

                    <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-50">
                        {[
                            { icon: "📍", label: "สั่งอาหาร" },
                            { icon: "🚀", label: "ส่งไว" },
                            { icon: "🎁", label: "สะสมแต้ม" }
                        ].map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1">
                                <span className="text-2xl">{item.icon}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="mt-12 text-[10px] text-slate-300 uppercase tracking-widest font-black">
                    Tasty Station POS System
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-4">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-heading font-black text-slate-900">{shopSettings.shop_name || 'Tasty Station'}</h1>
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Digital Ordering Experience</p>
                    </div>
                    {step > 1 && step < 5 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-2xl text-slate-500 hover:bg-slate-200 transition-all active:scale-90"
                        >
                            <span className="text-xl">←</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-lg mx-auto p-5 pb-32">
                {/* Step Indicator */}
                {step < 5 && (
                    <div className="flex justify-center items-center gap-3 mb-8">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className="flex items-center gap-3">
                                <div
                                    className={`w-3 h-3 rounded-full transition-all duration-500 ${s === step ? 'bg-orange-500 ring-4 ring-orange-500/20 scale-125' : s < step ? 'bg-orange-500/60' : 'bg-slate-200'}`}
                                />
                                {s < 4 && <div className={`h-0.5 w-6 rounded-full ${s < step ? 'bg-orange-500/30' : 'bg-slate-100'}`} />}
                            </div>
                        ))}
                    </div>
                )}

                {/* Step 1: Select Order Type */}
                {step === 1 && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-heading font-black text-slate-900 mb-2">เลือกประเภทการสั่ง</h2>
                            <p className="text-slate-400 font-medium">Select your preferred service</p>
                        </div>

                        <div className="grid gap-4">
                            {Object.entries(orderTypeLabels).map(([type, info]) => (
                                <button
                                    key={type}
                                    onClick={() => { setOrderType(type); setStep(2); }}
                                    className="tasty-card p-6 text-left group hover:scale-[1.02] active:scale-95"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`w-16 h-16 rounded-[24px] ${info.color.split(' ')[0]} ${info.color.split(' ')[2]} border flex items-center justify-center text-3xl shadow-sm group-hover:shadow-md transition-all`}>
                                            {info.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-xl font-heading font-black text-slate-900 leading-tight">{info.name}</h3>
                                            <p className="text-sm text-slate-500 mt-1">{info.desc}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                            →
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Customer Info */}
                {step === 2 && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-10">
                            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-[32px] ${orderTypeLabels[orderType]?.color} border mb-4 text-4xl shadow-lg`}>
                                {orderTypeLabels[orderType]?.icon}
                            </div>
                            <h2 className="text-3xl font-heading font-black text-slate-900">{orderTypeLabels[orderType]?.name}</h2>
                            <p className="text-slate-400 font-medium mt-1">Please provide your details</p>
                        </div>

                        <div className="space-y-6">
                            <div className="tasty-card p-6 space-y-5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">ชื่อ-นามสกุลของคุณ Name</label>
                                    <input
                                        type="text"
                                        value={customerInfo.name}
                                        onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-medium text-slate-900"
                                        placeholder="Full Name"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">เบอร์โทรศัพท์ Phone Number</label>
                                    <input
                                        type="tel"
                                        value={customerInfo.phone}
                                        onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-medium text-slate-900"
                                        placeholder="08X-XXX-XXXX"
                                    />
                                </div>

                                {orderType === 'delivery' && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">ที่อยู่จัดส่ง Delivery Address</label>
                                            <textarea
                                                value={customerInfo.address}
                                                onChange={e => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-medium text-slate-900 resize-none"
                                                rows={3}
                                                placeholder="Complete address for delivery"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">📍 ปักหมุดตำแหน่ง Location Pin</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!navigator.geolocation) return alert('GPS not supported');
                                                    setIsLocating(true);
                                                    navigator.geolocation.getCurrentPosition(
                                                        (pos) => {
                                                            setCustomerInfo({ ...customerInfo, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                                                            setIsLocating(false);
                                                        },
                                                        (err) => { alert(err.message); setIsLocating(false); },
                                                        { enableHighAccuracy: true }
                                                    );
                                                }}
                                                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm mb-4 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95"
                                                disabled={isLocating}
                                            >
                                                {isLocating ? '⏳ Locating...' : '📍 ใช้ตำแหน่งปัจจุบัน Use My Location'}
                                            </button>

                                            {customerInfo.latitude && customerInfo.longitude ? (
                                                <div className="rounded-3xl overflow-hidden border-4 border-white shadow-2xl relative group" style={{ height: '180px' }}>
                                                    <iframe
                                                        title="Location Preview"
                                                        width="100%"
                                                        height="100%"
                                                        frameBorder="0"
                                                        scrolling="no"
                                                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${customerInfo.longitude - 0.005}%2C${customerInfo.latitude - 0.003}%2C${customerInfo.longitude + 0.005}%2C${customerInfo.latitude + 0.003}&layer=mapnik&marker=${customerInfo.latitude}%2C${customerInfo.longitude}`}
                                                    />
                                                    <div className="absolute top-3 right-3 px-3 py-1.5 bg-green-500 text-white text-[10px] font-black rounded-full shadow-lg">PINNED</div>
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center text-slate-400 py-10">
                                                    <div className="text-center">
                                                        <span className="text-3xl block mb-2 opacity-50">🗺️</span>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest">Map Preview Unavailable</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {orderType === 'reservation' && (
                                    <div className="pt-2 space-y-6">
                                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 italic">
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                                                <span>⚠️ System Note:</span>
                                            </p>
                                            <p className="text-xs text-amber-700 leading-relaxed">
                                                For reservations, some items may require pre-ordering to ensure availability.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">วันที่จอง Date</label>
                                                <input
                                                    type="date"
                                                    min={minDate}
                                                    value={customerInfo.reservationDate}
                                                    onChange={e => setCustomerInfo({ ...customerInfo, reservationDate: e.target.value })}
                                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-slate-900"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">เวลา Time</label>
                                                <select
                                                    value={customerInfo.reservationTime}
                                                    onChange={e => setCustomerInfo({ ...customerInfo, reservationTime: e.target.value })}
                                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-slate-900 appearance-none bg-[url('https://cdn-icons-png.flaticon.com/512/25/25618.png')] bg-[length:12px] bg-[right_20px_center] bg-no-repeat"
                                                >
                                                    <option value="">Select Time</option>
                                                    {['11:00', '12:00', '13:00', '17:00', '18:00', '19:00', '20:00'].map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">จำนวนคน Guests</label>
                                            <div className="flex items-center gap-6 bg-slate-50 p-2 rounded-3xl border border-slate-100 w-fit mx-auto">
                                                <button
                                                    onClick={() => setCustomerInfo({ ...customerInfo, guestsCount: Math.max(1, customerInfo.guestsCount - 1) })}
                                                    className="w-12 h-12 bg-white rounded-2xl shadow-sm hover:bg-orange-500 hover:text-white transition-all text-2xl font-black"
                                                >-</button>
                                                <span className="text-3xl font-heading font-black w-12 text-center text-slate-900 leading-none">{customerInfo.guestsCount}</span>
                                                <button
                                                    onClick={() => setCustomerInfo({ ...customerInfo, guestsCount: Math.min(20, customerInfo.guestsCount + 1) })}
                                                    className="w-12 h-12 bg-white rounded-2xl shadow-sm hover:bg-orange-500 hover:text-white transition-all text-2xl font-black"
                                                >+</button>
                                            </div>
                                        </div>

                                        <div className="bg-orange-50 p-5 rounded-[32px] border border-orange-100">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 pr-4">
                                                    <h4 className="font-heading font-black text-slate-900">Pre-order Food?</h4>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Save time and ensure availability</p>
                                                </div>
                                                <button
                                                    onClick={() => setCustomerInfo({ ...customerInfo, preOrderFood: !customerInfo.preOrderFood })}
                                                    className={`w-16 h-9 rounded-full transition-all relative p-1.5 ${customerInfo.preOrderFood ? 'bg-orange-500' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`w-6 h-6 bg-white rounded-full transition-all shadow-md ${customerInfo.preOrderFood ? 'translate-x-[28px]' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    if (!customerInfo.name || !customerInfo.phone) return alert('Name & Phone required');
                                    if (orderType === 'delivery' && !customerInfo.address) return alert('Address required');
                                    if (orderType === 'reservation' && (!customerInfo.reservationDate || !customerInfo.reservationTime)) return alert('Select Date & Time');

                                    if (orderType === 'reservation') loadAvailableTables();
                                    setStep(customerInfo.preOrderFood ? 3 : 4);
                                }}
                                className="w-full py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-[32px] font-heading font-black text-xl shadow-xl shadow-orange-500/30 transition-all active:scale-95"
                            >
                                Continue {customerInfo.preOrderFood ? 'to Menu →' : 'to Summary →'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2.5: Table Selection (Internal for Reservation) */}
                {step === 4 && orderType === 'reservation' && !customerInfo.assignedTable && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-heading font-black text-slate-900 mb-2">เลือกโต๊ะของคุณ</h2>
                            <p className="text-slate-400 font-medium">Select your preferred table</p>
                        </div>

                        {loadingTables ? (
                            <div className="text-center py-20 text-orange-500 font-black animate-pulse tracking-widest uppercase text-xs">🔍 Finding available tables...</div>
                        ) : availableTables.length === 0 ? (
                            <div className="tasty-card p-12 text-center border-dashed bg-rose-50/50 border-rose-200">
                                <span className="text-5xl block mb-4">😔</span>
                                <h3 className="font-heading font-black text-rose-600 text-xl">Sorry, fully booked!</h3>
                                <p className="text-slate-500 mt-2">No tables available for {customerInfo.guestsCount} guests at this time.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {availableTables.map(t => (
                                    <button
                                        key={t.name}
                                        onClick={() => setCustomerInfo({ ...customerInfo, assignedTable: t.name })}
                                        className={`tasty-card p-6 transition-all duration-300 ${customerInfo.assignedTable === t.name ? 'ring-4 ring-orange-500/20 border-orange-500 bg-orange-50/50' : 'border-slate-100 hover:border-orange-200'}`}
                                    >
                                        <div className="w-14 h-14 bg-white rounded-3xl shadow-sm flex items-center justify-center text-3xl mb-4 mx-auto border border-slate-100">🪑</div>
                                        <h3 className="font-heading font-black text-slate-800 text-lg leading-tight">{t.name}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t.seats} Seats</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        {availableTables.length > 0 && (
                            <p className="text-[10px] text-slate-400 mt-10 text-center font-bold uppercase tracking-widest opacity-50 italic">
                                * Table assignment may be subject to change by management
                            </p>
                        )}
                    </div>
                )}

                {/* Step 3: Menu Selection */}
                {step === 3 && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-heading font-black text-slate-900 mb-2">เลือกเมนูอาหาร</h2>
                            <p className="text-slate-400 font-medium">Add yummy items to your cart</p>
                        </div>

                        {/* Categories */}
                        <div className="flex gap-3 overflow-x-auto pb-5 mb-4 no-scrollbar">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-6 py-3 rounded-[24px] text-xs font-black uppercase tracking-widest transition-all duration-300 border ${selectedCategory === cat.id
                                        ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20 active:scale-95'
                                        : 'bg-white text-slate-500 border-slate-100 hover:border-orange-200'
                                        }`}
                                >
                                    {cat.icon} {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Menu Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-24">
                            {menuItems.filter(i => i.category_id === selectedCategory).map(item => {
                                const inCart = cart.find(c => c.id === item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="tasty-card p-0 overflow-hidden group hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-5xl grayscale opacity-30">🍽️</div>
                                            )}
                                            {inCart && (
                                                <div className="absolute top-3 right-3 w-10 h-10 bg-orange-500 text-white rounded-2xl flex items-center justify-center font-black shadow-xl ring-4 ring-orange-500/20 animate-bounce-subtle">
                                                    {inCart.quantity}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-heading font-black text-slate-800 text-sm leading-tight line-clamp-1">{item.name}</h3>
                                            <div className="flex items-center justify-between mt-2">
                                                <p className="text-orange-500 font-black text-base">฿{item.price?.toLocaleString()}</p>
                                                <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-all">+</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 4: Confirm Order */}
                {step === 4 && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-heading font-black text-slate-900 mb-2">สรุปรายการสั่ง</h2>
                            <p className="text-slate-400 font-medium">Review your order details</p>
                        </div>

                        {/* Order Summary Card */}
                        <div className="tasty-card p-6 mb-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-2xl ${orderTypeLabels[orderType]?.color} flex items-center justify-center text-2xl`}>
                                        {orderTypeLabels[orderType]?.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-heading font-black text-slate-900 leading-tight">{orderTypeLabels[orderType]?.name}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{orderType === 'delivery' ? 'Home Delivery' : 'Eat in / Pickup'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contact</p>
                                    <p className="font-bold text-slate-900">{customerInfo.phone}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-slate-50/80 p-3 rounded-2xl border border-slate-100/50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</span>
                                    <span className="font-bold text-slate-800">{customerInfo.name}</span>
                                </div>

                                {orderType === 'delivery' && (
                                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Shipping To</p>
                                        <p className="text-sm font-medium text-slate-600 line-clamp-2">{customerInfo.address}</p>
                                    </div>
                                )}

                                {orderType === 'reservation' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100/50">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Schedule</p>
                                            <p className="text-xs font-bold text-slate-800">{customerInfo.reservationDate} @ {customerInfo.reservationTime}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100/50">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Guests / Table</p>
                                            <p className="text-xs font-bold text-slate-800">{customerInfo.guestsCount} P / {customerInfo.assignedTable || 'Auto'}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="tasty-card p-6 mb-8 border-orange-100 bg-orange-50/30">
                            <h3 className="font-heading font-black text-slate-900 border-b border-orange-100 pb-4 mb-4 flex justify-between items-center text-lg">
                                🛒 Your Cart
                                <span className="px-3 py-1 bg-white border border-orange-200 text-orange-500 rounded-full text-[10px] uppercase font-black">{cart.length} Items</span>
                            </h3>

                            <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-orange-500 border border-slate-100">
                                                {item.quantity}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 leading-tight">{item.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">฿{item.price?.toLocaleString()} each</p>
                                            </div>
                                        </div>
                                        <p className="font-heading font-black text-slate-900 text-lg">฿{(item.price * item.quantity).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 pt-6 border-t-2 border-dashed border-orange-200 space-y-3">
                                <div className="flex justify-between text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                    <span>Subtotal</span>
                                    <span>฿{cartTotal.toLocaleString()}</span>
                                </div>
                                {orderType === 'reservation' && cart.length > 0 && customerInfo.preOrderFood && (
                                    <>
                                        <div className="flex justify-between text-rose-500 font-bold uppercase tracking-widest text-[10px]">
                                            <span>Required Deposit (50%)</span>
                                            <span>฿{(cartTotal * 0.5).toLocaleString()}</span>
                                        </div>
                                        <div className="bg-white p-5 rounded-[40px] shadow-2xl border border-slate-100 mt-6 flex flex-col items-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Pay via PromptPay QR 📱</p>
                                            <div className="p-4 bg-white border-2 border-slate-100 rounded-[32px] shadow-inner mb-4">
                                                <QRCode
                                                    value={generatePayload(shopSettings.promptpay_number || '0800000000', { amount: cartTotal * 0.5 })}
                                                    size={160}
                                                />
                                            </div>
                                            <p className="text-3xl font-heading font-black text-slate-900">฿{(cartTotal * 0.5).toLocaleString()}</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{shopSettings.promptpay_name || 'Tasty Station'}</p>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between items-center mt-2 p-4 bg-orange-500 rounded-[28px] text-white shadow-xl shadow-orange-500/30">
                                    <span className="font-heading font-black text-lg">ORDER TOTAL</span>
                                    <span className="text-3xl font-heading font-black">฿{cartTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Note */}
                        <div className="mb-8">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block px-2">หมายเหตุพิเศษ Special Requirements</label>
                            <textarea
                                value={customerInfo.note}
                                onChange={e => setCustomerInfo({ ...customerInfo, note: e.target.value })}
                                className="w-full px-5 py-4 bg-white border border-slate-100 rounded-[28px] focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-slate-900 resize-none shadow-sm"
                                rows={2}
                                placeholder="Any allergies or special requests?"
                            />
                        </div>

                        <button
                            onClick={submitOrder}
                            disabled={loading}
                            className="w-full py-5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-[40px] font-heading font-black text-2xl shadow-2xl transition-all active:scale-95"
                        >
                            {loading ? '⏳ PROCESSING...' : '✓ CONFIRM ORDER'}
                        </button>
                    </div>
                )}

                {/* Step 5: Success */}
                {step === 5 && (
                    <div className="animate-fade-in-up text-center py-20 px-4">
                        <div className="relative inline-block mb-10">
                            <div className="w-40 h-40 bg-orange-500/10 rounded-[60px] flex items-center justify-center animate-pulse">
                                <span className="text-8xl">🧡</span>
                            </div>
                            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-green-500 text-white rounded-[32px] flex items-center justify-center text-4xl shadow-2xl border-4 border-white animate-bounce-subtle">
                                ✓
                            </div>
                        </div>

                        <h2 className="text-4xl font-heading font-black text-slate-900 mb-2">สั่งอาหารสำเร็จ!</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-10">Your order has been placed successfully</p>

                        <div className="tasty-card p-10 border-orange-100 bg-white shadow-2xl mb-10 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Order Transaction ID</p>
                            <p className="text-6xl font-heading font-black text-orange-500 tracking-tighter">#{orderId}</p>
                        </div>

                        <div className="space-y-4 max-w-sm mx-auto">
                            <div className="p-5 bg-amber-50 border border-amber-100 rounded-[32px] text-left">
                                <p className="text-amber-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                                    Awaiting Confirmation
                                </p>
                                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                    The shop will review your order shortly. We'll contact you at <span className="font-black underline">{customerInfo.phone}</span> if needed.
                                </p>
                            </div>

                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-5 bg-slate-900 text-white rounded-[32px] font-heading font-black text-xl hover:bg-slate-800 shadow-xl transition-all active:scale-95"
                            >
                                ORDER NEW MEAL
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Cart (Step 3 only) */}
            {step === 3 && cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-[100] pb-[env(safe-area-inset-bottom,1rem)] p-4 animate-slide-up">
                    <div className="max-w-lg mx-auto bg-slate-900/95 backdrop-blur-2xl rounded-[40px] p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-5">
                                <div className="relative">
                                    <div className="w-16 h-16 bg-orange-500 rounded-[28px] flex items-center justify-center text-3xl shadow-xl shadow-orange-500/40">🛒</div>
                                    <div className="absolute -top-2 -right-2 w-7 h-7 bg-white text-orange-500 rounded-full flex items-center justify-center text-xs font-black shadow-lg ring-2 ring-slate-900/10">
                                        {cart.reduce((sum, i) => sum + i.quantity, 0)}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Total to Pay</p>
                                    <p className="text-3xl font-heading font-black text-white">฿{cartTotal.toLocaleString()}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setStep(4)}
                                className="px-10 py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-[28px] font-heading font-black text-lg transition-all active:scale-90 shadow-xl shadow-orange-500/20"
                            >
                                NEXT →
                            </button>
                        </div>

                        {/* Scrollable Items Preview */}
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                            {cart.map(item => (
                                <div key={item.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl pl-3 pr-2 py-2 shrink-0 group transition-all hover:bg-white/10">
                                    <span className="text-xs font-bold text-white/90 line-clamp-1 max-w-[80px]">{item.name}</span>
                                    <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-1">
                                        <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white transition-colors">-</button>
                                        <span className="text-xs font-black text-orange-500 w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white transition-colors">+</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Global Smooth Transitions & Custom Scroll */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
                
                body { font-family: 'Outfit', sans-serif; }
                .font-heading { font-family: 'Outfit', sans-serif; }
                
                .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-bounce-subtle { animation: bounceSubtle 2s infinite; }
                
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes bounceSubtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                .tasty-card {
                    background: white;
                    border-radius: 32px;
                    border: 1px solid rgba(241, 245, 249, 1);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .tasty-card:hover {
                    box-shadow: 0 20px 40px -15px rgba(0,0,0,0.1);
                    border-color: rgba(249, 115, 22, 0.2);
                }
            `}</style>
        </div>
    );
};

export default LineOrder;
