import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import generatePayload from 'promptpay-qr';
import QRCode from 'react-qr-code';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom Rider Icon (blue motorcycle) - Themed
const getRiderIcon = (type) => {
    let icon = '🏍️';
    if (type === 'car') icon = '🚗';
    if (type === 'bicycle') icon = '🚲';

    return new L.DivIcon({
        className: 'custom-rider-marker',
        html: `<div style="background: linear-gradient(135deg, #f97316, #fb923c); width: 44px; height: 44px; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 8px 16px rgba(249, 115, 22, 0.4); border: 3px solid white;">${icon}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
    });
};

// Custom Customer Icon (green pin) - Themed
const customerIcon = new L.DivIcon({
    className: 'custom-customer-marker',
    html: `<div style="background: linear-gradient(135deg, #334155, #475569); width: 44px; height: 44px; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 8px 16px rgba(51, 65, 85, 0.4); border: 3px solid white;">📍</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
});

// Component to auto-fit bounds
const FitBounds = ({ riderPos, customerPos }) => {
    const map = useMap();
    useEffect(() => {
        if (riderPos && customerPos) {
            const bounds = L.latLngBounds([riderPos, customerPos]);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (riderPos) {
            map.setView(riderPos, 15);
        } else if (customerPos) {
            map.setView(customerPos, 15);
        }
    }, [riderPos, customerPos, map]);
    return null;
};

const CustomerTracking = () => {
    const { token } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [settings, setSettings] = useState({});
    const [showQR, setShowQR] = useState(false);

    // Socket URL
    const isVite = window.location.port === '5173';
    const SOCKET_URL = isVite
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : window.location.origin;

    // Load order data
    const loadOrder = async () => {
        try {
            const res = await fetch(`/api/public/tracking/${token}`);
            if (!res.ok) {
                setError('ไม่พบออเดอร์');
                setLoading(false);
                return;
            }
            const data = await res.json();
            setOrder(data);
        } catch (err) {
            console.error('Failed to load order:', err);
            setError('ไม่สามารถโหลดข้อมูลได้');
        }
        setLoading(false);
    };

    // Load shop settings for QR
    const loadSettings = async () => {
        try {
            const res = await fetch('/api/public/settings');
            setSettings(await res.json());
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    };

    useEffect(() => {
        loadOrder();
        loadSettings();
    }, [token]);

    // Real-time updates via Socket
    useEffect(() => {
        const socketConnection = io(SOCKET_URL);

        socketConnection.on('delivery-order-update', (data) => {
            if (data.orderId === order?.id) {
                loadOrder();
            }
        });

        socketConnection.on('rider-location-update', (data) => {
            if (data.orderId === order?.id) {
                setOrder(prev => ({ ...prev, rider_lat: data.lat, rider_lng: data.lng }));
            }
        });

        return () => socketConnection.disconnect();
    }, [order?.id]);

    // Status timeline configuration
    const statusSteps = [
        { key: 'pending', icon: '⏳', label: 'รอยืนยัน' },
        { key: 'confirmed', icon: '✓', label: 'ยืนยัน' },
        { key: 'preparing', icon: '🍳', label: 'เตรียม' },
        { key: 'ready', icon: '📦', label: 'พร้อม' },
        { key: 'picked_up', icon: '🏍️', label: 'รับแล้ว' },
        { key: 'delivering', icon: '🚚', label: 'กำลังส่ง' },
        { key: 'delivered', icon: '📍', label: 'ถึงแล้ว' },
        { key: 'completed', icon: '✅', label: 'เสร็จ' }
    ];

    const getStatusIndex = (status) => statusSteps.findIndex(s => s.key === status);
    const currentStatusIndex = order ? getStatusIndex(order.status) : -1;

    // Map positions
    const riderPos = (order?.rider_lat && order?.rider_lng) ? [parseFloat(order.rider_lat), parseFloat(order.rider_lng)] : null;
    const customerPos = (order?.latitude && order?.longitude) ? [parseFloat(order.latitude), parseFloat(order.longitude)] : null;
    const defaultCenter = riderPos || customerPos || [13.7563, 100.5018]; // Bangkok default

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-heading font-black text-slate-400 uppercase tracking-widest text-xs">Loading Order Info...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-32 h-32 bg-rose-50 rounded-[40px] flex items-center justify-center text-6xl mb-6 shadow-sm border border-rose-100">🚫</div>
                <h1 className="text-3xl font-heading font-black text-slate-900 mb-2">{error || 'ไม่พบออเดอร์'}</h1>
                <p className="text-slate-400 font-medium mb-8">The link might be expired or incorrect.</p>
                <button onClick={() => window.location.reload()} className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-black shadow-xl active:scale-95 transition-all">TRY REFRESH</button>
            </div>
        );
    }

    const showMap = ['picked_up', 'delivering'].includes(order.status) && (riderPos || customerPos);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
            {/* Header */}
            <div className="sticky top-0 z-[1000] bg-white/80 backdrop-blur-xl border-b border-slate-100 px-5 py-5">
                <div className="max-w-lg mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-heading font-black text-slate-900 flex items-center gap-2">
                            ติดตามออเดอร์ <span className="text-orange-500">#{order.id}</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Order Tracking System</p>
                    </div>
                    <div className="px-4 py-2 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/30 animate-bounce-subtle">
                        {statusSteps[currentStatusIndex]?.label}
                    </div>
                </div>
            </div>

            {/* Map Section - Hero Style */}
            {showMap && (
                <div className="relative border-b border-slate-100 bg-slate-100" style={{ height: '45vh', minHeight: '320px' }}>
                    <MapContainer
                        center={defaultCenter}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                    >
                        <TileLayer
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {/* Rider Marker */}
                        {riderPos && (
                            <Marker position={riderPos} icon={getRiderIcon(order.vehicle_type)}>
                                <Popup>
                                    <div className="text-center p-2">
                                        <p className="font-heading font-black text-slate-900">{order.rider_name || 'Rider'}</p>
                                        <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-1">กำลังเดินทางไปยังคุณ</p>
                                    </div>
                                </Popup>
                            </Marker>
                        )}

                        {/* Customer Marker */}
                        {customerPos && (
                            <Marker position={customerPos} icon={customerIcon}>
                                <Popup>
                                    <div className="text-center p-2">
                                        <p className="font-heading font-black text-slate-900">Your Location</p>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">จะได้รับอาหารในไม่ช้า</p>
                                    </div>
                                </Popup>
                            </Marker>
                        )}

                        <FitBounds riderPos={riderPos} customerPos={customerPos} />
                    </MapContainer>

                    {/* Overlay: Rider Info */}
                    {order.rider_name && (
                        <div className="absolute bottom-6 left-6 right-6 z-[1000] animate-fade-in-up">
                            <div className="bg-white/90 backdrop-blur-xl rounded-[32px] p-5 border border-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1)] flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-[22px] flex items-center justify-center text-2xl shadow-xl shadow-orange-500/30">
                                    🏍️
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Delivery Partner</p>
                                    <p className="text-xl font-heading font-black text-slate-900 leading-tight">{order.rider_name}</p>
                                    {order.rider_phone && (
                                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">📞 {order.rider_phone}</p>
                                    )}
                                    {(order.vehicle_plate || order.vehicle_type) && (
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 bg-slate-50 inline-block px-1.5 py-0.5 rounded-lg border border-slate-100">
                                            {order.vehicle_plate || ''} {order.vehicle_type ? `(${order.vehicle_type === 'motorcycle' ? 'มอเตอร์ไซค์' : order.vehicle_type})` : ''}
                                        </p>
                                    )}
                                </div>
                                {order.rider_phone && (
                                    <a
                                        href={`tel:${order.rider_phone}`}
                                        className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-green-500/20 active:scale-90 transition-all"
                                    >
                                        📞
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Non-delivering status card */}
            {!showMap && (
                <div className="p-6">
                    <div className="max-w-lg mx-auto bg-white rounded-[40px] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-3 bg-orange-500" />

                        <div className="w-28 h-28 bg-orange-50 rounded-[44px] flex items-center justify-center text-6xl mx-auto mb-6 shadow-sm border border-orange-100">
                            {statusSteps[currentStatusIndex]?.icon || '📦'}
                        </div>

                        <h2 className="text-4xl font-heading font-black text-slate-900 mb-3">{statusSteps[currentStatusIndex]?.label}</h2>

                        <div className="bg-slate-50 p-4 rounded-3xl inline-block px-8 border border-slate-100 mb-10">
                            <p className="text-sm font-medium text-slate-500">
                                {order.status === 'pending' && 'รอร้านยืนยันออเดอร์ขอบคุณที่สั่งนะคะ'}
                                {order.status === 'confirmed' && 'ร้านยืนยันออเดอร์แล้ว กำลังรอเข้าคิวค่ะ'}
                                {order.status === 'preparing' && 'พ่อครัวกำลังปรุงอาหารอย่างพิถีพิถัน'}
                                {order.status === 'ready' && 'อาหารจานอร่อยของคุณเสร็จแล้ว พร้อมส่งต่อ!'}
                                {order.status === 'delivered' && 'อาหารส่งถึงที่หมายแล้ว ขอให้มีความสุขกับมื้ออาหารนะคะ'}
                                {order.status === 'completed' && 'ขอบคุณที่อุดหนุน Tasty Station ค่ะ 🧡'}
                            </p>
                        </div>

                        {/* Queue Position */}
                        {order.queue_position && ['confirmed', 'preparing'].includes(order.status) && (
                            <div className="bg-orange-500 rounded-[32px] p-6 text-center text-white shadow-xl shadow-orange-500/30">
                                <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Your Queue Position</p>
                                <p className="text-6xl font-heading font-black tracking-tighter">#{order.queue_position}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Horizontal Timeline */}
            <div className="px-6 py-10 overflow-x-auto no-scrollbar">
                <div className="max-w-lg mx-auto">
                    <div className="flex items-center justify-between min-w-[650px] relative">
                        {/* Background line */}
                        <div className="absolute top-6 left-6 right-6 h-1 bg-slate-200 rounded-full z-0" />

                        {statusSteps.slice(0, order.status === 'cancelled' ? 1 : -1).map((step, index) => {
                            const isCompleted = index <= currentStatusIndex;
                            const isCurrent = index === currentStatusIndex;

                            return (
                                <React.Fragment key={step.key}>
                                    <div className="flex flex-col items-center relative z-10 w-20">
                                        <div className={`w-12 h-12 rounded-[22px] flex items-center justify-center text-xl font-bold transition-all duration-500 border-4 border-slate-50 ${isCurrent ? 'bg-orange-500 text-white scale-125 shadow-2xl shadow-orange-500/40 ring-4 ring-orange-500/10' :
                                            isCompleted ? 'bg-orange-500/20 text-orange-600' : 'bg-white text-slate-300 shadow-sm border-slate-100'
                                            }`}>
                                            {isCompleted && !isCurrent ? '✓' : step.icon}
                                        </div>
                                        <p className={`text-[10px] mt-4 font-black uppercase tracking-widest whitespace-nowrap ${isCurrent ? 'text-orange-500' : isCompleted ? 'text-slate-400' : 'text-slate-300'}`}>
                                            {step.label}
                                        </p>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto p-6 space-y-6">
                {/* Order Details */}
                <div className="tasty-card p-8">
                    <h3 className="text-lg font-heading font-black text-slate-900 mb-6 flex items-center gap-3 border-b border-slate-50 pb-4">
                        <span className="text-2xl">🛒</span> รายการสั่งซื้อ
                    </h3>
                    <div className="space-y-4">
                        {order.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400 border border-slate-100 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                                        {item.quantity}
                                    </div>
                                    <span className="font-bold text-slate-700 leading-tight">{item.product_name || item.name}</span>
                                </div>
                                <span className="font-heading font-black text-slate-900">฿{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t-2 border-dashed border-slate-100 mt-8 pt-6 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</span>
                        <span className="text-4xl font-heading font-black text-orange-500 tracking-tighter">฿{order.total_amount?.toLocaleString()}</span>
                    </div>
                </div>

                {/* Delivery Address */}
                {(order.delivery_address || order.customer_address) && (
                    <div className="tasty-card p-8 bg-slate-900 text-white shadow-2xl">
                        <h3 className="text-lg font-heading font-black mb-4 flex items-center gap-3">
                            <span className="text-2xl">📍</span> ที่อยู่จัดส่ง
                        </h3>
                        <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                            <p className="text-slate-300 font-medium leading-relaxed">{order.delivery_address || order.customer_address}</p>
                        </div>
                    </div>
                )}

                {/* QR Payment / Delivery Instructions */}
                {settings.promptpay_number && !['completed', 'cancelled'].includes(order.status) && (
                    <div className="space-y-4">
                        {order.order_type === 'delivery' ? (
                            <div className="tasty-card p-8 bg-orange-50 border-orange-100 border-2 text-center">
                                <span className="text-4xl block mb-3">🛵</span>
                                <h3 className="font-heading font-black text-orange-600 text-xl mb-1">ชำระเงินกับไรเดอร์</h3>
                                <p className="text-slate-500 text-sm font-medium">กรุณาเตรียมเงินสดหรือสแกนจ่ายผ่าน QR <br />กับไรเดอร์เมื่ออาหารส่งถึงมือคุณค่ะ</p>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setShowQR(!showQR)}
                                    className={`w-full py-6 rounded-[32px] font-heading font-black text-xl flex items-center justify-center gap-4 transition-all shadow-xl active:scale-[0.98] ${showQR ? 'bg-white text-slate-900 border border-slate-200 shadow-sm' : 'bg-slate-900 text-white shadow-slate-900/20'
                                        }`}
                                >
                                    <span className="text-2xl">{showQR ? '👀' : '📱'}</span> {showQR ? 'ซ่อน QR ชำระเงิน' : 'แสดง QR เพื่อชำระเงิน'}
                                </button>

                                {showQR && (
                                    <div className="tasty-card p-10 text-center animate-fade-in-up border-4 border-orange-500/10">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Scan with any banking app to pay</p>
                                        <div className="inline-block p-6 bg-white rounded-[44px] shadow-2xl border border-slate-100 mb-8">
                                            <QRCode
                                                value={generatePayload(settings.promptpay_number, { amount: Number(order.total_amount) })}
                                                size={220}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-5xl font-heading font-black text-slate-900 tracking-tighter">฿{order.total_amount?.toLocaleString()}</p>
                                            <p className="text-xs text-slate-500 font-black uppercase tracking-widest">{settings.promptpay_name || 'Tasty Station'}</p>
                                            <p className="text-[10px] py-1 px-3 bg-slate-100 rounded-full inline-block font-black text-slate-400">PromptPay: {settings.promptpay_number}</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Cancelled Status */}
                {order.status === 'cancelled' && (
                    <div className="bg-rose-50 border-4 border-rose-100 rounded-[40px] p-10 text-center">
                        <div className="text-6xl mb-4">💔</div>
                        <h3 className="text-3xl font-heading font-black text-rose-600 mb-2">ออเดอร์ถูกยกเลิก</h3>
                        <p className="text-slate-500 font-medium leading-relaxed">เราต้องขออภัยอย่างสูงที่ต้องยกเลิกรายการอาหารของคุณ แอดมินจะติดต่อหาคุณในภายหลังค่ะ</p>
                    </div>
                )}
            </div>

            {/* Floating Refresh */}
            <button
                onClick={loadOrder}
                className="fixed bottom-8 right-8 w-16 h-16 bg-white text-slate-900 rounded-[28px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] flex items-center justify-center text-3xl transition-all z-[1000] border border-slate-100 hover:scale-110 active:scale-90"
            >
                🔄
            </button>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
                
                body { font-family: 'Outfit', sans-serif; background-color: #f8fafc; }
                .font-heading { font-family: 'Outfit', sans-serif; }
                
                .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-bounce-subtle { animation: bounceSubtle 2s infinite; }
                
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes bounceSubtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                .tasty-card {
                    background: white;
                    border-radius: 40px;
                    border: 1px solid rgba(241, 245, 249, 1);
                    box-shadow: 0 15px 40px -20px rgba(0,0,0,0.06);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .tasty-card:hover {
                    box-shadow: 0 30px 60px -25px rgba(0,0,0,0.12);
                    border-color: rgba(249, 115, 22, 0.1);
                }
                
                .leaflet-container {
                    border-radius: 0;
                    z-index: 10;
                }
            `}</style>
        </div>
    );
};

export default CustomerTracking;
