import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MasterLayout from './layouts/MasterLayout';
import { io } from 'socket.io-client';
import { api } from './services/api';
import generatePayload from 'promptpay-qr';
import QRCode from 'react-qr-code';

const LineOrderManagement = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: 'pending', type: 'all' });
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, transfer
    const [cashReceived, setCashReceived] = useState('');
    const [settings, setSettings] = useState({});

    // Loyalty Coupon State
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [isVerifyingCoupon, setIsVerifyingCoupon] = useState(false);
    const [couponError, setCouponError] = useState('');

    // Load Orders
    const loadOrders = async () => {
        try {
            // We fetch all orders and filter in frontend for better UX (instant filter)
            // and to keep stats counts accurate.
            const res = await fetch(`/api/line_orders`);
            const data = await res.json();
            // Map DB columns to frontend structure
            const mappedOrders = (Array.isArray(data) ? data : []).map(o => ({
                ...o,
                applied_coupon: o.coupon_details || (o.coupon_code ? { coupon_code: o.coupon_code, title: 'Coupon Applied' } : null)
            }));
            setOrders(mappedOrders);
        } catch (err) {
            console.error('Failed to load LINE orders:', err);
            setOrders([]);
        }
        setLoading(false);
    };

    // Load Settings for Payment (PromptPay)
    const loadSettings = async () => {
        try {
            const data = await api.getSettings();
            // Handle both Array (DB rows) and Object formats
            let settingsObj = {};
            if (Array.isArray(data)) {
                data.forEach(item => {
                    settingsObj[item.key] = item.value;
                });
            } else {
                settingsObj = data || {};
            }
            setSettings(settingsObj);
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    };

    useEffect(() => {
        loadOrders();
        loadSettings();
    }, []); // Only load on mount, refresh via button or filter change if needed (but filter is frontend now)

    // Socket.io for Real-time
    useEffect(() => {
        const socket = io();

        socket.on('new-line-order', (data) => {
            console.log('New LINE Order:', data);
            loadOrders();
            // Play notification sound
            const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-bell-notification-933.mp3');
            audio.play().catch(() => { });
        });

        socket.on('line-order-update', () => {
            loadOrders();
        });

        return () => socket.disconnect();
    }, []);

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
        setCouponCode('');
        // Initialize with existing applied coupon if present
        setAppliedCoupon(order.applied_coupon || null);
        setCouponError('');
    };

    const handleVerifyCoupon = async () => {
        if (!couponCode) return;
        setIsVerifyingCoupon(true);
        setCouponError('');
        try {
            const res = await api.verifyCoupon(couponCode);
            if (res.error) {
                setCouponError(res.error);
                setAppliedCoupon(null);
            } else {
                setAppliedCoupon(res);
                setCouponCode('');
            }
        } catch (err) {
            setCouponError('ไม่สามารถตรวจสอบคูปองได้');
        } finally {
            setIsVerifyingCoupon(false);
        }
    };

    const removeCoupon = () => {
        setAppliedCoupon(null);
        setCouponError('');
    };

    // Confirm Payment
    const handleConfirmPayment = async () => {
        try {
            const res = await fetch(`/api/line-orders/${selectedOrder.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod, paidAmount: finalAmount })
            });
            const data = await res.json();
            if (data.success) {
                // If coupon applied, mark it as used
                if (appliedCoupon) {
                    try {
                        await api.useCoupon(appliedCoupon.coupon_code, null, selectedOrder.id);
                    } catch (e) {
                        console.error("Failed to mark coupon as used:", e);
                    }
                }
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

    // Update Deposit Status
    const toggleDeposit = async (orderId, currentStatus) => {
        try {
            await fetch(`/api/line-orders/${orderId}/toggle-deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPaid: !currentStatus })
            });
            loadOrders();
            // Update local selectedOrder if modal is open
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder({ ...selectedOrder, is_deposit_paid: !currentStatus });
            }
        } catch (err) {
            alert('Failed to update deposit status');
        }
    };

    // Assign Table
    const assignTable = async (orderId, tableName) => {
        try {
            await fetch(`/api/line-orders/${orderId}/assign-table`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableName })
            });
            loadOrders();
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder({ ...selectedOrder, assigned_table: tableName });
            }
        } catch (err) {
            alert('Failed to assign table');
        }
    };

    // Check-in
    const handleCheckIn = async (orderId) => {
        if (!window.confirm('ยืนยันการเปิดโต๊ะ (Check-in) ใช่หรือไม่?')) return;
        try {
            const res = await fetch(`/api/line-orders/${orderId}/check-in`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`✅ เปิดโต๊ะ ${data.tableName} เรียบร้อย!`);
                setSelectedOrder(null);
                loadOrders();
                // Navigate to the POS page of that table
                navigate(`/order/${data.tableName}`);
            } else {
                alert('เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('ไม่สามารถ Check-in ได้');
        }
    };

    // Calculate Discount Amount
    const getCouponDiscount = () => {
        if (!appliedCoupon) return 0;

        // First: Check if coupon has explicit discount_amount property
        if (appliedCoupon.discount_amount && parseFloat(appliedCoupon.discount_amount) > 0) {
            return parseFloat(appliedCoupon.discount_amount);
        }

        // Try multiple patterns to extract discount value
        const title = appliedCoupon.title || '';
        const patterns = [
            /ราคา\s*(\d+)\s*\.?-?/i,  // "ราคา 35.-" or "ราคา 35"
            /-฿(\d+)/,        // "-฿50"
            /-(\d+)\s*บาท/,   // "-50 บาท"
            /(\d+)\s*บาท/,    // "50 บาท"
            /ลด\s*(\d+)/,     // "ลด 50"
            /฿(\d+)/,         // "฿50"
        ];
        for (const p of patterns) {
            const match = title.match(p);
            if (match) return parseInt(match[1]);
        }

        // Fallback: use LAST number in title (not first, to avoid matching "1 แก้ว")
        const allNumbers = title.match(/(\d+)/g);
        if (allNumbers && allNumbers.length > 0) {
            return parseInt(allNumbers[allNumbers.length - 1]);
        }

        return 0;
    };

    const finalAmount = Math.max(0, (selectedOrder?.total_amount || 0) - getCouponDiscount());

    // Calculate change
    const calculateChange = () => {
        const received = parseFloat(cashReceived) || 0;
        return Math.max(0, received - finalAmount);
    };

    // Status Config
    const statusConfig = {
        pending: { color: 'bg-yellow-500', label: 'รอยืนยัน', icon: '⏳' },
        confirmed: { color: 'bg-blue-500', label: 'ยืนยันแล้ว', icon: '✓' },
        preparing: { color: 'bg-orange-500', label: 'กำลังเตรียม', icon: '🍳' },
        ready: { color: 'bg-emerald-500', label: 'พร้อมแล้ว', icon: '✅' },
        completed: { color: 'bg-slate-500', label: 'เสร็จสิ้น', icon: '📦' },
        cancelled: { color: 'bg-red-500', label: 'ยกเลิก', icon: '❌' }
    };

    const orderTypeConfig = {
        reservation: { icon: '🪑', label: 'จองโต๊ะ', color: 'text-purple-400' },
        delivery: { icon: '🚚', label: 'Delivery', color: 'text-blue-400' },
        pickup: { icon: '🛍️', label: 'รับเอง', color: 'text-emerald-400' }
    };

    // Derived Data: Filtered Orders
    const filteredOrders = orders.filter(order => {
        const statusMatch = filter.status === 'all' || order.status === filter.status;
        const typeMatch = filter.type === 'all' || order.order_type === filter.type;
        return statusMatch && typeMatch;
    });

    // Count by status (Always from the full list)
    const countByStatus = (status) => orders.filter(o => o.status === status).length;

    return (
        <MasterLayout>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-heading">Order Line</h1>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Incoming LINE & Delivery Requests</p>
                </div>

                {/* Status Pills (Category Filters) */}
                <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                    {[
                        { id: 'all', label: 'All', count: orders.length, color: 'bg-[#00A099]' },
                        { id: 'pending', label: 'Wait List', count: countByStatus('pending'), color: 'bg-[#f97316]' },
                        { id: 'confirmed', label: 'Preparing', count: countByStatus('confirmed'), color: 'bg-blue-500' },
                        { id: 'preparing', label: 'In Kitchen', count: countByStatus('preparing'), color: 'bg-indigo-500' },
                        { id: 'ready', label: 'Served', count: countByStatus('ready'), color: 'bg-[#00A099]' }
                    ].map(stat => (
                        <button
                            key={stat.id}
                            onClick={() => setFilter({ ...filter, status: stat.id === 'all' ? 'all' : stat.id })}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all border ${filter.status === stat.id ? 'bg-white border-orange-200 shadow-md text-slate-900' : 'bg-transparent border-transparent text-slate-400 hover:bg-white/50'}`}
                        >
                            <span className="text-[11px] font-bold uppercase tracking-widest">{stat.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${stat.color}`}>{stat.count}</span>
                        </button>
                    ))}
                </div>

                {/* Orders Grid (Tasty Cards) */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">กำลังโหลด...</div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 italic text-slate-300">
                        <span className="text-6xl block mb-4">📭</span>
                        <p className="font-bold uppercase tracking-widest text-xs">No orders found</p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredOrders.map(order => {
                            // Map existing status to Tasty theme colors
                            const theme = {
                                pending: { bg: 'bg-[#FFE1E1]', border: 'border-[#FFC5C5]', text: 'text-red-600', badge: 'bg-red-500', label: 'Wait List' },
                                confirmed: { bg: 'bg-[#E1F2FF]', border: 'border-[#C5E4FF]', text: 'text-blue-600', badge: 'bg-blue-500', label: 'Confirmed' },
                                preparing: { bg: 'bg-[#D6EFEF]', border: 'border-[#B5E1E1]', text: 'text-[#00A099]', badge: 'bg-[#00A099]', label: 'In Kitchen' },
                                ready: { bg: 'bg-[#E9FFD6]', border: 'border-[#CDFFA1]', text: 'text-green-600', badge: 'bg-green-500', label: 'Ready' },
                                completed: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-500', label: 'Completed' },
                                cancelled: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', badge: 'bg-rose-500', label: 'Cancelled' }
                            }[order.status] || { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-900', badge: 'bg-slate-400', label: 'Unknown' };

                            return (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`${theme.bg} ${theme.border} p-6 rounded-[24px] border border-2 relative overflow-hidden cursor-pointer hover:scale-[1.03] transition-all shadow-sm group`}
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Order #FO0{order.id}</p>
                                            <h3 className="text-lg font-black text-slate-900 font-heading">
                                                {order.assigned_table ? `Table ${order.assigned_table}` : 'Take Away'}
                                            </h3>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-lg">
                                            {orderTypeConfig[order.order_type]?.icon}
                                        </div>
                                    </div>

                                    <div className="space-y-1 mb-6">
                                        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                                            Item: {order.items?.reduce((sum, i) => sum + i.quantity, 0) || '0'}X
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 line-clamp-1">
                                            👤 {order.customer_name}
                                        </p>
                                        {order.applied_coupon && (
                                            <p className="text-[10px] font-bold text-purple-500 flex items-center gap-1 mt-1">
                                                <span>🎁</span> {order.applied_coupon.coupon_code}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center mt-auto">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className={`px-4 py-1.5 ${theme.badge} text-white rounded-full text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-black/5`}>
                                            {theme.label}
                                        </span>
                                    </div>

                                    {/* Action Hint on Hover */}
                                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="p-3 bg-white rounded-2xl shadow-xl text-slate-900 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                                            <span>⚡</span> Open Details
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}


                {/* Order Detail Modal */}
                {selectedOrder && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedOrder(null)}>
                        <div className="bg-[#0B0F19]/90 backdrop-blur-2xl rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-hidden border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent">
                                <div>
                                    <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-[0.3em] mb-1">Incoming Reservation</p>
                                    <h3 className="text-2xl font-black text-white flex items-center gap-3 font-heading">
                                        <span className="filter drop-shadow-lg">{orderTypeConfig[selectedOrder.order_type]?.icon}</span>
                                        ออเดอร์ #{selectedOrder.id}
                                    </h3>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-all">✕</button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh] hide-scrollbar">
                                {/* Status */}
                                <div className={`p-4 rounded-[20px] bg-gradient-to-r from-white/5 to-transparent border border-white/10 flex items-center justify-between group`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl ${statusConfig[selectedOrder.status]?.color} flex items-center justify-center text-2xl shadow-lg shadow-black/20`}>
                                            {statusConfig[selectedOrder.status]?.icon}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                                            <p className="font-bold text-white text-lg">{statusConfig[selectedOrder.status]?.label}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time</p>
                                        <p className="text-xs font-bold text-slate-300">{new Date(selectedOrder.created_at).toLocaleTimeString()}</p>
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div className="bg-white/[0.03] backdrop-blur-sm rounded-[24px] p-6 border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <span className="text-6xl text-white italic font-black">INFO</span>
                                    </div>
                                    <h4 className="font-bold text-amber-500/60 text-[10px] uppercase tracking-[0.2em] mb-4">Customer Details</h4>
                                    <div className="grid gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">👤</div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Name</p>
                                                <p className="font-bold text-white">{selectedOrder.customer_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">📞</div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Phone</p>
                                                <a href={`tel:${selectedOrder.customer_phone}`} className="font-bold text-white hover:text-amber-400 transition-colors uppercase">{selectedOrder.customer_phone || '-'}</a>
                                            </div>
                                        </div>
                                        {selectedOrder.customer_address && (
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">📍</div>
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Address</p>
                                                    <p className="text-sm text-slate-300 leading-relaxed">{selectedOrder.customer_address}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {selectedOrder.order_type === 'reservation' && (
                                        <div className="mt-6 pt-6 border-t border-white/5">
                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                <div className="bg-purple-500/10 p-3 rounded-2xl border border-purple-500/20">
                                                    <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Date</p>
                                                    <p className="text-sm font-bold text-white">🗓️ {new Date(selectedOrder.reservation_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</p>
                                                </div>
                                                <div className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
                                                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Time</p>
                                                    <p className="text-sm font-bold text-white">⏰ {selectedOrder.reservation_time}</p>
                                                </div>
                                            </div>

                                            {/* Table Assignment */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Assign Table</label>
                                                <select
                                                    value={selectedOrder.assigned_table || ''}
                                                    onChange={(e) => assignTable(selectedOrder.id, e.target.value)}
                                                    className="w-full bg-white/5 text-white rounded-2xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-amber-500 focus:bg-white/10 transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="" className="bg-slate-900">-- Select Table --</option>
                                                    {['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'VIP-01'].map(t => (
                                                        <option key={t} value={t} className="bg-slate-900">{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Deposit Info */}
                                {selectedOrder.deposit_amount > 0 && (
                                    <div className={`p-4 rounded-[20px] flex justify-between items-center transition-all ${selectedOrder.is_deposit_paid ? 'bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-rose-500/10 border border-rose-500/20 animate-pulse'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${selectedOrder.is_deposit_paid ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>💰</div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Deposit Amount</p>
                                                <p className={`font-black tracking-tight ${selectedOrder.is_deposit_paid ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    ฿{parseFloat(selectedOrder.deposit_amount).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleDeposit(selectedOrder.id, selectedOrder.is_deposit_paid)}
                                            className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${selectedOrder.is_deposit_paid ? 'bg-white/5 text-emerald-400 border border-emerald-500/20' : 'bg-white text-slate-900 shadow-xl'}`}
                                        >
                                            {selectedOrder.is_deposit_paid ? 'Paid' : 'Unpaid'}
                                        </button>
                                    </div>
                                )}

                                {/* Items */}
                                <div className="bg-white/[0.03] backdrop-blur-sm rounded-[24px] p-6 border border-white/5">
                                    <h4 className="font-bold text-amber-500/60 text-[10px] uppercase tracking-[0.2em] mb-4">Ordered Items</h4>
                                    <div className="space-y-4">
                                        {selectedOrder.items?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-xl px-2 -mx-2">
                                                <div className="flex gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-xs text-white border border-white/10 group-hover:border-amber-500/50">
                                                        {item.quantity}x
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-sm">{item.product_name || item.name || 'Unknown'}</p>
                                                        {item.options && item.options.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {item.options.map((o, oIdx) => (
                                                                    <span key={oIdx} className="text-[9px] font-bold bg-white/5 text-amber-500/80 px-2 py-0.5 rounded-full border border-white/5">
                                                                        {o.name || o.option_name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="font-black text-white text-sm">฿{((item.unitPrice || item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 pt-6 border-t-2 border-dashed border-white/10 flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grand Total</p>
                                            <p className="text-xs text-slate-400 italic">Vat included (If applicable)</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-3xl font-black text-white drop-shadow-glow tracking-tighter">
                                                ฿{selectedOrder.total_amount?.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Coupon Info Block */}
                                {selectedOrder.applied_coupon && (
                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-[24px] p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-purple-500/20">🎁</div>
                                            <div>
                                                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-0.5">Applied Coupon</p>
                                                <p className="font-bold text-white text-sm">{selectedOrder.applied_coupon.title}</p>
                                                <p className="text-[10px] text-white/50">{selectedOrder.applied_coupon.description}</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-purple-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">{selectedOrder.applied_coupon.coupon_code}</span>
                                    </div>
                                )}

                                {/* Note */}
                                {selectedOrder.note && (
                                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3">
                                        <span className="text-xl">📝</span>
                                        <div>
                                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Customer Remark</p>
                                            <p className="text-sm text-amber-200/80 italic">{selectedOrder.note}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Actions */}
                            <div className="p-6 border-t border-white/5 bg-black/20 flex gap-3 flex-wrap">
                                {selectedOrder.status === 'pending' && (
                                    <>
                                        <button onClick={() => updateStatus(selectedOrder.id, 'confirm')} className="flex-1 py-4 bg-white text-slate-900 hover:bg-amber-400 transition-all rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-white/5">
                                            ✓ Confirm Order
                                        </button>
                                        <button onClick={() => updateStatus(selectedOrder.id, 'cancel')} className="py-4 px-6 bg-rose-600/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all rounded-2xl font-black text-[11px] uppercase tracking-widest">
                                            Decline
                                        </button>
                                    </>
                                )}
                                {selectedOrder.status === 'confirmed' && (
                                    <button onClick={() => updateStatus(selectedOrder.id, 'preparing')} className="flex-1 py-4 bg-indigo-600 text-white hover:bg-indigo-500 transition-all rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-500/20">
                                        🍳 Send to Kitchen
                                    </button>
                                )}
                                {selectedOrder.status === 'preparing' && (
                                    <button onClick={() => updateStatus(selectedOrder.id, 'ready')} className="flex-1 py-4 bg-[#00A099] text-white hover:bg-[#008a83] transition-all rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-[#00A099]/20">
                                        ✅ Mark as Ready
                                    </button>
                                )}
                                {selectedOrder.status === 'ready' && (
                                    <button onClick={() => handleOpenPayment(selectedOrder)} className="flex-1 py-4 bg-emerald-600 text-white hover:bg-emerald-500 transition-all rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 underline-offset-4 decoration-white/30 decoration-dashed">
                                        💰 Collect Payment
                                    </button>
                                )}
                                {selectedOrder.order_type === 'reservation' && ['confirmed', 'preparing'].includes(selectedOrder.status) && (
                                    <button onClick={() => handleCheckIn(selectedOrder.id)} className="flex-1 py-4 bg-purple-600 text-white hover:bg-purple-500 transition-all rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-purple-500/20">
                                        🏨 Check-in Table
                                    </button>
                                )}
                                {!['completed', 'cancelled'].includes(selectedOrder.status) && (
                                    <button onClick={() => setSelectedOrder(null)} className="py-4 px-6 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all rounded-2xl font-black text-[11px] uppercase tracking-widest">
                                        Dismiss
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Modal */}
                {showPaymentModal && selectedOrder && (
                    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowPaymentModal(false)}>
                        <div className="bg-[#0B0F19] rounded-[32px] w-full max-w-md max-h-[95vh] overflow-hidden shadow-2xl border border-white/10 animate-in slide-in-from-bottom-10 duration-500" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-emerald-600/20 to-transparent">
                                <div className="flex justify-between items-center text-white">
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] mb-1">POS Checkout</p>
                                        <h3 className="text-xl font-black font-heading">ชำระเงิน #{selectedOrder.id}</h3>
                                    </div>
                                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-2xl border border-white/10">💰</div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] hide-scrollbar">
                                {/* Total */}
                                <div className="text-center relative">
                                    <div className="absolute inset-0 bg-amber-500/10 blur-3xl rounded-full opacity-30"></div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 relative z-10">Amount to Pay</p>
                                    <p className="text-5xl font-black text-white relative z-10 tracking-tighter drop-shadow-glow">
                                        ฿{finalAmount.toLocaleString()}
                                    </p>
                                    {appliedCoupon && (
                                        <div className="mt-4 relative z-10">
                                            {getCouponDiscount() > 0 ? (
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                                    <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Discount applied: -฿{getCouponDiscount()}</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
                                                    <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">🎁 {appliedCoupon.title}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Coupon Section */}
                                <div className="bg-white/[0.03] p-5 rounded-[24px] border border-white/5">
                                    <p className="text-[9px] font-bold text-amber-500/60 uppercase tracking-[0.2em] mb-4">Loyalty & Rewards</p>
                                    {appliedCoupon ? (
                                        <div className="flex items-center justify-between bg-white/[0.05] p-4 rounded-2xl border border-white/10 shadow-lg">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 text-xl shadow-inner">💎</div>
                                                <div>
                                                    <p className="text-xs font-bold text-white mb-0.5">{appliedCoupon.title}</p>
                                                    <p className="text-[10px] text-amber-500/70 font-black tracking-[0.2em] uppercase">{appliedCoupon.coupon_code}</p>
                                                </div>
                                            </div>
                                            <button onClick={removeCoupon} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all">✕</button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                    placeholder="Enter Code..."
                                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:border-amber-500 focus:bg-white/10 outline-none uppercase font-black tracking-widest transition-all"
                                                />
                                                <button
                                                    onClick={handleVerifyCoupon}
                                                    disabled={isVerifyingCoupon || !couponCode}
                                                    className="px-6 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black hover:bg-amber-400 disabled:opacity-30 transition-all uppercase tracking-widest shadow-xl shadow-white/5"
                                                >
                                                    {isVerifyingCoupon ? '...' : 'Verify'}
                                                </button>
                                            </div>
                                            {couponError && <p className="text-[10px] text-rose-500 font-bold pl-2 flex items-center gap-1"><span>⚠️</span> {couponError}</p>}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Method Selection */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`py-4 px-4 rounded-2xl flex flex-col items-center gap-2 border transition-all ${paymentMethod === 'cash' ? 'bg-white border-white text-slate-900 shadow-xl' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}
                                    >
                                        <span className="text-2xl">💵</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Cash</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('transfer')}
                                        className={`py-4 px-4 rounded-2xl flex flex-col items-center gap-2 border transition-all ${paymentMethod === 'transfer' ? 'bg-white border-white text-slate-900 shadow-xl' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}
                                    >
                                        <span className="text-2xl">📱</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">PromptPay</span>
                                    </button>
                                </div>

                                {/* Cash Input */}
                                {paymentMethod === 'cash' && (
                                    <div className="bg-white/[0.03] p-6 rounded-[32px] border border-white/10 space-y-4 animate-in slide-in-from-top-4 duration-300">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 text-center">Amount Received</label>
                                            <input
                                                type="number"
                                                value={cashReceived}
                                                onChange={e => setCashReceived(e.target.value)}
                                                className="w-full text-4xl font-black text-center bg-transparent border-b-2 border-amber-500/30 text-white focus:border-amber-500 outline-none pb-4 transition-all"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        {cashReceived && (
                                            <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Change Due</span>
                                                <span className={`text-2xl font-black ${calculateChange() >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                                    ฿{calculateChange().toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* QR Code */}
                                {paymentMethod === 'transfer' && (
                                    settings.promptpay_number ? (
                                        <div className="flex flex-col items-center">
                                            <div className="bg-white p-4 rounded-[32px] shadow-xl border-4 border-white mb-4">
                                                <QRCode
                                                    value={generatePayload(String(settings.promptpay_number), { amount: Number(finalAmount) })}
                                                    size={200}
                                                    level="M"
                                                    bgColor="#FFFFFF"
                                                    fgColor="#000000"
                                                />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-emerald-400 tracking-[0.2em] uppercase mb-1">Scan to Pay</p>
                                                <p className="text-3xl font-black text-white tracking-tighter">฿{finalAmount.toLocaleString()}</p>
                                                <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1 opacity-70">{settings.promptpay_number}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full p-8 bg-rose-500/10 border border-rose-500/20 rounded-[24px] flex flex-col items-center justify-center text-center animate-pulse">
                                            <span className="text-3xl mb-2">⚠️</span>
                                            <p className="text-sm font-bold text-rose-400 uppercase tracking-widest">Setup Required</p>
                                            <p className="text-[10px] text-rose-300/70 mt-1">Please add PromptPay Number in Settings</p>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/5 bg-black/20 flex gap-4">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-[11px] text-slate-500 hover:text-white transition-all uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmPayment}
                                    disabled={paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < finalAmount}
                                    className={`flex-1 py-4 rounded-2xl font-black text-[11px] text-slate-900 transition-all uppercase tracking-widest shadow-xl ${paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < finalAmount ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50' : 'bg-white hover:bg-amber-400 shadow-white/5'}`}
                                >
                                    ✅ Confirm Payment
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MasterLayout>
    );
};

export default LineOrderManagement;
