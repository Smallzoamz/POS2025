import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
    FiGift, FiAward, FiClock, FiStar, FiUser,
    FiCheckCircle, FiChevronRight, FiCreditCard, FiZap
} from 'react-icons/fi';
import liff from '@line/liff';

const CustomerLoyalty = () => {
    const [lineUser, setLineUser] = useState(null);
    const [points, setPoints] = useState(0);
    const [history, setHistory] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [activeTab, setActiveTab] = useState('earn'); // earn, coupons, member
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [liffError, setLiffError] = useState(null);

    const initLiff = async () => {
        setLoading(true);
        const liffId = import.meta.env.VITE_LIFF_LOYALTY_ID || import.meta.env.VITE_LIFF_ID;

        if (!liffId) {
            setLiffError('ยังไม่ได้ตั้งค่า VITE_LIFF_LOYALTY_ID ในระบบ (Render Environment)');
            setLoading(false);
            return;
        }

        try {
            await liff.init({ liffId });
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                const loyaltyData = {
                    lineUserId: profile.userId,
                    displayName: profile.displayName,
                    pictureUrl: profile.pictureUrl
                };

                const syncRes = await api.syncLoyaltyProfile(loyaltyData);
                setLineUser(syncRes);
                setPoints(syncRes.points || 0);
                setIsFollowing(syncRes.is_following || false);

                const [fullProfile, activePromos, userCoupons] = await Promise.all([
                    api.getLoyaltyProfile(profile.userId),
                    api.getActivePromotions(),
                    api.getCustomerCoupons(syncRes.id)
                ]);

                setHistory(fullProfile.transactions || []);
                setPromotions(activePromos || []);
                setCoupons(userCoupons || []);
                setLoading(false);
            } else {
                setLoading(false);
            }
        } catch (err) {
            console.error('❌ LIFF init failed:', err);
            setLiffError('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาเช็ค LIFF ID');
            setLoading(false);
        }
    };

    useEffect(() => {
        initLiff();
    }, []);

    const refreshData = async () => {
        if (!lineUser) return;
        const [fullProfile, userCoupons] = await Promise.all([
            api.getLoyaltyProfile(lineUser.line_user_id),
            api.getCustomerCoupons(lineUser.id)
        ]);
        setHistory(fullProfile.transactions || []);
        setCoupons(userCoupons || []);
        setPoints(fullProfile.points || 0);
    };

    const handleLogin = () => {
        if (!import.meta.env.VITE_LIFF_LOYALTY_ID && !import.meta.env.VITE_LIFF_ID) {
            alert('❌ ไม่พบ LIFF ID ในระบบ!');
            return;
        }
        liff.login({ redirectUri: window.location.href });
    };

    const handleRedeem = async (promo) => {
        if (points < promo.points_required) {
            alert('คะแนนของคุณยังไม่เพียงพอค่ะ 🥺');
            return;
        }

        if (!confirm(`คุณต้องการแลก ${promo.title} โดยใช้ ${promo.points_required} แต้ม ใช่หรือไม่?`)) return;

        try {
            const res = await api.redeemLoyaltyPoints({
                customerId: lineUser.id,
                promotionId: promo.id
            });
            if (res.success) {
                setPoints(res.newPoints);
                alert(`แลกรางวัลสำเร็จ! 🎉\nรหัสคูปองของคุณคือ: ${res.couponCode}\nกรุณายื่นรหัสนี้ให้พนักงานนะคะ`);
                setActiveTab('coupons');
                refreshData();
            }
        } catch (err) {
            alert(err.message || 'เกิดข้อผิดพลาดในการแลกรางวัล');
        }
    };

    if (!lineUser && !loading) {
        return (
            <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-sm w-full">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-4xl font-bold">L</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">สะสมแต้มกับเรา</h1>
                    <p className="text-gray-500 mb-8">เข้าใช้งานผ่าน LINE เพื่อรับคะแนนและแลกของรางวัลมากมาย</p>
                    <button
                        onClick={handleLogin}
                        className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95"
                    >
                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                            <span className="text-[#06C755] text-sm font-black">L</span>
                        </div>
                        คลิกเพื่อ Login ผ่าน LINE
                    </button>
                    <p className="mt-6 text-xs text-gray-400 font-medium">✨ 35 บาท = 1 แต้ม ✨</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fa] pb-24 max-w-md mx-auto shadow-2xl relative overflow-hidden flex flex-col font-sans">
            {/* Header / Profile */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 rounded-b-[3rem] shadow-lg text-white relative">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-full border-4 border-white/20 overflow-hidden bg-white/10 backdrop-blur-md">
                        {lineUser?.picture_url ? (
                            <img src={lineUser.picture_url} className="w-full h-full object-cover" alt="Profile" />
                        ) : (
                            <FiUser size={32} className="m-auto mt-2" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">{lineUser?.display_name || 'ลูกค้า'}</h2>
                        <span className="text-orange-100 text-xs flex items-center gap-1">
                            <FiCheckCircle size={14} className={isFollowing ? 'text-green-300' : 'text-orange-300'} />
                            {isFollowing ? 'เป็นเพื่อนกับ LINE OA แล้ว' : 'ยังไม่ได้ติดตาม LINE OA'}
                        </span>
                    </div>
                </div>

                <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20">
                    <p className="text-orange-100 text-xs mb-1">คะแนนสะสมคงเหลือ</p>
                    <div className="flex items-end gap-2">
                        <span className="text-5xl font-black text-white">{points}</span>
                        <span className="text-orange-200 mb-2 font-bold text-sm">แต้ม</span>
                    </div>

                    <div className="mt-4 bg-black/10 rounded-full h-2 overflow-hidden">
                        <div className="bg-white rounded-full h-full" style={{ width: `${Math.min((points * 2), 100)}%` }}></div>
                    </div>
                </div>

                <FiZap className="absolute top-8 right-8 text-white/10" size={80} />
            </div>

            {/* List Content */}
            <div className="px-6 -mt-6 flex-1 overflow-y-auto pt-2">
                {activeTab === 'earn' && (
                    <>
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm mb-8">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FiGift className="text-orange-500" /> ของรางวัลที่แลกได้
                            </h3>

                            {loading ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {promotions.map(promo => (
                                        <div key={promo.id} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-orange-50/50 transition-colors group">
                                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-white shadow-sm flex-shrink-0">
                                                {promo.image_url ? (
                                                    <img src={promo.image_url} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-orange-200 bg-orange-50">
                                                        <FiGift size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-sm text-gray-800 truncate">{promo.title}</h4>
                                                <p className="text-xs text-gray-400 font-medium">{promo.points_required} แต้ม</p>
                                            </div>
                                            <button
                                                onClick={() => handleRedeem(promo)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95
                                                    ${points >= promo.points_required
                                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-100'
                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                แลก
                                            </button>
                                        </div>
                                    ))}
                                    {promotions.length === 0 && (
                                        <p className="text-center text-gray-400 py-4 text-sm">ยังไม่มีของรางวัลในขณะนี้ค่ะ</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mb-20">
                            <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FiClock className="text-orange-500" /> ประวัติคะแนน
                            </h3>
                            <div className="space-y-1 bg-white rounded-2xl p-4">
                                {history.slice(0, 10).map(item => (
                                    <div key={item.id} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                                        <div>
                                            <p className="text-sm font-bold text-gray-700">{item.description}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleDateString('th-TH')}</p>
                                        </div>
                                        <div className={`font-black text-sm ${item.type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
                                            {item.type === 'earn' ? '+' : '-'}{item.points}
                                        </div>
                                    </div>
                                ))}
                                {history.length === 0 && (
                                    <p className="text-center text-gray-400 py-4 text-xs italic">ยังไม่มีประวัติการสะสมคะแนนค่ะ</p>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'coupons' && (
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm mb-20 min-h-[400px]">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <FiStar className="text-orange-500" /> คูปองของฉัน
                        </h3>
                        {coupons.length > 0 ? (
                            <div className="space-y-6">
                                {coupons.map(coupon => (
                                    <div key={coupon.id} className={`p-5 rounded-3xl border-2 transition-all ${coupon.status === 'used' ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-orange-50/30 border-orange-100 shadow-sm'}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-orange-500 shadow-sm">
                                                    <FiGift size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-gray-800">{coupon.promotion_title}</h4>
                                                    <p className="text-[10px] text-gray-400">แลกเมื่อ: {new Date(coupon.redeemed_at).toLocaleDateString('th-TH')}</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${coupon.status === 'used' ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-600'}`}>
                                                {coupon.status === 'used' ? 'ใช้แล้ว' : 'พร้อมใช้งาน'}
                                            </span>
                                        </div>

                                        {coupon.status === 'active' && (
                                            <div className="bg-white rounded-2xl p-4 border border-orange-100/50 text-center">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Coupon Code</p>
                                                <p className="text-2xl font-black text-orange-600 tracking-widest">{coupon.coupon_code}</p>
                                                <p className="text-[10px] text-orange-400 mt-2 font-medium italic">*กรุณายื่นรหัสนี้ให้พนักงานเพื่อแลกรับสิทธิ์</p>
                                            </div>
                                        )}
                                        {coupon.status === 'used' && (
                                            <p className="text-center text-xs text-gray-400 font-medium py-2">
                                                ใช้สิทธิ์ไปเมื่อ: {new Date(coupon.used_at).toLocaleDateString('th-TH')}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 opacity-30">
                                <FiStar size={64} className="mb-4 text-orange-200" />
                                <p className="text-sm font-bold text-gray-400">ยังไม่มีคูปองที่แลกไว้ค่ะ</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'member' && (
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm text-center mb-20">
                        <div className="w-24 h-24 rounded-full border-4 border-orange-100 mx-auto mb-6 flex items-center justify-center bg-orange-50">
                            <FiUser size={48} className="text-orange-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{lineUser?.display_name}</h3>
                        <p className="text-xs text-gray-400 mb-8 tracking-widest uppercase">Loyalty Member Since 2026</p>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-gray-50 p-4 rounded-2xl">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">รายการรวม</p>
                                <p className="text-lg font-black text-slate-800">{history.length}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">คูปองทั้งหมด</p>
                                <p className="text-lg font-black text-slate-800">{coupons.length}</p>
                            </div>
                        </div>

                        <p className="text-xs text-gray-400 italic">"หน้าสมาชิกกำลังปรับปรุงฟีเจอร์ใหม่ๆ เร็วๆ นี้ค่ะ"</p>
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-lg border-t border-gray-100 p-4 pb-6 flex justify-around items-center z-50 shadow-2xl">
                <button
                    onClick={() => setActiveTab('earn')}
                    className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'earn' ? 'text-orange-500 scale-110' : 'text-gray-300'}`}
                >
                    <FiAward size={22} strokeWidth={activeTab === 'earn' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold">สะสมแต้ม</span>
                </button>
                <div className="w-px h-6 bg-gray-100"></div>
                <button
                    onClick={() => setActiveTab('coupons')}
                    className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'coupons' ? 'text-orange-500 scale-110' : 'text-gray-300'}`}
                >
                    <FiStar size={22} strokeWidth={activeTab === 'coupons' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold">คูปอง</span>
                </button>
                <div className="w-px h-6 bg-gray-100"></div>
                <button
                    onClick={() => setActiveTab('member')}
                    className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'member' ? 'text-orange-500 scale-110' : 'text-gray-300'}`}
                >
                    <FiUser size={22} strokeWidth={activeTab === 'member' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold">สมาชิก</span>
                </button>
            </div>
        </div>
    );
};

export default CustomerLoyalty;
