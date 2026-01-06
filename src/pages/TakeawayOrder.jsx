import React, { useState, useEffect } from 'react';
import { api, socket } from '../services/api';

const TakeawayOrder = () => {
    const [step, setStep] = useState(1); // 1: Customer Info, 2: Menu, 3: Confirmation
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [orderNumber, setOrderNumber] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [shopName, setShopName] = useState('Tasty Station');

    // Option Modal State
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [selectedProductForOptions, setSelectedProductForOptions] = useState(null);
    const [productOptions, setProductOptions] = useState([]);
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [optionQuantity, setOptionQuantity] = useState(1);
    const [loadingOptions, setLoadingOptions] = useState(false);

    useEffect(() => {
        loadMenu();
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await api.getPublicSettings();
            if (settings.shop_name) setShopName(settings.shop_name);
        } catch (err) {
            console.error(err);
        }
    };

    const loadMenu = async () => {
        try {
            setError(null);
            const data = await api.getPublicMenu();
            if (data && data.categories && data.products) {
                setCategories(data.categories);
                setMenuItems(data.products);
            } else {
                throw new Error('Invalid menu data received from server');
            }
        } catch (err) {
            console.error('Load Menu Error:', err);
            setError('ไม่สามารถโหลดเมนูได้ กรุณาลองใหม่อีกครั้ง');
            setCategories([]);
            setMenuItems([]);
        } finally {
            setLoading(false);
        }
    };

    // Cart Functions - Handle product with options
    const handleProductClick = async (item) => {
        if (!item.is_available) return;

        setLoadingOptions(true);
        try {
            const res = await fetch(`/api/products/${item.id}/options`);
            const options = await res.json();

            if (options && options.length > 0) {
                setSelectedProductForOptions(item);
                setProductOptions(options);
                setSelectedOptions([]);
                setOptionQuantity(1);
                setShowOptionsModal(true);
            } else {
                addToCartDirect(item, [], 1);
            }
        } catch (err) {
            console.error('Failed to load options:', err);
            addToCartDirect(item, [], 1);
        }
        setLoadingOptions(false);
    };

    const addToCartDirect = (item, options = [], qty = 1) => {
        const optionsTotal = options.reduce((sum, o) => sum + (parseFloat(o.price_modifier) || 0), 0);
        const cartKey = `${item.id}-${options.map(o => o.id).sort().join('-')}`;

        const itemWithOptions = {
            ...item,
            cartKey,
            options: options,
            unitPrice: parseFloat(item.price) + optionsTotal,
            optionsLabel: options.length > 0 ? options.map(o => o.name).join(', ') : ''
        };

        setCart(prev => {
            const existing = prev.find(i => i.cartKey === cartKey);
            if (existing) {
                return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + qty } : i);
            }
            return [...prev, { ...itemWithOptions, quantity: qty }];
        });
    };

    const confirmAddWithOptions = () => {
        if (selectedProductForOptions) {
            addToCartDirect(selectedProductForOptions, selectedOptions, optionQuantity);
            setShowOptionsModal(false);
            setSelectedProductForOptions(null);
            setProductOptions([]);
            setSelectedOptions([]);
            setOptionQuantity(1);
        }
    };

    const toggleOption = (option) => {
        setSelectedOptions(prev => {
            const exists = prev.find(o => o.id === option.id);
            if (exists) {
                return prev.filter(o => o.id !== option.id);
            }
            return [...prev, option];
        });
    };

    const updateQuantity = (cartKey, delta) => {
        setCart(prev => prev.map(item => {
            if (item.cartKey === cartKey) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
        }).filter(Boolean));
    };

    const totalAmount = cart.reduce((sum, item) => sum + ((item.unitPrice || item.price) * item.quantity), 0);

    const handleSubmitOrder = async () => {
        if (cart.length === 0) return alert('กรุณาเลือกเมนูก่อน');

        setSubmitting(true);
        try {
            const res = await fetch('/api/public/takeaway-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: customerName,
                    customer_phone: customerPhone || null,
                    items: cart.map(item => ({
                        product_id: item.id,
                        product_name: item.name,
                        price: item.price,
                        unitPrice: item.unitPrice || item.price,
                        quantity: item.quantity,
                        options: item.options || [],
                        optionsLabel: item.optionsLabel || ''
                    })),
                    total_amount: totalAmount
                })
            });
            const data = await res.json();
            if (data.success) {
                setOrderNumber(data.orderId);
                setStep(3);
                if (socket) socket.emit('order-update');
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.error || 'Unknown'));
            }
        } catch (err) {
            console.error(err);
            alert('ไม่สามารถส่งออเดอร์ได้');
        }
        setSubmitting(false);
    };

    if (loading) return (
        <div className="min-h-screen bg-[#F2F6F9] flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">กำลังโหลด...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">เกิดข้อผิดพลาด</h2>
                <p className="text-slate-500 mb-6">{error}</p>
                <button onClick={loadMenu} className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold">
                    ลองใหม่อีกครั้ง
                </button>
            </div>
        </div>
    );

    // Step 1: Customer Info
    if (step === 1) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl">🛍️</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900">{shopName}</h1>
                        <p className="text-xs text-slate-500 mt-1">สั่งกลับบ้าน (Takeaway)</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">ชื่อลูกค้า *</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-base font-medium"
                                placeholder="กรอกชื่อของคุณ"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">เบอร์โทร (ไม่บังคับ)</label>
                            <input
                                type="tel"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-base font-medium"
                                placeholder="0xx-xxx-xxxx"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            if (!customerName.trim()) return alert('กรุณากรอกชื่อ');
                            setStep(2);
                        }}
                        className="w-full mt-5 py-3.5 bg-orange-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-colors"
                    >
                        มุ่งหน้าสู่เมนู →
                    </button>
                </div>
            </div>
        );
    }

    // Step 2: Menu Selection
    if (step === 2) {
        return (
            <div className="min-h-screen bg-[#F2F6F9] flex flex-col">
                {/* Header */}
                <div className="bg-white shadow-sm p-3 sticky top-0 z-10">
                    <div className="flex items-center justify-between max-w-2xl mx-auto">
                        <button onClick={() => setStep(1)} className="text-slate-500 hover:text-orange-500 text-sm">
                            ← กลับ
                        </button>
                        <h1 className="text-base font-bold text-slate-900">🛍️ สั่งกลับบ้าน</h1>
                        <span className="text-xs text-orange-500 font-bold max-w-[80px] truncate">{customerName}</span>
                    </div>
                </div>

                {/* Categories */}
                <div className="bg-white shadow-sm px-2 py-1.5 overflow-x-auto hide-scrollbar sticky top-[52px] z-10">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${!selectedCategory ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                        >
                            🍽️ ทั้งหมด
                        </button>
                        {Array.isArray(categories) && categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                {cat.icon} {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Menu Grid */}
                <div className="flex-1 p-2 pb-32">
                    <div className="grid grid-cols-2 gap-1.5">
                        {Array.isArray(menuItems) && menuItems.filter(i => !selectedCategory || i.category_id === selectedCategory).map(item => {
                            const inCartCount = cart.filter(c => c.id === item.id).reduce((sum, c) => sum + c.quantity, 0);
                            return (
                                <div key={item.id} className={`bg-white rounded-xl p-2 shadow-sm ${loadingOptions ? 'pointer-events-none opacity-70' : ''}`}>
                                    <div className="aspect-[4/3] rounded-lg overflow-hidden mb-1.5 bg-slate-100 relative">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xl opacity-30">🍽️</div>
                                        )}
                                        {inCartCount > 0 && (
                                            <div className="absolute top-1 right-1 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow">
                                                {inCartCount}
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="text-[11px] font-bold text-slate-800 line-clamp-1 leading-tight mb-1">{item.name}</h4>
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="text-[11px] font-bold text-orange-500">฿{item.price}</span>
                                        <button
                                            onClick={() => handleProductClick(item)}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm shadow-sm hover:bg-orange-600 transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Cart Footer */}
                {cart.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 shadow-lg">
                        <div className="flex items-center justify-between max-w-2xl mx-auto">
                            <div>
                                <p className="text-xs text-slate-500">{cart.reduce((sum, i) => sum + i.quantity, 0)} รายการ</p>
                                <p className="text-lg font-bold text-slate-900">฿{totalAmount.toLocaleString()}</p>
                            </div>
                            <button
                                onClick={handleSubmitOrder}
                                disabled={submitting}
                                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm"
                            >
                                {submitting ? 'ส่ง...' : '✓ ยืนยันสั่ง'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Options Modal with Quantity Selector */}
                {showOptionsModal && selectedProductForOptions && (
                    <div className="fixed inset-0 bg-black/60 z-[200] flex items-end justify-center" onClick={() => setShowOptionsModal(false)}>
                        <div
                            className="bg-white rounded-t-3xl w-full max-w-md max-h-[80vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">{selectedProductForOptions.name}</h3>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">เลือกเพิ่มเติม</p>
                                    </div>
                                    <button
                                        onClick={() => setShowOptionsModal(false)}
                                        className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Options List */}
                            <div className="p-4 space-y-2 overflow-y-auto max-h-[40vh]">
                                {productOptions.length === 0 ? (
                                    <p className="text-center text-slate-400 py-6">ไม่มี Option</p>
                                ) : (
                                    productOptions.map(opt => {
                                        const isSelected = selectedOptions.some(o => o.id === opt.id);
                                        return (
                                            <button
                                                key={opt.id}
                                                onClick={() => toggleOption(opt)}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isSelected
                                                    ? 'bg-orange-50 border-orange-500'
                                                    : 'bg-slate-50 border-slate-100'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300'
                                                        }`}>
                                                        {isSelected && <span className="text-white text-[10px]">✓</span>}
                                                    </div>
                                                    <span className="font-bold text-sm text-slate-800">{opt.name}</span>
                                                </div>
                                                <span className={`font-bold text-sm ${opt.price_modifier > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                                                    {opt.price_modifier > 0 ? `+฿${opt.price_modifier}` : 'ฟรี'}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Quantity Selector */}
                            <div className="p-4 border-t border-slate-100 bg-slate-50">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">จำนวน</p>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setOptionQuantity(q => Math.max(1, q - 1))}
                                        className="w-10 h-10 bg-white rounded-xl shadow border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600"
                                    >
                                        -
                                    </button>
                                    <span className="text-2xl font-bold text-slate-900 w-12 text-center">{optionQuantity}</span>
                                    <button
                                        onClick={() => setOptionQuantity(q => Math.min(99, q + 1))}
                                        className="w-10 h-10 bg-white rounded-xl shadow border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-slate-500">ราคารวม</span>
                                    <span className="text-xl font-bold text-orange-500">
                                        ฿{((parseFloat(selectedProductForOptions.price) + selectedOptions.reduce((s, o) => s + (parseFloat(o.price_modifier) || 0), 0)) * optionQuantity).toLocaleString()}
                                    </span>
                                </div>
                                <button
                                    onClick={confirmAddWithOptions}
                                    className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 transition-all active:scale-95"
                                >
                                    ✓ เพิ่ม {optionQuantity} รายการ
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Step 3: Confirmation
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">✅</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">สั่งสำเร็จ!</h1>
                <p className="text-slate-500 mb-4">ออเดอร์ของคุณถูกส่งไปยังครัวแล้ว</p>

                <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                    <p className="text-sm text-slate-500 mb-1">หมายเลขออเดอร์</p>
                    <p className="text-4xl font-bold text-orange-500">#{orderNumber}</p>
                </div>

                <div className="text-left bg-amber-50 rounded-xl p-4 mb-6">
                    <p className="text-sm font-bold text-amber-700 mb-2">📋 รายละเอียด</p>
                    <p className="text-sm text-slate-700">ชื่อ: {customerName}</p>
                    {customerPhone && <p className="text-sm text-slate-700">โทร: {customerPhone}</p>}
                    <p className="text-sm text-slate-700 mt-2 font-bold">ยอดรวม: ฿{totalAmount.toLocaleString()}</p>
                </div>

                <p className="text-sm text-slate-500">
                    กรุณารอรับอาหารที่หน้าร้าน<br />
                    แจ้งหมายเลขออเดอร์เมื่อมารับ
                </p>
            </div>
        </div>
    );
};

export default TakeawayOrder;
