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
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [liffError, setLiffError] = useState(null);

    const initLiff = async () => {
        setLoading(true);
        const liffId = import.meta.env.VITE_LIFF_ID;

        if (!liffId) {
            setLiffError('ยังไม่ได้ตั้งค่า VITE_LIFF_ID ในระบบ (Render Environment)');
            setLoading(false);
            return;
        }

        try {
            await liff.init({ liffId });
            console.log('✅ LIFF initialized');

            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                // Sync profile with backend
                const loyaltyData = {
                    lineUserId: profile.userId,
                    displayName: profile.displayName,
                    pictureUrl: profile.pictureUrl
                };

                const syncRes = await api.syncLoyaltyProfile(loyaltyData);
                setLineUser(syncRes);
                setPoints(syncRes.points || 0);
                setIsFollowing(syncRes.is_following || false);

                const [fullProfile, activePromos] = await Promise.all([
                    api.getLoyaltyProfile(profile.userId),
                    api.getActivePromotions()
                ]);

                setHistory(fullProfile.transactions || []);
                setPromotions(activePromos || []);
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

    const handleLogin = () => {
        liff.login();
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
                alert('แลกรางวัลสำเร็จ! 🎉 ระบบหักแต้มแล้ว กรุณาแจ้งพนักงานเพื่อใช้สิทธิ์นะคะ');
                // Refresh history
                const profile = await api.getLoyaltyProfile(lineUser.line_user_id);
                setHistory(profile.transactions || []);
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

            {/* List of Rewards */}
            <div className="px-6 -mt-6 flex-1 overflow-y-auto pt-2">
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
                        {history.map(item => (
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
            </div>

            {/* Bottom Nav */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 p-4 pb-6 flex justify-around items-center">
                <button className="text-orange-500 flex flex-col items-center gap-1">
                    <FiAward size={22} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">สะสมแต้ม</span>
                </button>
                <div className="w-px h-6 bg-gray-100"></div>
                <button className="text-gray-300 flex flex-col items-center gap-1 hover:text-orange-300 transition-colors">
                    <FiStar size={22} />
                    <span className="text-[10px] font-bold">คูปอง</span>
                </button>
                <div className="w-px h-6 bg-gray-100"></div>
                <button className="text-gray-300 flex flex-col items-center gap-1 hover:text-orange-300 transition-colors">
                    <FiUser size={22} />
                    <span className="text-[10px] font-bold">สมาชิก</span>
                </button>
            </div>
        </div>
    );
};

export default CustomerLoyalty;
