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
        isActive: true
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
            isActive: promo.is_active
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPromo) {
                await api.updatePromotion(editingPromo.id, formData);
            } else {
                await api.addPromotion(formData);
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
            isActive: true
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
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">
                                {editingPromo ? 'แก้ไขของรางวัล' : 'สร้างของรางวัลใหม่'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อของรางวัล / โปรโมชั่น</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="เช่น ส่วนลดเงินสด 50 บาท"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">แต้มที่ต้องใช้</label>
                                        <input
                                            type="number" required
                                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                            value={formData.pointsRequired}
                                            onChange={e => setFormData({ ...formData, pointsRequired: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                                        <select
                                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                                            value={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                                        >
                                            <option value="true">เปิดใช้งาน</option>
                                            <option value="false">ปิดใช้งาน</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                                    <textarea
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all h-24 resize-none"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="รายละเอียดเพิ่มเติม หรือเงื่อนไขการใช้"
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL รูปภาพ</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                        value={formData.imageUrl}
                                        onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">วันที่เริ่ม</label>
                                        <input
                                            type="date"
                                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                            value={formData.startDate}
                                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุ</label>
                                        <input
                                            type="date"
                                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                            value={formData.endDate}
                                            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-[1.5rem] transition-all"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-[1.5rem] shadow-lg shadow-orange-200 transition-all active:scale-95"
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
