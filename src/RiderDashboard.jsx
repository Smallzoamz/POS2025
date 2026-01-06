import { useState, useEffect, useRef, useCallback } from 'react';
import MasterLayout from './layouts/MasterLayout';
import { socket, api } from './services/api';
import { useAuth } from './contexts/AuthContext';
import generatePayload from 'promptpay-qr';
import QRCode from 'react-qr-code';

const RiderDashboard = () => {
    const { user } = useAuth();
    const [pendingOrders, setPendingOrders] = useState([]);
    const [myDeliveries, setMyDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending'); // pending, my
    const [currentLocation, setCurrentLocation] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [settings, setSettings] = useState({});
    const updateIntervalRef = useRef(null);

    // Load orders
    const loadOrders = useCallback(async () => {
        try {
            const [pendingRes, myRes] = await Promise.all([
                fetch('/api/delivery-orders/pending-pickup'),
                fetch(`/api/delivery-orders/my-deliveries/${user?.id}`)
            ]);
            setPendingOrders(await pendingRes.json());
            setMyDeliveries(await myRes.json());
        } catch (err) {
            console.error('Failed to load orders:', err);
        }
        setLoading(false);
    }, [user?.id]);

    // Load Settings (for PromptPay)
    const loadSettings = useCallback(async () => {
        try {
            const data = await api.getSettings();
            setSettings(data);
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }, []);

    useEffect(() => {
        if (user?.id) {
            loadOrders();
            loadSettings();
        }
    }, [user?.id, loadOrders, loadSettings]);

    // Socket for real-time updates
    useEffect(() => {
        const handleUpdate = () => loadOrders();
        const handleNewOrder = () => {
            loadOrders();
            const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-bell-notification-933.mp3');
            audio.play().catch(() => { });
        };

        socket.on('delivery-order-update', handleUpdate);
        socket.on('new-delivery-order', handleNewOrder);

        return () => {
            socket.off('delivery-order-update', handleUpdate);
            socket.off('new-delivery-order', handleNewOrder);
        };
    }, [loadOrders]);

    // Cleanup GPS tracking on unmount
    useEffect(() => {
        return () => {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
            }
        };
    }, []);

    // Update rider location to server
    const updateRiderLocation = async (orderId, lat, lng) => {
        try {
            await fetch(`/api/delivery-orders/${orderId}/rider-location`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng })
            });
        } catch (err) {
            console.error('Failed to update location:', err);
        }
    };

    // Start GPS tracking every 10 seconds
    const startGPSTracking = (orderId) => {
        if (!navigator.geolocation) {
            alert('Browser ไม่รองรับ GPS');
            return;
        }

        setIsTracking(true);
        const gpsOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 };

        // Initial update
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                updateRiderLocation(orderId, pos.coords.latitude, pos.coords.longitude);
            },
            (err) => console.warn('GPS Error:', err.message),
            gpsOptions
        );

        // Periodic updates
        updateIntervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    updateRiderLocation(orderId, pos.coords.latitude, pos.coords.longitude);
                },
                (err) => console.warn('GPS update skipped:', err.message),
                gpsOptions
            );
        }, 10000);
    };

    // Pick up order
    const handlePickup = async (orderId) => {
        if (!confirm('ยืนยันรับงานส่งนี้?')) return;
        try {
            const res = await fetch(`/api/delivery-orders/${orderId}/pickup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ riderId: user.id })
            });
            if ((await res.json()).success) {
                loadOrders();
                setActiveTab('my');
            }
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาด');
        }
    };

    // Start delivery
    const handleStartDelivery = async (order) => {
        if (!confirm('ยืนยันเริ่มจัดส่ง?')) return;
        try {
            const res = await fetch(`/api/delivery-orders/${order.id}/start-delivery`, { method: 'POST' });
            if ((await res.json()).success) {
                startGPSTracking(order.id);
                loadOrders();
            }
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาด');
        }
    };

    // Mark as delivered
    const handleDelivered = (order) => {
        setSelectedOrderForPayment(order);
        setShowPaymentModal(true);
        setPaymentMethod('cash');
        setCashReceived('');
    };

    // Confirm Payment & Complete Order
    const handleConfirmPayment = async () => {
        if (!selectedOrderForPayment) return;
        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
        }
        setIsTracking(false);

        try {
            const res = await fetch(`/api/delivery-orders/${selectedOrderForPayment.id}/delivered`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod })
            });
            if ((await res.json()).success) {
                setShowPaymentModal(false);
                setSelectedOrderForPayment(null);
                loadOrders();
            }
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาด');
        }
    };

    const calculateChange = () => {
        const received = parseFloat(cashReceived) || 0;
        const total = selectedOrderForPayment?.total_amount || 0;
        return Math.max(0, received - total);
    };

    const openNavigation = (order) => {
        const dest = order.latitude && order.longitude
            ? `${order.latitude},${order.longitude}`
            : encodeURIComponent(order.delivery_address || '');
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`, '_blank');
    };

    const statusConfig = {
        ready: { color: 'text-amber-500 bg-amber-50 border-amber-100', label: 'รอรับภารกิจ', icon: '📦' },
        picked_up: { color: 'text-purple-500 bg-purple-50 border-purple-100', label: 'รับออเดอร์แล้ว', icon: '🏍️' },
        delivering: { color: 'text-cyan-500 bg-cyan-50 border-cyan-100', label: 'กำลังบึ่งรถส่ง', icon: '🚚' },
        delivered: { color: 'text-green-500 bg-green-50 border-green-100', label: 'ส่งสำเร็จ', icon: '📍' }
    };

    if (loading) {
        return (
            <MasterLayout>
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="font-heading font-black text-slate-400 text-xs uppercase tracking-widest">Rider system loading...</p>
                </div>
            </MasterLayout>
        );
    }

    return (
        <MasterLayout>
            <div className="p-4 md:p-8 bg-slate-50 min-h-screen pb-32">
                {/* Header */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-heading font-black text-slate-900 leading-tight">
                            Rider <span className="text-orange-500">Logistics</span>
                        </h1>
                        <p className="text-slate-500 font-medium">
                            ยินดีต้อนรับกลับมาค่ะคุณ <span className="text-slate-900 font-black">{user?.name || 'Rider'}</span>
                            {isTracking && <span className="ml-3 px-3 py-1 bg-green-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">📍 GPS Tracking Live</span>}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-200/50 p-2 rounded-[32px] mb-8 max-w-lg">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 py-4 rounded-[24px] font-heading font-black text-sm transition-all duration-300 ${activeTab === 'pending' ? 'bg-white text-orange-500 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        📦 งานเปิดรับ ({pendingOrders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('my')}
                        className={`flex-1 py-4 rounded-[24px] font-heading font-black text-sm transition-all duration-300 ${activeTab === 'my' ? 'bg-white text-orange-500 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        🏍️ งานของฉัน ({myDeliveries.length})
                    </button>
                </div>

                {/* Content */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
                    {activeTab === 'pending' ? (
                        pendingOrders.length === 0 ? (
                            <div className="col-span-full py-32 text-center opacity-50 grayscale">
                                <span className="text-8xl block mb-6">☕</span>
                                <p className="text-xl font-heading font-black text-slate-400 uppercase tracking-widest">ยังไม่มีออเดอร์เข้าค่ะ พักผ่อนก่อนได้นะคะ</p>
                            </div>
                        ) : (
                            pendingOrders.map(order => (
                                <div key={order.id} className="tasty-card p-0 group">
                                    <div className="p-6 border-b border-slate-50 flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black tracking-widest">#{order.id}</span>
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusConfig[order.status]?.color}`}>
                                                    {statusConfig[order.status]?.label}
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-heading font-black text-slate-800 leading-tight line-clamp-1">{order.customer_name}</h3>
                                            <p className="text-sm font-bold text-slate-400 mt-0.5">📞 {order.contact_number}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-heading font-black text-orange-500 tracking-tighter">฿{order.total_amount?.toLocaleString()}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{order.items?.length} ITEMS</p>
                                        </div>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-2"><span>📍</span> SHIPPING ADDRESS</p>
                                            <p className="text-sm font-bold text-slate-600 leading-relaxed line-clamp-2">{order.delivery_address}</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <a
                                                href={`tel:${order.contact_number || order.customer_phone}`}
                                                className="flex-1 py-4 bg-white border-2 border-slate-100 hover:border-green-200 rounded-2xl font-heading font-black text-sm text-slate-500 hover:text-green-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                📞 โทรหา
                                            </a>
                                            <button
                                                onClick={() => openNavigation(order)}
                                                className="flex-1 py-4 bg-white border-2 border-slate-100 hover:border-orange-200 rounded-2xl font-heading font-black text-sm text-slate-500 hover:text-orange-500 transition-all active:scale-95"
                                            >
                                                🗺️ แผนที่
                                            </button>
                                            <button
                                                onClick={() => handlePickup(order.id)}
                                                className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-heading font-black text-sm shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                                            >
                                                ✓ รับงาน
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        myDeliveries.length === 0 ? (
                            <div className="col-span-full py-32 text-center opacity-50 grayscale">
                                <span className="text-8xl block mb-6">📭</span>
                                <p className="text-xl font-heading font-black text-slate-400 uppercase tracking-widest">ยังไม่มีงานที่รับไว้เลยค่ะ</p>
                                <button onClick={() => setActiveTab('pending')} className="mt-8 px-10 py-4 bg-orange-500 text-white rounded-full font-black shadow-xl shadow-orange-500/30 active:scale-95 transition-all">ไปหางานกันเถอะ!</button>
                            </div>
                        ) : (
                            myDeliveries.map(order => (
                                <div key={order.id} className={`tasty-card p-0 transition-all duration-500 ${order.status === 'delivering' ? 'ring-4 ring-orange-500/20 border-orange-500' : ''}`}>
                                    <div className={`p-6 border-b border-slate-100 flex justify-between items-start ${order.status === 'delivering' ? 'bg-orange-50/50' : 'bg-slate-50/30'}`}>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black tracking-widest">#{order.id}</span>
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusConfig[order.status]?.color} bg-white shadow-sm`}>
                                                    {statusConfig[order.status]?.icon} {statusConfig[order.status]?.label}
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-heading font-black text-slate-800 leading-tight">{order.customer_name}</h3>
                                            <p className="text-sm font-black text-slate-400 mt-0.5">📞 {order.contact_number}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-heading font-black text-orange-500 tracking-tighter">฿{order.total_amount?.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-5">
                                        <div className="p-4 bg-white border border-slate-100 rounded-3xl space-y-3 shadow-sm">
                                            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📍 Destination</p>
                                                <button onClick={() => openNavigation(order)} className="text-[10px] font-black text-orange-500 bg-orange-50 px-3 py-1 rounded-full hover:bg-orange-100">GO MAPS</button>
                                            </div>
                                            <p className="text-sm font-bold text-slate-600 leading-relaxed">{order.delivery_address}</p>
                                        </div>

                                        <div className="bg-slate-50/50 p-4 rounded-3xl border border-dashed border-slate-200">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Order Details</p>
                                            <div className="space-y-2">
                                                {order.items?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs">
                                                        <span className="font-bold text-slate-600">{item.quantity}x {item.product_name || item.name}</span>
                                                        <span className="font-black text-slate-800">฿{(item.price * item.quantity).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {order.status === 'delivering' && currentLocation && (
                                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-2xl border border-green-100">
                                                <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-green-500/20">📡</div>
                                                <div>
                                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Live GPS Signal</p>
                                                    <p className="text-[10px] font-bold text-slate-500">{currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-3 pt-2">
                                            <a
                                                href={`tel:${order.contact_number || order.customer_phone}`}
                                                className="flex-1 py-4 bg-white border-2 border-slate-100 hover:border-green-200 rounded-2xl font-heading font-black text-sm text-slate-500 hover:text-green-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                📞 โทรหาลูกค้า
                                            </a>
                                            {order.status === 'picked_up' && (
                                                <button
                                                    onClick={() => handleStartDelivery(order)}
                                                    className="flex-[2] py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-heading font-black text-lg shadow-xl shadow-orange-500/20 transition-all active:scale-95"
                                                >
                                                    🚚 เริ่มจัดส่ง
                                                </button>
                                            )}

                                            {order.status === 'delivering' && (
                                                <button
                                                    onClick={() => handleDelivered(order)}
                                                    className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-heading font-black text-lg shadow-xl shadow-green-600/20 transition-all active:scale-95"
                                                >
                                                    ✅ ส่งสำเร็จ
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* Floating Refresh */}
                <button
                    onClick={loadOrders}
                    className="fixed bottom-10 right-10 w-20 h-20 bg-white text-slate-900 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-slate-100 flex items-center justify-center text-4xl hover:scale-110 active:scale-90 transition-all z-[60]"
                >
                    🔄
                </button>

                {/* Payment Modal */}
                {showPaymentModal && selectedOrderForPayment && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowPaymentModal(false)}>
                        <div className="bg-white rounded-[50px] w-full max-w-lg overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] animate-fade-in-up" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-8 pb-4 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">COMPLETE DELIVERY</p>
                                <h3 className="text-4xl font-heading font-black text-slate-900 leading-tight">
                                    ฿{selectedOrderForPayment.total_amount?.toLocaleString()}
                                </h3>
                                <p className="text-slate-500 font-bold mt-1">ออเดอร์ของ {selectedOrderForPayment.customer_name}</p>
                            </div>

                            <div className="p-8 space-y-8">
                                {/* Payment Tabs */}
                                <div className="flex bg-slate-100 p-2 rounded-[28px]">
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`flex-1 py-4 rounded-[22px] font-heading font-black text-sm transition-all ${paymentMethod === 'cash' ? 'bg-white text-green-600 shadow-xl' : 'text-slate-400'}`}
                                    >
                                        💵 เงินสด
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('transfer')}
                                        className={`flex-1 py-4 rounded-[22px] font-heading font-black text-sm transition-all ${paymentMethod === 'transfer' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400'}`}
                                    >
                                        📱 โอนจ่าย
                                    </button>
                                </div>

                                {paymentMethod === 'cash' && (
                                    <div className="space-y-4">
                                        <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">ยอดเงินที่ได้รับจากลูกค้า</label>
                                            <input
                                                type="number"
                                                value={cashReceived}
                                                onChange={e => setCashReceived(e.target.value)}
                                                className="w-full text-5xl font-heading font-black text-center bg-transparent outline-none text-slate-900 placeholder-slate-200"
                                                placeholder="0.00"
                                                inputMode="decimal"
                                            />
                                        </div>
                                        {cashReceived && (
                                            <div className="flex justify-between items-center px-8 py-5 bg-green-50 rounded-3xl border border-green-100">
                                                <span className="text-sm font-black text-green-600 uppercase tracking-widest">เงินทอน (Change)</span>
                                                <span className={`text-3xl font-heading font-black ${calculateChange() >= 0 ? 'text-green-600' : 'text-rose-500'}`}>
                                                    ฿{calculateChange().toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {paymentMethod === 'transfer' && (
                                    <div className="flex flex-col items-center">
                                        {settings.promptpay_number ? (
                                            <>
                                                <div className="p-6 bg-white rounded-[44px] shadow-2xl border-2 border-slate-50 mb-6">
                                                    <QRCode
                                                        value={generatePayload(settings.promptpay_number, { amount: parseFloat(selectedOrderForPayment.total_amount) || 0 })}
                                                        size={220}
                                                    />
                                                </div>
                                                <p className="text-2xl font-heading font-black text-slate-900 tracking-tighter">฿{selectedOrderForPayment.total_amount?.toLocaleString()}</p>
                                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">PromptPay: {settings.promptpay_number}</p>
                                            </>
                                        ) : (
                                            <div className="p-10 bg-rose-50 rounded-[40px] border border-rose-100 text-center">
                                                <p className="text-6xl mb-4">⚠️</p>
                                                <p className="text-rose-600 font-black uppercase tracking-widest text-xs">Error: QR Settings Missing</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-8 bg-slate-50 flex gap-4">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 py-6 bg-white border border-slate-200 rounded-[32px] font-heading font-black text-slate-400 hover:text-slate-600 transition-all"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleConfirmPayment}
                                    disabled={paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < selectedOrderForPayment.total_amount}
                                    className={`flex-1 py-6 rounded-[32px] font-heading font-black text-white shadow-2xl transition-all ${paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < selectedOrderForPayment.total_amount ? 'bg-slate-300' : 'bg-slate-900 hover:bg-black shadow-slate-900/30'}`}
                                >
                                    ยืนยันส่งสำเร็จ ✓
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
                
                .font-heading { font-family: 'Outfit', sans-serif; }
                
                .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                
                .tasty-card {
                    background: white;
                    border-radius: 40px;
                    border: 1px solid rgba(241, 245, 249, 1);
                    box-shadow: 0 15px 45px -15px rgba(0,0,0,0.06);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    overflow: hidden;
                }
                .tasty-card:hover {
                    box-shadow: 0 40px 80px -25px rgba(0,0,0,0.1);
                    border-color: rgba(249, 115, 22, 0.1);
                    transform: translateY(-8px);
                }
            `}</style>
        </MasterLayout>
    );
};

export default RiderDashboard;
