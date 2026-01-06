import { useState, useEffect, useCallback } from 'react';
import MasterLayout from './layouts/MasterLayout';
import { io } from 'socket.io-client';
import { api } from './services/api';
import generatePayload from 'promptpay-qr';
import QRCode from 'react-qr-code';

const DeliveryOrderManagement = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: 'pending' });
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [settings, setSettings] = useState({});

    // Load Orders
    const loadOrders = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (filter.status !== 'all') params.append('status', filter.status);

            const res = await fetch(`/api/delivery-orders?${params}`);
            const data = await res.json();
            // Safety check: ensure data is an array
            setOrders(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load delivery orders:', err);
            setOrders([]);
        }
        setLoading(false);
    }, [filter.status]);

    // Load Settings for Payment (PromptPay)
    const loadSettings = useCallback(async () => {
        try {
            const data = await api.getSettings();
            setSettings(data);
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }, []);

    useEffect(() => {
        loadOrders();
        loadSettings();
    }, [loadOrders, loadSettings]);

    // Socket.io for Real-time
    useEffect(() => {
        const socket = io();

        socket.on('new-delivery-order', (data) => {
            console.log('New Delivery Order:', data);
            loadOrders();
            playNotificationSound();
        });

        socket.on('delivery-order-update', () => {
            loadOrders();
        });

        socket.on('line-order-update', () => {
            loadOrders();
        });

        return () => socket.disconnect();
    }, [loadOrders]);

    const playNotificationSound = () => {
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-bell-notification-933.mp3');
        audio.play().catch(() => { });
    };

    // Status Actions
    const updateStatus = async (orderId, action) => {
        try {
            await fetch(`/api/line-orders/${orderId}/${action}`, { method: 'POST' });
            loadOrders();
            setSelectedOrder(null);
        } catch (err) {
            alert('Failed to update order');
        }
    };

    // Open Payment Modal
    const handleOpenPayment = (order) => {
        setSelectedOrder(order);
        setShowPaymentModal(true);
        setPaymentMethod('cash');
        setCashReceived('');
    };

    // Confirm Payment
    const handleConfirmPayment = async () => {
        try {
            const res = await fetch(`/api/line-orders/${selectedOrder.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ ชำระเงินเรียบร้อย!');
                setShowPaymentModal(false);
                setSelectedOrder(null);
                loadOrders();
            } else {
                alert('เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('ไม่สามารถชำระเงินได้');
        }
    };

    // Calculate change
    const calculateChange = () => {
        const received = parseFloat(cashReceived) || 0;
        const total = selectedOrder?.total_amount || 0;
        return Math.max(0, received - total);
    };

    // Open Google Maps with address
    const openGoogleMaps = (order) => {
        if (order.latitude && order.longitude) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank');
        } else if (order.delivery_address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`, '_blank');
        }
    };

    // Status Config with new delivery statuses
    const statusConfig = {
        pending: { color: 'bg-yellow-500', label: 'รอยืนยัน', icon: '⏳' },
        confirmed: { color: 'bg-blue-500', label: 'ยืนยันแล้ว', icon: '✓' },
        preparing: { color: 'bg-orange-500', label: 'กำลังเตรียม', icon: '🍳' },
        ready: { color: 'bg-emerald-500', label: 'รอ Rider รับ', icon: '📦' },
        picked_up: { color: 'bg-purple-500', label: 'Rider รับแล้ว', icon: '🏍️' },
        delivering: { color: 'bg-cyan-500', label: 'กำลังจัดส่ง', icon: '🚚' },
        delivered: { color: 'bg-green-500', label: 'ส่งถึงแล้ว', icon: '📍' },
        completed: { color: 'bg-slate-500', label: 'เสร็จสิ้น', icon: '✅' },
        cancelled: { color: 'bg-red-500', label: 'ยกเลิก', icon: '❌' }
    };

    // Count by status
    const countByStatus = (status) => orders.filter(o => o.status === status).length;

    return (
        <MasterLayout>
            <div className="space-y-10 pb-20">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">รายการจัดส่ง <span className="text-orange-500">Logistics</span></h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Delivery Management • Rider Tracking</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={loadOrders}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </header>

                {/* Stats Logic Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { status: 'pending', count: countByStatus('pending'), color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
                        { status: 'preparing', count: countByStatus('preparing'), color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
                        { status: 'ready', count: countByStatus('ready'), color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                        { status: 'delivering', count: countByStatus('picked_up') + countByStatus('delivering'), color: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-100' },
                        { status: 'delivered', count: countByStatus('delivered'), color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100' }
                    ].map(stat => (
                        <button
                            key={stat.status}
                            onClick={() => setFilter({ ...filter, status: filter.status === stat.status ? 'all' : stat.status })}
                            className={`tasty-card ${stat.bg} ${stat.border} ${filter.status === stat.status ? 'ring-2 ring-orange-500/50 scale-105' : 'hover:scale-105'} transition-all text-left p-5`}
                        >
                            <div className={`text-3xl font-bold font-heading ${stat.color}`}>{stat.count}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {statusConfig[stat.status]?.label}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Filter & View mode */}
                <div className="flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Filter:</span>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {['all', 'pending', 'ready', 'delivering'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setFilter({ ...filter, status: s })}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filter.status === s ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Orders Grid */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400 font-bold animate-pulse uppercase tracking-widest">Scanning Dispatch...</div>
                ) : orders.length === 0 ? (
                    <div className="tasty-card border-dashed bg-slate-50/50 py-24 flex flex-col items-center justify-center">
                        <span className="text-6xl mb-6 opacity-20">🛵</span>
                        <p className="text-slate-400 font-bold uppercase tracking-widest">Operational silence in this zone</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {orders.map(order => (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="tasty-card p-0 overflow-hidden group cursor-pointer border-slate-200/60 hover:border-orange-200 hover:shadow-2xl hover:shadow-orange-500/5 transition-all"
                            >
                                {/* Order Status Strip */}
                                <div className={`h-1 w-full ${statusConfig[order.status]?.color}`}></div>

                                <div className="p-6 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-lg border-b-2 border-orange-500">
                                                📦
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 text-lg font-heading">Order #{order.id}</div>
                                                <div className="text-[9px] font-bold text-orange-400 uppercase tracking-tighter bg-orange-50 px-2 py-0.5 rounded-full inline-block">
                                                    {statusConfig[order.status]?.label}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time Elapsed</div>
                                            <div className="text-xs font-bold text-slate-600">
                                                {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Brief */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-white shadow-sm">
                                                {order.customer_name?.[0] || '?'}
                                            </div>
                                            <div className="font-bold text-slate-800 text-sm truncate">{order.customer_name || 'Anonymous Guest'}</div>
                                        </div>

                                        {(order.delivery_address || order.customer_address) && (
                                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-start gap-2 group-hover:bg-orange-50/50 group-hover:border-orange-100 transition-colors">
                                                <span className="text-sm">📍</span>
                                                <span className="text-[11px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
                                                    {order.delivery_address || order.customer_address}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Transaction Info */}
                                    <div className="flex justify-between items-end pt-4 border-t border-slate-50">
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Total Valuation</div>
                                            <div className="text-2xl font-bold font-heading text-slate-900">
                                                ฿{order.total_amount?.toLocaleString()}
                                            </div>
                                        </div>
                                        {order.latitude && order.longitude && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openGoogleMaps(order); }}
                                                className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-200 shadow-sm transition-all"
                                            >
                                                🗺️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Order Detail Modal - Modernized */}
            {selectedOrder && !showPaymentModal && (
                <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-[40px] w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
                        {/* Header Image/Pattern */}
                        <div className="h-32 bg-slate-900 relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent"></div>
                            <div className="absolute -bottom-10 left-8">
                                <div className="w-20 h-20 bg-white rounded-[24px] shadow-xl flex items-center justify-center text-3xl border-4 border-white">
                                    🚚
                                </div>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">✕</button>
                        </div>

                        <div className="pt-14 p-10 space-y-8 overflow-y-auto max-h-[calc(90vh-128px)]">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-3xl font-bold text-slate-900 font-heading">Order #{selectedOrder.id}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        Received {new Date(selectedOrder.created_at).toLocaleTimeString('th-TH')}
                                    </p>
                                </div>
                                <div className={`px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-white shadow-lg ${statusConfig[selectedOrder.status]?.color}`}>
                                    {statusConfig[selectedOrder.status]?.label}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1">Client Prospect</div>
                                    <div className="space-y-2">
                                        <div className="font-bold text-slate-800">{selectedOrder.customer_name}</div>
                                        <div className="text-xs text-orange-500 font-bold">{selectedOrder.contact_number || selectedOrder.customer_phone}</div>
                                        <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-2xl">
                                            {selectedOrder.delivery_address || 'No address specified'}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1">Line Items</div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {selectedOrder.items?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-[11px] font-bold text-slate-600">
                                                <span>{item.quantity}x {item.product_name || item.name}</span>
                                                <span className="text-slate-400">฿{(item.price * item.quantity).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-lg font-bold font-heading">
                                        <span className="text-slate-900">Total</span>
                                        <span className="text-orange-500">฿{selectedOrder.total_amount?.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedOrder.note && (
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 italic">
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1 opacity-60">System Notification</p>
                                    <p className="text-xs text-amber-700 font-medium">&quot;{selectedOrder.note}&quot;</p>
                                </div>
                            )}

                            {/* Actions Group */}
                            <div className="pt-6 flex gap-3 flex-wrap">
                                {selectedOrder.status === 'pending' && (
                                    <>
                                        <button onClick={() => updateStatus(selectedOrder.id, 'confirm')} className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95">
                                            ✓ Confirm Order
                                        </button>
                                        <button onClick={() => updateStatus(selectedOrder.id, 'cancel')} className="py-4 px-8 bg-slate-100 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest transition-all">
                                            Void
                                        </button>
                                    </>
                                )}
                                {selectedOrder.status === 'confirmed' && (
                                    <button onClick={() => updateStatus(selectedOrder.id, 'preparing')} className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                                        🍳 Start Kitchen Production
                                    </button>
                                )}
                                {selectedOrder.status === 'delivered' && (
                                    <button onClick={() => handleOpenPayment(selectedOrder)} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
                                        💰 Secure Payment / Finish
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedOrder && (
                <div className="fixed inset-0 backdrop-blur-sm bg-slate-900/40 z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPaymentModal(false)}>
                    <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
                        <div className="text-center w-full mb-8">
                            <h3 className="text-3xl font-bold text-slate-900 font-heading">Payment Portal</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Order #{selectedOrder.id}</p>
                        </div>
                        <div className="space-y-8">
                            <div className="text-center py-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</div>
                                <div className="text-5xl font-bold font-heading text-slate-900">฿{selectedOrder.total_amount?.toLocaleString()}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest transition-all ${paymentMethod === 'cash' ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
                                >
                                    💵 Cash
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('transfer')}
                                    className={`py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest transition-all ${paymentMethod === 'transfer' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
                                >
                                    📱 Transfer
                                </button>
                            </div>
                            {paymentMethod === 'cash' && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Received Amount</label>
                                        <input
                                            type="number"
                                            value={cashReceived}
                                            onChange={e => setCashReceived(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold text-slate-900 text-3xl text-center transition-all"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {cashReceived && (
                                        <div className="p-4 bg-emerald-50 rounded-2xl flex justify-between items-center text-emerald-600">
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Change Return</span>
                                            <span className="text-2xl font-bold">฿{calculateChange().toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {paymentMethod === 'transfer' && (
                                <div className="flex flex-col items-center gap-4">
                                    {settings.promptpay_number ? (
                                        <>
                                            <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
                                                <QRCode value={generatePayload(settings.promptpay_number, { amount: parseFloat(selectedOrder.total_amount) || 0 })} size={160} />
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PromptPay Number</div>
                                                <div className="text-lg font-bold text-slate-900">{settings.promptpay_number}</div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-4 bg-rose-50 rounded-2xl text-rose-500 text-xs font-bold text-center">PromptPay not configured.</div>
                                    )}
                                </div>
                            )}
                            <div className="flex gap-3 pt-6">
                                <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Back</button>
                                <button
                                    onClick={handleConfirmPayment}
                                    disabled={paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < selectedOrder.total_amount}
                                    className={`flex-1 py-4 rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-lg ${paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < selectedOrder.total_amount ? 'bg-slate-100 text-slate-300' : 'bg-orange-500 text-white'}`}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MasterLayout>
    );
};


export default DeliveryOrderManagement;
