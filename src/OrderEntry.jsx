import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, socket } from './services/api';
import { Receipt } from './components/Receipt';
import { useAuth } from './contexts/AuthContext';
import generatePayload from 'promptpay-qr';
import QRCode from 'react-qr-code';
import { FiUser, FiSearch, FiGift, FiPlus, FiX, FiAward, FiStar } from 'react-icons/fi';

const OrderEntry = () => {
    const { tableId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth(); // Get user
    const [searchParams] = useSearchParams();
    // Logic: If explicitly "mode=customer" OR no user logged in -> Treat as Customer
    const isCustomer = searchParams.get('mode') === 'customer' || !user;
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [cart, setCart] = useState([]);
    const [orderedItems, setOrderedItems] = useState([]);
    const [activeOrderId, setActiveOrderId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false); // Success Modal State
    const [isCartOpen, setIsCartOpen] = useState(false); // Mobile Cart Toggle
    const [orderType, setOrderType] = useState('dine_in'); // dine_in or takeaway
    const [depositInfo, setDepositInfo] = useState({ amount: 0, isPaid: false });
    // Loyalty State
    const [loyaltyCustomer, setLoyaltyCustomer] = useState(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [customerCoupons, setCustomerCoupons] = useState([]);
    const [orderStatus, setOrderStatus] = useState('cooking'); // cooking, served, completed

    // Receipt State
    const [receiptData, setReceiptData] = useState(null);
    const receiptRef = useRef();

    // Loyalty Coupon State
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [isVerifyingCoupon, setIsVerifyingCoupon] = useState(false);
    const [couponError, setCouponError] = useState('');

    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [selectedProductForOptions, setSelectedProductForOptions] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState([]);

    // Edit Table Modal State
    const [showEditTableModal, setShowEditTableModal] = useState(false);
    const [newTableName, setNewTableName] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    // Socket listener for real-time order status updates
    useEffect(() => {
        socket.on('order-ready', (data) => {
            // Refresh order data when kitchen marks as ready
            if (data.tableName === tableId) {
                loadData();
            }
        });

        socket.on('order-update', () => {
            // Refresh order data on any order update
            loadData();
        });

        return () => {
            socket.off('order-ready');
            socket.off('order-update');
        };
    }, [tableId]);

    const loadData = async () => {
        try {
            const [menuData, orderData] = await Promise.all([
                api.getMenu(),
                api.getOrder(tableId)
            ]);

            // Set Menu
            setCategories(menuData.categories);
            setMenuItems(menuData.products);
            if (menuData.categories.length > 0) {
                setSelectedCategory(menuData.categories[0].id);
            }

            // Set Active Order
            if (orderData.order) {
                setActiveOrderId(orderData.order.id);
                setOrderedItems(orderData.items);
                setOrderStatus(orderData.order.status || 'cooking');

                if (orderData.order.customer_id) {
                    setLoyaltyCustomer({
                        id: orderData.order.customer_id,
                        displayName: orderData.order.customer_name,
                        pictureUrl: orderData.order.customer_picture
                    });
                    // Fetch coupons for existing linked customer
                    api.getCustomerCoupons(orderData.order.customer_id).then(setCustomerCoupons).catch(console.error);
                }

                setDepositInfo({
                    amount: parseFloat(orderData.order.deposit_amount) || 0,
                    isPaid: orderData.order.is_deposit_paid || false
                });
            }

            setLoading(false);
        } catch (error) {
            console.error("Error loading data:", error);
            setLoading(false);
        }
    };

    const handleSearchCustomer = async (e) => {
        const query = e.target.value;
        setSearchTerm(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const data = await api.searchLoyaltyCustomers(query);
            setSearchResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectCustomer = async (customer) => {
        try {
            if (activeOrderId) {
                await api.linkCustomerToOrder(activeOrderId, customer.id);
            }
            setLoyaltyCustomer({
                id: customer.id,
                displayName: customer.display_name,
                pictureUrl: customer.picture_url
            });
            // Fetch coupons for selected customer
            const coupons = await api.getCustomerCoupons(customer.id);
            setCustomerCoupons(coupons);

            setShowCustomerModal(false);
            setSearchTerm('');
            setSearchResults([]);
        } catch (err) {
            alert('ไม่สามารถเชื่อมต่อสมาชิกกับออเดอร์ได้');
        }
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
                setCouponCode(''); // Clear input on success
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
        setCouponCode('');
    };

    // Check if product has options before adding to cart
    const handleProductClick = (item) => {
        if (item.options && item.options.length > 0) {
            // Has options - show options modal
            setSelectedProductForOptions(item);
            setSelectedOptions([]);
            setShowOptionsModal(true);
        } else {
            // No options - add directly to cart
            addToCart(item);
        }
    };

    const addToCart = (item, options = []) => {
        const optionsTotal = options.reduce((sum, opt) => sum + (parseFloat(opt.price_modifier) || 0), 0);
        const itemWithOptions = {
            ...item,
            options: options, // Changed from selectedOptions to options for backend consistency
            unitPrice: parseFloat(item.price) + optionsTotal,
            optionsLabel: options.length > 0 ? options.map(o => o.name).join(', ') : ''
        };

        // Create unique key based on product ID + options
        const cartKey = `${item.id}-${options.map(o => o.id).sort().join('-')}`;

        setCart(prev => {
            const existing = prev.find(i => i.cartKey === cartKey);
            if (existing) {
                return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...itemWithOptions, cartKey, quantity: 1 }];
        });
    };

    const handleAddWithOptions = () => {
        if (!selectedProductForOptions) return;
        addToCart(selectedProductForOptions, selectedOptions);
        setShowOptionsModal(false);
        setSelectedProductForOptions(null);
        setSelectedOptions([]);
    };

    const toggleOption = (option) => {
        setSelectedOptions(prev => {
            const exists = prev.find(o => o.id === option.id);
            if (exists) {
                return prev.filter(o => o.id !== exists.id);
            }
            // For size options, replace existing size option
            if (option.is_size_option) {
                return [...prev.filter(o => !o.is_size_option), option];
            }
            return [...prev, option];
        });
    };

    const updateQuantity = (cartKey, delta) => {
        setCart(prev => prev.map(item => {
            if (item.cartKey === cartKey) {
                return { ...item, quantity: Math.max(0, item.quantity + delta) };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const handleDeleteOrder = async () => {
        if (!activeOrderId) return;
        if (window.confirm('คุณต้องการยกเลิกและลบออเดอร์นี้ใช่หรือไม่? ออเดอร์และรายการอาหารทั้งหมดจะถูกลบออกจากระบบ')) {
            try {
                const res = await api.deleteOrder(activeOrderId);
                if (res.success) {
                    alert('ลบออเดอร์เรียบร้อยแล้ว');
                    navigate('/'); // Go back to table plan
                } else {
                    alert('Error: ' + res.error);
                }
            } catch (error) {
                console.error(error);
                alert('Failed to delete order');
            }
        }
    };

    const handleEditOrder = () => {
        if (!activeOrderId) return;
        setNewTableName(tableId);
        setShowEditTableModal(true);
    };

    const confirmTableChange = async () => {
        if (!newTableName || newTableName === tableId) {
            setShowEditTableModal(false);
            return;
        }

        try {
            const res = await api.updateOrder(activeOrderId, { table_name: newTableName });
            if (res.success) {
                alert(`ย้ายออเดอร์ไปโต๊ะ ${newTableName} เรียบร้อยแล้ว`);
                setShowEditTableModal(false);
                navigate(`/order-entry/${newTableName}`); // Switch to new table view
            } else {
                alert('Error: ' + res.error);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to update order');
        }
    };

    const cartTotal = cart.reduce((sum, item) => sum + ((item.unitPrice || item.price) * item.quantity), 0);
    const orderedTotal = orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = cartTotal + orderedTotal;

    const submitOrder = async () => {
        if (cart.length === 0) return alert('กรุณาเลือกรายการอาหารก่อนครับ');

        try {
            const res = await api.createOrder(tableId || 'T-00', cart, cartTotal, orderType);
            if (res.success) {
                alert(`✅ ส่งรายการเข้าครัวเรียบร้อยแล้วครับ (${orderType === 'dine_in' ? 'กินที่ร้าน' : 'สั่งกลับบ้าน'})`);
                setCart([]); // Clear local cart
                loadData(); // Reload to show new items in "Ordered Items" list
            } else {
                alert('เกิดข้อผิดพลาด: ' + res.error);
            }
        } catch (error) {
            console.error(error);
            alert('ไม่สามารถเชื่อมต่อ Server ได้');
        }
    };

    const handlePaymentClick = () => {
        setShowPaymentModal(true);
    };

    const [settings, setSettings] = useState({ tax_rate: 0, shop_name: '', shop_address: '' });
    const [discountAmount, setDiscountAmount] = useState(0);

    // Payment Logic States
    const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, transfer, khon_la_khrueng
    const [cashReceived, setCashReceived] = useState('');

    // Initial Load - Get Settings
    useEffect(() => {
        api.getSettings().then(data => {
            setSettings(data);
        });
    }, []);

    // ... (existing loadData) ...

    // Calculation Logic
    const calculateFinal = () => {
        // Only calculate on ordered items (not cart)
        const subtotal = orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Coupon Discount Logic (Support multiple Thai formats: -฿XX, XX บาท, ลด XX)
        let couponDiscount = 0;
        if (appliedCoupon) {
            // Robust parsing: Look for various amount patterns
            const patterns = [
                /-฿(\d+)/,            // -฿50
                /(\d+)\s*บาท/,        // 50 บาท
                /ลด\s*(\d+)/          // ลด 50
            ];

            for (const p of patterns) {
                const match = appliedCoupon.title.match(p);
                if (match) {
                    couponDiscount = parseInt(match[1]);
                    break;
                }
            }
        }

        const totalDiscount = Math.min(discountAmount + couponDiscount, subtotal);
        const afterDiscount = subtotal - totalDiscount;
        const taxRate = parseFloat(settings.tax_rate) || 0;
        const taxAmount = afterDiscount * (taxRate / 100);
        const grandTotal = afterDiscount + taxAmount;

        // Effective Total (after deposit if paid)
        const paidDeposit = depositInfo.isPaid ? depositInfo.amount : 0;
        const finalToPay = Math.max(0, grandTotal - paidDeposit);

        return { subtotal, validDiscount: totalDiscount, couponDiscount, taxAmount, grandTotal, paidDeposit, finalToPay };
    };

    const calculateChange = () => {
        const received = parseFloat(cashReceived) || 0;
        const { finalToPay } = calculateFinal();
        return Math.max(0, received - finalToPay);
    };

    const confirmPayment = async () => {
        const { subtotal, validDiscount, taxAmount, grandTotal, paidDeposit, finalToPay } = calculateFinal();

        // Validation for Cash
        if (paymentMethod === 'cash') {
            if ((parseFloat(cashReceived) || 0) < finalToPay) {
                return alert('จำนวนเงินที่รับมาไม่พอครับ');
            }
        }

        try {
            const res = await api.payOrder(activeOrderId, {
                discountAmount: validDiscount,
                taxRate: parseFloat(settings.tax_rate) || 0,
                paymentMethod,
                depositAmount: paidDeposit // Send deposit amount if needed for ledger
            });

            if (res.success) {
                // If coupon applied, mark it as used
                if (appliedCoupon) {
                    try {
                        await api.useCoupon(appliedCoupon.coupon_code, activeOrderId);
                    } catch (e) {
                        console.error("Failed to mark coupon as used:", e);
                    }
                }
                // Receipt data for printing component
                const dataToPrint = {
                    tableId: tableId,
                    items: orderedItems,
                    subtotal: subtotal,
                    discount: validDiscount,
                    tax: taxAmount,
                    grandTotal: grandTotal,
                    paidDeposit: paidDeposit,
                    total: finalToPay,
                    cashReceived: parseFloat(cashReceived) || 0,
                    change: calculateChange(),
                    paymentMethod: paymentMethod,
                    settings: settings,
                    date: new Date().toISOString(),
                    orderId: activeOrderId
                };
                setReceiptData(dataToPrint);

                // Play Success Sound
                const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-cash-register-purchase-873.mp3');
                audio.play().catch(e => console.log('Audio play failed', e));

                // Print Receipt if enabled (Default to true)
                if (settings.enable_receipt_printer !== 'false') {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                }

                setLoading(false);
                setShowPaymentModal(false);
                setShowQRModal(false);
                setShowSuccessModal(true); // Show Success Modal instead of immediate redirect
            } else {
                alert('เกิดข้อผิดพลาด: ' + (res.error || 'Unknown error'));
                setLoading(false);
            }

        } catch (error) {
            console.error("Payment error:", error);
            alert("Payment failed");
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center">กำลังโหลดข้อมูล...</div>;

    const finals = calculateFinal();

    return (
        <div className="flex flex-col md:flex-row h-full bg-[#F2F6F9] overflow-hidden relative text-slate-900">
            <Receipt ref={receiptRef} data={receiptData} />

            {/* Main Menu Side (Left) */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar p-1.5 md:p-6 lg:p-8 space-y-2 md:space-y-6 pb-24 md:pb-8">

                {/* Header with Back Button - Hide on customer mobile */}
                {!isCustomer && (
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate('/tables')}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-orange-500 transition-all font-bold text-sm shadow-sm"
                        >
                            ← กลับหน้าหลัก
                        </button>
                        <h1 className="text-lg md:text-xl font-bold text-slate-900 font-heading">Table <span className="text-orange-500">#{tableId}</span></h1>
                    </div>
                )}

                {/* Customer Mode Header */}
                {isCustomer && (
                    <div className="text-center py-2 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl mb-2">
                        <h1 className="text-base font-bold text-slate-900 font-heading">🍽️ สั่งอาหาร <span className="text-orange-500">โต๊ะ {tableId}</span></h1>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mobile Menu • Refreshing Design</p>
                    </div>
                )}

                {/* 1. Order Line (Status Cards) - Hide on mobile for customer */}
                {orderedItems.length > 0 && !isCustomer && (
                    <section className="hidden md:block">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 font-heading">Order Line</h2>
                        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                            <div className="min-w-[280px] bg-[#D6EFEF] p-5 rounded-[24px] border border-[#B5E1E1] relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none mb-1">Order #FO0{activeOrderId || '27'}</p>
                                        <h3 className="text-sm font-bold text-slate-900">Table {tableId}</h3>
                                    </div>
                                </div>
                                <p className="text-[11px] font-bold text-slate-800 mb-4">Item: {orderedItems.length}X</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500">Just Now</span>
                                    <span className="px-3 py-1 bg-[#00A099] text-white rounded-full text-[9px] font-bold uppercase">In Kitchen</span>
                                </div>
                            </div>
                            {/* Kitchen Status Card - Dynamic */}
                            <div className={`min-w-[280px] p-5 rounded-[24px] border ${orderStatus === 'served' ? 'bg-emerald-50 border-emerald-200' :
                                orderStatus === 'cooking' ? 'bg-orange-50 border-orange-200' :
                                    'bg-[#FFE1E1] border-[#FFC5C5]'
                                }`}>
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none mb-1">Kitchen Status</p>
                                <h3 className="text-sm font-bold text-slate-900">
                                    {orderStatus === 'served' ? '✅ พร้อมเสิร์ฟ' :
                                        orderStatus === 'cooking' ? '🍳 กำลังทำ' :
                                            '⏳ รอคิว'}
                                </h3>
                                <div className="mt-8 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500">
                                        {orderStatus === 'served' ? 'Completed' : 'In Progress'}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase text-white ${orderStatus === 'served' ? 'bg-emerald-500' :
                                        orderStatus === 'cooking' ? 'bg-orange-500' :
                                            'bg-red-500'
                                        }`}>
                                        {orderStatus === 'served' ? 'Ready' :
                                            orderStatus === 'cooking' ? 'Cooking' :
                                                'Waiting'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 2. Foodies Menu (Categories) */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 font-heading">Foodies Menu</h2>
                        <div className="hidden md:flex gap-2">
                            <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-orange-500 transition-all shadow-sm">&lt;</button>
                            <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-orange-500 transition-all shadow-sm">&gt;</button>
                        </div>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-2 hide-scrollbar">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`flex flex-col items-center gap-1 p-1.5 min-w-[65px] md:min-w-[90px] rounded-xl md:rounded-[20px] transition-all border ${!selectedCategory ? 'bg-white border-orange-200 shadow-md ring-1 ring-orange-500/10' : 'bg-transparent border-transparent text-slate-400 hover:bg-white/50'}`}
                        >
                            <span className="text-base md:text-2xl">🍽️</span>
                            <span className="text-[8px] md:text-[11px] font-bold uppercase tracking-wider">All</span>
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex flex-col items-center gap-1 p-1.5 min-w-[65px] md:min-w-[90px] rounded-xl md:rounded-[20px] transition-all border ${selectedCategory === cat.id ? 'bg-white border-orange-200 shadow-md ring-1 ring-orange-500/10' : 'bg-transparent border-transparent text-slate-400 hover:bg-white/50'}`}
                            >
                                <span className="text-base md:text-2xl">{cat.icon}</span>
                                <span className="text-[8px] md:text-[11px] font-bold uppercase tracking-wider leading-tight text-center line-clamp-1">{cat.name}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* 3. Product Grid */}
                <section>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5 md:gap-4">
                        {menuItems.filter(i => !selectedCategory || i.category_id === selectedCategory).map(item => {
                            // Use computed_available which includes recipe + stock logic
                            const isAvailable = item.computed_available !== undefined ? item.computed_available : item.is_available;
                            return (
                                <div key={item.id} className={`tasty-card p-1.5 md:p-3 flex flex-col group relative ${!isAvailable ? 'opacity-80 cursor-not-allowed' : ''}`}>
                                    <div className="aspect-[4/3] rounded-lg md:rounded-xl overflow-hidden mb-1.5 bg-slate-50 ring-1 ring-slate-100 group-hover:ring-orange-100 transition-all relative">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${!isAvailable ? 'grayscale opacity-40' : ''}`} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xl md:text-3xl grayscale opacity-20">🥡</div>
                                        )}

                                        {!isAvailable && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                <span className="bg-red-600 text-white text-[10px] md:text-xs font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-xl animate-pulse">
                                                    สินค้าหมด
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[7px] md:text-[9px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider line-clamp-1">{categories.find(c => c.id === item.category_id)?.name || 'Dish'}</p>
                                    <h4 className="text-[10px] md:text-xs font-bold text-slate-800 mb-1 line-clamp-1">{item.name}</h4>
                                    <div className="mt-auto flex items-center justify-between">
                                        <div>
                                            <span className="text-[11px] md:text-sm font-bold text-slate-900 leading-none">฿{item.price.toLocaleString()}</span>
                                            {item.options && item.options.length > 0 && (
                                                <span className="ml-1 text-[8px] text-orange-500 font-bold">+Options</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {isAvailable ? (
                                                <button
                                                    onClick={() => handleProductClick(item)}
                                                    className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg md:rounded-xl bg-[#00A099] text-white shadow-md shadow-[#00A099]/20 hover:scale-110 transition-all active:scale-95"
                                                >
                                                    <span className="text-sm md:text-lg font-bold">+</span>
                                                </button>
                                            ) : (
                                                <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg md:rounded-xl bg-slate-200 text-slate-400 cursor-not-allowed">
                                                    <span className="text-sm md:text-lg font-bold">✕</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* Order Summary Side (Right) */}
            <div className={`
                fixed inset-0 z-[100] md:z-auto bg-[#F2F6F9] flex flex-col transition-transform duration-300
                md:relative md:w-[420px] md:translate-y-0 md:bg-white md:border-l border-[#E8ECEB]
                ${isCartOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
            `}>
                <div className="flex-1 flex flex-col p-8 overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 font-heading">Table No #{tableId}</h3>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Order #{activeOrderId || 'NEW'}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleEditOrder} className="p-2 text-slate-400 hover:text-orange-500 transition-colors" title="แก้ไขโต๊ะ"><span className="text-xl">✏️</span></button>
                            <button onClick={handleDeleteOrder} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="ลบออเดอร์"><span className="text-xl">🗑️</span></button>
                        </div>
                    </div>

                    {/* Customer / Loyalty Badge */}
                    <div className="mb-6">
                        {loyaltyCustomer ? (
                            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-white shadow-sm">
                                        {loyaltyCustomer.pictureUrl ? (
                                            <img src={loyaltyCustomer.pictureUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-orange-200 bg-orange-50">
                                                <FiUser size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Loyalty Member</p>
                                        <p className="text-sm font-bold text-orange-600">{loyaltyCustomer.displayName}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (window.confirm('ยกเลิกการเชื่อมต่อสมาชิกหรือไม่?')) {
                                            setLoyaltyCustomer(null);
                                        }
                                    }}
                                    className="p-2 text-orange-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <FiX />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowCustomerModal(true)}
                                className="w-full bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-3 text-slate-400 hover:text-orange-500 hover:border-orange-200 hover:bg-orange-50 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                                    <FiPlus />
                                </div>
                                <span className="text-sm font-bold uppercase tracking-widest">Link Loyalty Customer</span>
                            </button>
                        )}
                    </div>

                    {/* People Count Badge */}
                    <div className="flex justify-end mb-6">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            2 People <span className="text-slate-200">|</span> {cart.length + orderedItems.length} Items
                        </span>
                    </div>

                    {/* Ordered Items List */}
                    <div className="flex-1 overflow-y-auto mb-8 custom-scrollbar space-y-6">
                        <div>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Ordered Items</h4>
                            <div className="space-y-4">
                                {orderedItems.length > 0 ? orderedItems.map((item, idx) => (
                                    <div key={idx} className="flex flex-col gap-0.5 group py-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-slate-400 w-6">{item.quantity}x</span>
                                                <span className="text-sm font-bold text-slate-700 line-clamp-1 group-hover:text-orange-600 transition-colors">{item.product_name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-900">฿{(item.price * item.quantity).toLocaleString()}</span>
                                        </div>
                                        {item.options && item.options.length > 0 && (
                                            <div className="pl-9 space-y-0.5">
                                                {item.options.map((opt, oIdx) => (
                                                    <p key={oIdx} className="text-[10px] text-orange-500 font-medium flex items-center gap-1">
                                                        <span className="w-1 h-1 rounded-full bg-orange-400"></span>
                                                        {opt.option_name || opt.name}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )) : (
                                    <p className="text-xs text-slate-300 italic">No items served yet...</p>
                                )}
                            </div>
                        </div>

                        {cart.length > 0 && (
                            <div className="pt-6 border-t border-slate-100">
                                <h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] mb-4">Draft Order</h4>
                                <div className="space-y-4">
                                    {cart.map((item) => (
                                        <div key={item.cartKey} className="flex items-center justify-between">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <span className="text-xs font-bold text-orange-400 w-6 flex-shrink-0">{item.quantity}x</span>
                                                <div className="min-w-0">
                                                    <span className="text-sm font-bold text-slate-700 line-clamp-1">{item.name}</span>
                                                    {item.optionsLabel && (
                                                        <p className="text-[10px] text-orange-500 font-medium truncate">+ {item.optionsLabel}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-900">฿{((item.unitPrice || item.price) * item.quantity).toLocaleString()}</span>
                                                <button onClick={() => updateQuantity(item.cartKey, -1)} className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs hover:bg-red-100 hover:text-red-500 transition-colors">-</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Payment Summary */}
                    <section className="border-t border-slate-100 pt-6 space-y-3">
                        <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span>Subtotal</span>
                            <span>฿{totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span>Tax (7%)</span>
                            <span>฿0.00</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3">
                            <span>Service Charge</span>
                            <span>฿0.00</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-lg font-bold text-slate-900 font-heading uppercase">Total Payable</span>
                            <span className="text-3xl font-bold text-slate-900 tracking-tighter">฿{totalAmount.toLocaleString()}</span>
                        </div>
                    </section>

                    {/* Payment Method */}
                    <section className="mt-6 mb-8">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">วิธีชำระเงิน</p>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className={`flex flex-col items-center gap-2 p-3 rounded-[20px] transition-all border ${paymentMethod === 'cash' ? 'bg-white border-orange-200 shadow-md ring-1 ring-orange-500/10 text-orange-500' : 'bg-[#F8FAFC] border-transparent text-slate-400'}`}
                            >
                                <span className="text-xl">💵</span>
                                <span className="text-[9px] font-bold uppercase tracking-widest">เงินสด</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('half')}
                                className={`flex flex-col items-center gap-2 p-3 rounded-[20px] transition-all border ${paymentMethod === 'half' ? 'bg-white border-blue-200 shadow-md ring-1 ring-blue-500/10 text-blue-500' : 'bg-[#F8FAFC] border-transparent text-slate-400'}`}
                            >
                                <span className="text-xl">🏛️</span>
                                <span className="text-[8px] font-bold uppercase tracking-widest leading-tight text-center">คนละครึ่ง</span>
                            </button>
                            <button
                                onClick={() => {
                                    setPaymentMethod('transfer');
                                    setShowQRModal(true);
                                }}
                                className={`flex flex-col items-center gap-2 p-3 rounded-[20px] transition-all border ${paymentMethod === 'transfer' ? 'bg-white border-purple-200 shadow-md ring-1 ring-purple-500/10 text-purple-500' : 'bg-[#F8FAFC] border-transparent text-slate-400'}`}
                            >
                                <span className="text-xl">📲</span>
                                <span className="text-[8px] font-bold uppercase tracking-widest leading-tight text-center">Scan QR</span>
                            </button>
                        </div>
                    </section>

                    {/* Footer Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.print()}
                            className="w-16 h-14 flex items-center justify-center rounded-[20px] bg-white border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-200 hover:shadow-lg transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </button>
                        <button
                            onClick={activeOrderId && cart.length === 0 ? handlePaymentClick : submitOrder}
                            className="flex-1 bg-[#00A099] h-14 rounded-[20px] text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-[#00A099]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="text-lg">⚡</span>
                            {activeOrderId && cart.length === 0 ? 'Collect Payment' : activeOrderId ? 'Update Order' : 'Place Order'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Footer (Sticky) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex items-center justify-between z-[50]">
                <div onClick={() => setIsCartOpen(true)} className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500 text-xl relative">
                        🛒
                        <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold px-1.5 rounded-full border-2 border-white">
                            {cart.length + orderedItems.length}
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Bill</p>
                        <p className="text-lg font-bold text-slate-900 tracking-tighter leading-none">฿{totalAmount.toLocaleString()}</p>
                    </div>
                </div>
                <button
                    onClick={submitOrder}
                    className="px-8 py-3 bg-[#00A099] text-white rounded-[20px] font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#00A099]/20"
                >
                    Confirm
                </button>
            </div>

            {/* Payment Confirmation Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">💳 ยืนยันการชำระเงิน</h3>

                        <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">ยอดรวม (Subtotal)</span>
                                <span className="text-sm font-bold text-slate-700">฿{finals.subtotal.toLocaleString()}</span>
                            </div>
                            {finals.validDiscount > 0 && (
                                <div className="flex justify-between text-red-500">
                                    <span className="text-sm">ส่วนลด (Regular + Coupon)</span>
                                    <span className="text-sm font-bold">-฿{finals.validDiscount.toLocaleString()}</span>
                                </div>
                            )}
                            {depositInfo.isPaid && depositInfo.amount > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                    <span className="text-sm">หักมัดจำแล้ว</span>
                                    <span className="font-bold">-฿{depositInfo.amount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                                <span className="text-sm font-bold text-slate-700 uppercase">ยอดสุทธิ</span>
                                <span className="text-2xl font-bold text-orange-500">฿{finals.finalToPay.toLocaleString()}</span>
                            </div>
                            {appliedCoupon && finals.couponDiscount === 0 && (
                                <div className="mt-3 py-2 px-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-emerald-600 animate-pulse">
                                    <span className="text-sm">🎁</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">สิทธิ์พิเศษ: {appliedCoupon.title}</span>
                                </div>
                            )}
                        </div>

                        {/* Coupon Section */}
                        <div className="mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                            <label className="text-[10px] font-bold text-orange-400 uppercase tracking-[0.2em] mb-3 block">คูปองส่วนลด / Loyalty Rewards</label>

                            {appliedCoupon ? (
                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-orange-200 shadow-sm animate-in zoom-in duration-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-xl">💎</div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">{appliedCoupon.title}</p>
                                            <p className="text-[9px] text-orange-500 font-bold tracking-widest">{appliedCoupon.coupon_code}</p>
                                        </div>
                                    </div>
                                    <button onClick={removeCoupon} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                        <FiX size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Selection List */}
                                    {customerCoupons.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                                            {customerCoupons.filter(c => c.status === 'active').map(coupon => (
                                                <button
                                                    key={coupon.id}
                                                    onClick={() => setAppliedCoupon({ ...coupon, title: coupon.promotion_title })}
                                                    className="flex-shrink-0 bg-white border border-orange-200 rounded-xl p-3 text-left hover:border-orange-500 hover:shadow-md transition-all group max-w-[140px]"
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm">🎁</span>
                                                        <span className="text-[9px] font-bold text-orange-600 truncate">{coupon.promotion_title}</span>
                                                    </div>
                                                    <p className="text-[8px] text-slate-400 font-bold truncate">{coupon.coupon_code}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                            placeholder="กรอกรหัสคูปอง..."
                                            className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-orange-500 outline-none uppercase tracking-widest font-bold"
                                        />
                                        <button
                                            onClick={handleVerifyCoupon}
                                            disabled={isVerifyingCoupon || !couponCode}
                                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-all uppercase tracking-widest"
                                        >
                                            {isVerifyingCoupon ? '...' : 'Verify'}
                                        </button>
                                    </div>
                                    {couponError && <p className="text-[10px] text-red-500 font-bold pl-2">⚠️ {couponError}</p>}
                                </div>
                            )}
                        </div>

                        {paymentMethod === 'cash' && (
                            <div className="mb-6">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">รับเงินมา</label>
                                <input
                                    type="number"
                                    value={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.value)}
                                    inputMode="numeric"
                                    className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                    placeholder="0"
                                />
                                {parseFloat(cashReceived) > 0 && (
                                    <div className="mt-3 text-center">
                                        <span className="text-sm text-slate-500">เงินทอน: </span>
                                        <span className="text-lg font-bold text-emerald-600">฿{calculateChange().toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={confirmPayment}
                                className="flex-1 py-3 bg-[#00A099] text-white rounded-xl font-bold hover:bg-[#009088] transition-colors shadow-lg shadow-[#00A099]/30"
                            >
                                ✓ ยืนยันชำระ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Payment Modal */}
            {showQRModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowQRModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">📲 Scan QR ชำระเงิน</h3>
                        <p className="text-sm text-slate-500 mb-4">สแกนด้วยแอปธนาคารของคุณ</p>

                        <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 inline-block mb-4">
                            <QRCode
                                value={generatePayload(settings.promptpay_id || '0000000000', { amount: Number(finals.finalToPay) })}
                                size={180}
                                level="H"
                            />
                        </div>

                        <div className="bg-purple-50 rounded-xl p-3 mb-4">
                            <p className="text-xs text-purple-600 font-bold uppercase tracking-widest mb-1">ยอดที่ต้องชำระ</p>
                            <p className="text-2xl font-bold text-purple-700">฿{finals.finalToPay.toLocaleString()}</p>
                            {finals.couponDiscount > 0 ? (
                                <p className="text-[10px] text-green-600 font-bold mt-1">
                                    (รวมส่วนลดคูปอง -฿{finals.couponDiscount})
                                </p>
                            ) : appliedCoupon && (
                                <p className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center justify-center gap-1">
                                    <span>🎁</span> Reward Ready
                                </p>
                            )}
                        </div>

                        {/* Coupon Section inside QR Modal for Convenience */}
                        <div className="mb-4 text-left">
                            {appliedCoupon ? (
                                <div className="flex items-center justify-between bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-sm">💎</div>
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] font-bold text-slate-900 truncate">{appliedCoupon.title}</p>
                                            <p className="text-[8px] text-orange-500 font-bold tracking-widest">{appliedCoupon.coupon_code}</p>
                                        </div>
                                    </div>
                                    <button onClick={removeCoupon} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                        <FiX size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Selection List Mini */}
                                    {customerCoupons.length > 0 && (
                                        <div className="flex gap-1.5 overflow-x-auto pb-1.5 hide-scrollbar">
                                            {customerCoupons.filter(c => c.status === 'active').map(coupon => (
                                                <button
                                                    key={coupon.id}
                                                    onClick={() => setAppliedCoupon({ ...coupon, title: coupon.promotion_title })}
                                                    className="flex-shrink-0 bg-white border border-orange-100 rounded-lg p-2 text-left hover:border-orange-400 transition-all max-w-[110px]"
                                                >
                                                    <p className="text-[8px] font-bold text-orange-600 truncate mb-0.5">{coupon.promotion_title}</p>
                                                    <p className="text-[7px] text-slate-400 font-bold truncate">{coupon.coupon_code}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-1.5">
                                        <input
                                            type="text"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                            placeholder="รหัสคูปอง..."
                                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:border-orange-500 outline-none uppercase tracking-widest font-bold"
                                        />
                                        <button
                                            onClick={handleVerifyCoupon}
                                            disabled={isVerifyingCoupon || !couponCode}
                                            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 disabled:opacity-50 transition-all uppercase"
                                        >
                                            Verify
                                        </button>
                                    </div>
                                    {couponError && <p className="text-[8px] text-red-500 font-bold pl-1">⚠️ {couponError}</p>}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => {
                                    setShowQRModal(false);
                                    confirmPayment();
                                }}
                                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/30"
                            >
                                ✓ รับแล้ว
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-4xl">✅</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">ชำระเงินสำเร็จ!</h3>
                        <p className="text-slate-500 mb-6">โต๊ะ {tableId} ปิดบิลเรียบร้อย</p>
                        <button
                            onClick={() => navigate('/tables')}
                            className="w-full py-3 bg-[#00A099] text-white rounded-xl font-bold hover:bg-[#009088] transition-colors"
                        >
                            กลับหน้าหลัก
                        </button>
                    </div>
                </div>
            )}

            {/* Customer Search Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in duration-300">
                        <div className="p-8 pb-4">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800">ค้นหาสมาชิก Loyalty</h3>
                                <button onClick={() => setShowCustomerModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><FiX size={24} /></button>
                            </div>
                            <div className="relative">
                                <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="พิมพ์ชื่อ, Line ID หรือเบอร์โทร..."
                                    className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={handleSearchCustomer}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2">
                            {isSearching ? (
                                <div className="text-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500 mx-auto"></div>
                                </div>
                            ) : (
                                <>
                                    {searchResults.map(customer => (
                                        <button
                                            key={customer.id}
                                            onClick={() => handleSelectCustomer(customer)}
                                            className="w-full p-4 rounded-2xl hover:bg-orange-50 flex items-center gap-4 transition-colors group"
                                        >
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-white shadow-sm">
                                                {customer.picture_url ? (
                                                    <img src={customer.picture_url} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300"><FiUser size={24} /></div>
                                                )}
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-bold text-slate-800 group-hover:text-orange-600 transition-colors uppercase tracking-tight">{customer.display_name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] text-slate-400 font-medium tracking-wide">คะแนนสะสม: {customer.points} แต้ม</p>
                                                    {customer.phone && (
                                                        <p className="text-[10px] text-orange-400 font-bold tracking-wider">• {customer.phone}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {searchTerm.length >= 2 && searchResults.length === 0 && (
                                        <div className="text-center py-10">
                                            <p className="text-slate-400 font-medium mb-1">ไม่พบข้อมูลสมาชิกครับ 🔍</p>
                                            <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">Try searching for a different name</p>
                                        </div>
                                    )}
                                    {searchTerm.length < 2 && (
                                        <div className="text-center py-10">
                                            <FiSearch className="mx-auto text-slate-100 mb-4" size={48} />
                                            <p className="text-[10px] text-slate-300 uppercase tracking-[0.2em] font-black">Search for customer name or id</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Options Selection Modal */}
            {showOptionsModal && selectedProductForOptions && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowOptionsModal(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-black">{selectedProductForOptions.name}</h3>
                                    <p className="text-orange-100 text-sm mt-1">เลือก Options เพิ่มเติม</p>
                                </div>
                                <button onClick={() => setShowOptionsModal(false)} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
                            </div>
                        </div>

                        {/* Options List */}
                        <div className="p-6 overflow-y-auto max-h-[50vh] space-y-3">
                            {selectedProductForOptions.options?.filter(opt => !opt.is_size_option).length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">➕ Add-ons (เลือกได้หลายอย่าง)</h4>
                                    {selectedProductForOptions.options.filter(opt => !opt.is_size_option).map(opt => {
                                        const isSelected = selectedOptions.find(o => o.id === opt.id);
                                        return (
                                            <button key={opt.id} onClick={() => toggleOption(opt)} className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all mb-2 ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-orange-200'}`}>
                                                <span className={`font-bold ${isSelected ? 'text-orange-600' : 'text-slate-700'}`}>{opt.name}</span>
                                                <span className="text-orange-500 font-bold">+฿{opt.price_modifier}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedProductForOptions.options?.filter(opt => opt.is_size_option).length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">📏 Size Options (เลือก 1 อย่าง)</h4>
                                    {selectedProductForOptions.options.filter(opt => opt.is_size_option).map(opt => {
                                        const isSelected = selectedOptions.find(o => o.id === opt.id);
                                        const outOfStock = opt.stock_quantity <= 0;
                                        return (
                                            <button key={opt.id} onClick={() => !outOfStock && toggleOption(opt)} disabled={outOfStock} className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all mb-2 ${outOfStock ? 'opacity-50 cursor-not-allowed border-slate-100' : isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-bold ${isSelected ? 'text-blue-600' : 'text-slate-700'}`}>{opt.name}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${outOfStock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                        {outOfStock ? 'หมด' : `เหลือ ${opt.stock_quantity}`}
                                                    </span>
                                                </div>
                                                <span className="text-blue-500 font-bold">+฿{opt.price_modifier}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-bold text-slate-500">ราคารวม</span>
                                <span className="text-2xl font-black text-orange-600">
                                    ฿{(parseFloat(selectedProductForOptions.price) + selectedOptions.reduce((sum, o) => sum + parseFloat(o.price_modifier || 0), 0)).toLocaleString()}
                                </span>
                            </div>
                            <button onClick={handleAddWithOptions} className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                เพิ่มลงตะกร้า
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Table Modal */}
            {showEditTableModal && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowEditTableModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <span className="text-4xl mb-4 block">✏️</span>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">ย้ายโต๊ะ / เปลี่ยนหมายเลข</h3>
                            <p className="text-sm text-slate-500 font-medium">ระบุหมายเลขโต๊ะใหม่ที่ต้องการย้ายออเดอร์นี้ไป</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">หมายเลขโต๊ะใหม่</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newTableName}
                                    onChange={(e) => setNewTableName(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-bold text-center focus:border-orange-500 focus:bg-white outline-none transition-all"
                                    placeholder="เช่น T-02"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <button
                                    onClick={() => setShowEditTableModal(false)}
                                    className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={confirmTableChange}
                                    disabled={!newTableName || newTableName === tableId}
                                    className="py-4 bg-[#00A099] text-white rounded-2xl font-bold hover:bg-[#009088] disabled:bg-slate-300 disabled:shadow-none transition-all shadow-lg shadow-[#00A099]/30"
                                >
                                    ย้ายโต๊ะ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderEntry;
