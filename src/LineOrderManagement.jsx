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
            setOrders(Array.isArray(data) ? data : []);
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
            setSettings(data);
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
        setAppliedCoupon(null);
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
                body: JSON.stringify({ paymentMethod })
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

    // Calculate change
    const calculateChange = () => {
        const received = parseFloat(cashReceived) || 0;
        const total = selectedOrder?.total_amount || 0;
        return Math.max(0, received - total);
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
                    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
                        <div className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        {orderTypeConfig[selectedOrder.order_type]?.icon}
                                        ออเดอร์ #{selectedOrder.id}
                                    </h3>
                                    <p className="text-sm text-slate-400">{orderTypeConfig[selectedOrder.order_type]?.label}</p>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">✕</button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                                {/* Status */}
                                <div className={`p-3 rounded-lg ${statusConfig[selectedOrder.status]?.color}/20 border border-${statusConfig[selectedOrder.status]?.color}/30 flex items-center gap-2`}>
                                    <span className="text-2xl">{statusConfig[selectedOrder.status]?.icon}</span>
                                    <span className="font-bold text-white">{statusConfig[selectedOrder.status]?.label}</span>
                                </div>

                                {/* Customer Info */}
                                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <h4 className="font-bold text-slate-300 text-xs uppercase tracking-widest mb-3">ข้อมูลลูกค้า</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-white">
                                            <span className="text-orange-400">👤</span>
                                            <span className="font-bold">{selectedOrder.customer_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <span className="text-orange-400">📞</span>
                                            <a href={`tel:${selectedOrder.customer_phone}`} className="hover:text-orange-400 transition-colors">{selectedOrder.customer_phone || '-'}</a>
                                        </div>
                                        {selectedOrder.customer_address && (
                                            <div className="flex items-start gap-2 text-slate-300">
                                                <span className="text-orange-400">📍</span>
                                                <span className="text-sm">{selectedOrder.customer_address}</span>
                                            </div>
                                        )}
                                    </div>
                                    {selectedOrder.order_type === 'reservation' && (
                                        <div className="mt-3 pt-3 border-t border-white/10">
                                            <div className="flex items-center gap-2 text-purple-400 font-bold mb-3">
                                                <span>📅</span>
                                                <span>{new Date(selectedOrder.reservation_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-slate-400">•</span>
                                                <span>⏰ {selectedOrder.reservation_time}</span>
                                                <span className="text-slate-400">•</span>
                                                <span>👥 {selectedOrder.guests_count} คน</span>
                                            </div>

                                            {/* Table Assignment */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">เลือกโต๊ะที่จอง</label>
                                                <select
                                                    value={selectedOrder.assigned_table || ''}
                                                    onChange={(e) => assignTable(selectedOrder.id, e.target.value)}
                                                    className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-white/10 focus:border-orange-500 transition-colors"
                                                >
                                                    <option value="">-- ยังไม่เลือกโต๊ะ --</option>
                                                    {['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'VIP-01'].map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Deposit Info */}
                                {selectedOrder.deposit_amount > 0 && (
                                    <div className={`p-3 rounded-lg flex justify-between items-center ${selectedOrder.is_deposit_paid ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                        <div>
                                            <p className="text-xs text-slate-400">เงินมัดจำ (50%)</p>
                                            <p className={`font-bold ${selectedOrder.is_deposit_paid ? 'text-emerald-400' : 'text-red-400'}`}>
                                                ฿{parseFloat(selectedOrder.deposit_amount).toLocaleString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => toggleDeposit(selectedOrder.id, selectedOrder.is_deposit_paid)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition ${selectedOrder.is_deposit_paid ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                        >
                                            {selectedOrder.is_deposit_paid ? '✅ จ่ายแล้ว' : '⏳ ยังไม่จ่าย'}
                                        </button>
                                    </div>
                                )}

                                {/* Items */}
                                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <h4 className="font-bold text-slate-300 text-xs uppercase tracking-widest mb-3">รายการอาหาร</h4>
                                    <div className="space-y-2">
                                        {selectedOrder.items?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-white items-center py-1.5 border-b border-white/5 last:border-0">
                                                <span className="font-medium">{item.quantity}x <span className="text-orange-400">{item.product_name || item.name || 'ไม่ระบุชื่อ'}</span></span>
                                                <span className="font-bold text-emerald-400">฿{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-white/10 mt-3 pt-3 flex justify-between text-lg font-bold">
                                        <span className="text-white">รวม</span>
                                        <span className="text-emerald-400 text-xl">฿{selectedOrder.total_amount?.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Note */}
                                {selectedOrder.note && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                        <p className="text-sm text-yellow-400">📝 หมายเหตุ: {selectedOrder.note}</p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Actions */}
                            <div className="p-4 border-t border-white/10 flex gap-2 flex-wrap">
                                {selectedOrder.status === 'pending' && (
                                    <>
                                        <button onClick={() => updateStatus(selectedOrder.id, 'confirm')} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white transition">
                                            ✓ ยืนยันรับออเดอร์
                                        </button>
                                        <button onClick={() => updateStatus(selectedOrder.id, 'cancel')} className="py-3 px-4 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white transition">
                                            ยกเลิก
                                        </button>
                                    </>
                                )}
                                {selectedOrder.status === 'confirmed' && (
                                    <button onClick={() => updateStatus(selectedOrder.id, 'preparing')} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-bold text-white transition">
                                        🍳 เริ่มเตรียม
                                    </button>
                                )}
                                {selectedOrder.status === 'preparing' && (
                                    <button onClick={() => updateStatus(selectedOrder.id, 'ready')} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-white transition">
                                        ✅ พร้อมแล้ว
                                    </button>
                                )}
                                {selectedOrder.status === 'ready' && (
                                    <button onClick={() => handleOpenPayment(selectedOrder)} className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white transition">
                                        💰 เก็บเงิน
                                    </button>
                                )}
                                {selectedOrder.order_type === 'reservation' && ['confirmed', 'preparing'].includes(selectedOrder.status) && (
                                    <button onClick={() => handleCheckIn(selectedOrder.id)} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold text-white transition">
                                        🏨 เช็คอิน (Check-in)
                                    </button>
                                )}
                                {!['completed', 'cancelled'].includes(selectedOrder.status) && (
                                    <button onClick={() => setSelectedOrder(null)} className="py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-white transition">
                                        ปิด
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Modal */}
                {showPaymentModal && selectedOrder && (
                    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-4 border-b bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    💰 ชำระเงิน - #{selectedOrder.id}
                                </h3>
                                <p className="text-sm opacity-80">{selectedOrder.customer_name}</p>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-6">
                                {/* Total */}
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 mb-1">ยอดที่ต้องชำระ</p>
                                    <p className="text-4xl font-black text-gray-800">
                                        ฿{(selectedOrder.total_amount - (appliedCoupon ? (parseInt(appliedCoupon.title.match(/-฿(\d+)/)?.[1]) || 0) : 0)).toLocaleString()}
                                    </p>
                                    {appliedCoupon && (
                                        <p className="text-xs text-green-600 font-bold mt-1">
                                            (หักส่วนลดคูปองแล้ว -฿{parseInt(appliedCoupon.title.match(/-฿(\d+)/)?.[1]) || 0})
                                        </p>
                                    )}
                                </div>

                                {/* Coupon Section */}
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-3">Loyalty Coupon</p>
                                    {appliedCoupon ? (
                                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-orange-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-xl">💎</div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800">{appliedCoupon.title}</p>
                                                    <p className="text-[9px] text-orange-500 font-bold tracking-widest">{appliedCoupon.coupon_code}</p>
                                                </div>
                                            </div>
                                            <button onClick={removeCoupon} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                    placeholder="กรอกรหัสคูปอง..."
                                                    className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none uppercase font-bold tracking-widest"
                                                />
                                                <button
                                                    onClick={handleVerifyCoupon}
                                                    disabled={isVerifyingCoupon || !couponCode}
                                                    className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-all uppercase tracking-widest"
                                                >
                                                    {isVerifyingCoupon ? '...' : 'Verify'}
                                                </button>
                                            </div>
                                            {couponError && <p className="text-[10px] text-red-500 font-bold pl-2">⚠️ {couponError}</p>}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Method Selection */}
                                <div className="space-y-3">
                                    <p className="font-bold text-gray-700">เลือกวิธีชำระ</p>
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`w-full py-3 px-4 rounded-xl flex items-center gap-3 transition-all ${paymentMethod === 'cash' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        <span className="text-xl">💵</span> เงินสด (Cash)
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('transfer')}
                                        className={`w-full py-3 px-4 rounded-xl flex items-center gap-3 transition-all ${paymentMethod === 'transfer' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        <span className="text-xl">📱</span> QR / PromptPay
                                    </button>
                                </div>

                                {/* Cash Input */}
                                {paymentMethod === 'cash' && (
                                    <div className="bg-gray-50 p-4 rounded-xl">
                                        <label className="block text-gray-700 font-bold mb-2">รับเงินมา (บาท)</label>
                                        <input
                                            type="number"
                                            value={cashReceived}
                                            onChange={e => setCashReceived(e.target.value)}
                                            className="w-full text-2xl font-bold text-center p-3 rounded-xl border-2 border-green-400 focus:ring-4 focus:ring-green-200 outline-none"
                                            placeholder="0.00"
                                        />
                                        {cashReceived && (
                                            <div className="mt-3 flex justify-between items-center bg-white p-3 rounded-xl border">
                                                <span className="text-lg font-bold text-gray-600">เงินทอน</span>
                                                <span className={`text-2xl font-bold ${calculateChange() >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    ฿{calculateChange().toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* QR Code */}
                                {paymentMethod === 'transfer' && settings.promptpay_number && (
                                    <div className="flex flex-col items-center">
                                        <div className="bg-white p-3 rounded-xl shadow-lg border-2 border-blue-100">
                                            <QRCode
                                                value={generatePayload(settings.promptpay_number, { amount: Number(selectedOrder.total_amount) })}
                                                size={220}
                                            />
                                        </div>
                                        <p className="mt-3 text-sm text-gray-500">สแกนเพื่อชำระ ฿{selectedOrder.total_amount?.toLocaleString()}</p>
                                        <p className="text-xs text-blue-600">{settings.promptpay_number}</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold text-gray-700 transition"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleConfirmPayment}
                                    disabled={paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < selectedOrder.total_amount}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white transition ${paymentMethod === 'cash' && (parseFloat(cashReceived) || 0) < selectedOrder.total_amount ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
                                >
                                    ✅ ยืนยันชำระเงิน
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
