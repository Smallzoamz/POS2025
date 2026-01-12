import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
    FiGift, FiPlus, FiEdit2, FiTrash2, FiCalendar,
    FiCheckCircle, FiXCircle, FiImage, FiAward, FiArrowLeft
} from 'react-icons/fi';

const Promotions = () => {
    const navigate = useNavigate();
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        pointsRequired: 0,
        imageUrl: '',
        startDate: '',
        endDate: '',
        isActive: true,
        discountType: 'none',
        discountValue: 0,
        maxRedemptions: '',
        userRedemptionLimit: '',
        minSpendAmount: 0
    });

    useEffect(() => {
        fetchPromotions();
    }, []);

    const fetchPromotions = async () => {
        try {
            const data = await api.getAdminPromotions();
            setPromotions(data);
        } catch (err) {
            console.error('Failed to fetch promotions', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (promo) => {
        setEditingPromo(promo);
        setFormData({
            title: promo.title,
            description: promo.description || '',
            pointsRequired: promo.points_required,
            imageUrl: promo.image_url || '',
            startDate: promo.start_date ? promo.start_date.split('T')[0] : '',
            endDate: promo.end_date ? promo.end_date.split('T')[0] : '',
            isActive: promo.is_active,
            discountType: promo.discount_type || 'none',
            discountValue: promo.discount_value || 0,
            maxRedemptions: promo.max_redemptions || '',
            userRedemptionLimit: promo.user_redemption_limit || '',
            minSpendAmount: promo.min_spend_amount || 0
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Convert to snake_case for API
            const payload = {
                title: formData.title,
                description: formData.description,
                points_required: formData.pointsRequired,
                image_url: formData.imageUrl,
                start_date: formData.startDate,
                end_date: formData.endDate,
                is_active: formData.isActive,
                discount_type: formData.discountType,
                discount_value: formData.discountValue,
                max_redemptions: formData.maxRedemptions === '' ? null : parseInt(formData.maxRedemptions),
                user_redemption_limit: formData.userRedemptionLimit === '' ? null : parseInt(formData.userRedemptionLimit),
                min_spend_amount: parseInt(formData.minSpendAmount) || 0
            };

            if (editingPromo) {
                await api.updatePromotion(editingPromo.id, payload);
            } else {
                await api.addPromotion(payload);
            }
            setShowModal(false);
            fetchPromotions();
            resetForm();
        } catch (err) {
            alert('บันทึกข้อมูลไม่สำเร็จ');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('คุณต้องการลบโปรโมชั่นนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้ค่ะ')) return;
        try {
            await api.deletePromotion(id);
            fetchPromotions();
        } catch (err) {
            alert('ลบข้อมูลไม่สำเร็จ');
        }
    };

    const resetForm = () => {
        setEditingPromo(null);
        setFormData({
            title: '',
            description: '',
            pointsRequired: 0,
            imageUrl: '',
            startDate: '',
            endDate: '',
            isActive: true,
            discountType: 'none',
            discountValue: 0,
            maxRedemptions: '',
            userRedemptionLimit: '',
            minSpendAmount: 0
        });
    };

    return (
        <div className="p-4 md:p-8 bg-[#fdfaf8] min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/tables')}
                        className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-orange-100 flex items-center justify-center text-orange-500 hover:bg-orange-50 transition-all active:scale-90"
                    >
                        <FiArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <FiGift className="text-orange-500" /> จัดการโปรโมชั่น & ของรางวัล
                        </h1>
                        <p className="text-gray-500 mt-1">กำหนดสิทธิพิเศษและของรางวัลสำหรับการสะสมแต้ม</p>
                    </div>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-orange-200 flex items-center gap-2 transition-all active:scale-95"
                >
                    <FiPlus /> เพิ่มของรางวัลใหม่
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {promotions.map(promo => (
                        <div key={promo.id} className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all border border-orange-50 group">
                            <div className="h-48 bg-orange-100 relative overflow-hidden">
                                {promo.image_url ? (
                                    <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-orange-300">
                                        <FiImage size={48} />
                                    </div>
                                )}
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm">
                                    <span className="text-orange-600 font-bold flex items-center gap-1">
                                        <FiAward /> {promo.points_required} แต้ม
                                    </span>
                                </div>
                                {promo.min_spend_amount > 0 && (
                                    <div className="absolute bottom-4 left-4 bg-orange-600/90 backdrop-blur-md px-3 py-1 rounded-full shadow-sm text-xs text-white z-10">
                                        ซื้อขั้นต่ำ {promo.min_spend_amount}.-
                                    </div>
                                )}
                                {!promo.is_active && (
                                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] flex items-center justify-center text-white font-bold text-xl">
                                        ❌ ปิดการใช้งาน
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">{promo.title}</h3>
                                <p className="text-gray-500 text-sm line-clamp-2 mb-4 h-10">{promo.description}</p>

                                <div className="flex items-center gap-4 text-xs text-gray-400 mb-6">
                                    <span className="flex items-center gap-1">
                                        <FiCalendar /> {promo.start_date ? new Date(promo.start_date).toLocaleDateString('th-TH') : 'ไม่มีกำหนดเริ่ม'}
                                    </span>
                                    <span>→</span>
                                    <span className="flex items-center gap-1">
                                        <FiCalendar /> {promo.end_date ? new Date(promo.end_date).toLocaleDateString('th-TH') : 'ไม่มีวันหมดอายุ'}
                                    </span>
                                </div>

                                <div className="flex gap-4 text-xs font-medium text-gray-500 mb-4 bg-gray-50 p-3 rounded-xl">
                                    <div className="flex-1 text-center border-r border-gray-200">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">จำกัดทั้งหมด</p>
                                        <p className="text-gray-800">{promo.max_redemptions ? `${promo.max_redemptions} สิทธิ์` : 'ไม่จำกัด'}</p>
                                    </div>
                                    <div className="flex-1 text-center">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">ต่อคน</p>
                                        <p className="text-gray-800">{promo.user_redemption_limit ? `${promo.user_redemption_limit} ครั้ง` : 'ไม่จำกัด'}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(promo)}
                                        className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-600 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                                    >
                                        <FiEdit2 size={16} /> แก้ไข
                                    </button>
                                    <button
                                        onClick={() => handleDelete(promo.id)}
                                        className="bg-red-50 hover:bg-red-100 text-red-500 p-3 rounded-xl transition-colors"
                                    >
                                        <FiTrash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-300 custom-scrollbar">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 sticky top-0 bg-white z-10 pb-2 border-b border-gray-100 flex justify-between items-center">
                                <span>{editingPromo ? '✏️ แก้ไขของรางวัล' : '✨ สร้างของรางวัลใหม่'}</span>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><FiXCircle size={24} /></button>
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-3">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อของรางวัล / โปรโมชั่น</label>
                                        <input
                                            type="text" required
                                            className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-orange-500 rounded-xl px-4 py-2.5 outline-none transition-all text-sm font-medium"
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="เช่น ส่วนลดเงินสด 50 บาท"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">แต้มที่ต้องใช้</label>
                                        <input
                                            type="number" required
                                            className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-orange-500 rounded-xl px-4 py-2.5 outline-none transition-all text-sm font-medium"
                                            value={formData.pointsRequired}
                                            onChange={e => setFormData({ ...formData, pointsRequired: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">สถานะ</label>
                                        <select
                                            className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-orange-500 rounded-xl px-4 py-2.5 outline-none transition-all cursor-pointer text-sm font-medium"
                                            value={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                                        >
                                            <option value="true">🟢 เปิดใช้งาน</option>
                                            <option value="false">🔴 ปิดใช้งาน</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Discount & Limits (Side by Side) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
                                    {/* Discount Settings */}
                                    <div className="bg-orange-50/50 rounded-2xl p-3 border border-orange-100">
                                        <h4 className="text-xs font-bold text-orange-600 mb-2 flex items-center gap-1">🎯 ตั้งค่าส่วนลด</h4>
                                        <div className="space-y-2">
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-500 mb-1">ประเภท</label>
                                                <select
                                                    className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-orange-500 outline-none text-xs"
                                                    value={formData.discountType}
                                                    onChange={e => setFormData({ ...formData, discountType: e.target.value, discountValue: 0 })}
                                                >
                                                    <option value="none">ไม่ใช้ส่วนลด</option>
                                                    <option value="fixed">ลด (บาท)</option>
                                                    <option value="percent">ลด (%)</option>
                                                    <option value="fixed_price">ราคาเดียว</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">มูลค่า</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 outline-none text-xs disabled:opacity-50"
                                                        value={formData.discountValue}
                                                        onChange={e => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                                                        disabled={formData.discountType === 'none'}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">ขั้นต่ำ (บาท)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 outline-none text-xs"
                                                        value={formData.minSpendAmount}
                                                        onChange={e => setFormData({ ...formData, minSpendAmount: parseInt(e.target.value) || 0 })}
                                                        placeholder="0 = ไม่มี"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Limits Settings */}
                                    <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100">
                                        <h4 className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">🔢 การจำกัดสิทธิ์</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-500 mb-1">รวมทั้งหมด (ครั้ง)</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 outline-none text-xs"
                                                    value={formData.maxRedemptions}
                                                    onChange={e => setFormData({ ...formData, maxRedemptions: e.target.value })}
                                                    placeholder="ไม่จำกัด"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-500 mb-1">ต่อคน (ครั้ง)</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 outline-none text-xs"
                                                    value={formData.userRedemptionLimit}
                                                    onChange={e => setFormData({ ...formData, userRedemptionLimit: e.target.value })}
                                                    placeholder="ไม่จำกัด"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-blue-400 mt-2 italic">* เว้นว่าง = ไม่จำกัด</p>
                                    </div>
                                </div>

                                {/* Details & Media */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">URL รูปภาพ</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-orange-500 rounded-xl px-4 py-2 outline-none transition-all text-xs"
                                        value={formData.imageUrl}
                                        onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">คำอธิบาย</label>
                                        <textarea
                                            className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-orange-500 rounded-xl px-4 py-2 outline-none transition-all h-[86px] resize-none text-xs"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="เงื่อนไขการใช้"
                                        ></textarea>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">วันที่เริ่ม</label>
                                            <input
                                                type="date"
                                                className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-orange-500 rounded-xl px-4 py-1.5 outline-none transition-all text-xs"
                                                value={formData.startDate}
                                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">วันหมดอายุ</label>
                                            <input
                                                type="date"
                                                className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-orange-500 rounded-xl px-4 py-1.5 outline-none transition-all text-xs"
                                                value={formData.endDate}
                                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-all text-sm"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200 transition-all active:scale-95 text-sm"
                                    >
                                        บันทึกข้อมูล
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Promotions;
