import React, { useState } from 'react';
import { api } from '../../services/api';

const LineConnectSettings = ({ settings, handleChange }) => {
    const [showGuide, setShowGuide] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);

    const handleAutoSetup = async () => {
        if (!settings.line_channel_access_token) {
            alert('⚠️ กรุณากรอก Access Token ก่อนนะคะ');
            return;
        }

        const confirmSetup = window.confirm("ระบบจะบันทึกค่าและติดตั้ง Rich Menu อัตโนมัติ ยืนยันไหมคะ?");
        if (!confirmSetup) return;

        setSetupLoading(true);
        try {
            // 1. Save current state keys to DB first (to ensure backend has latest)
            await api.post('/admin/line/settings', {
                channelId: settings.line_channel_id,
                channelSecret: settings.line_channel_secret,
                accessToken: settings.line_channel_access_token,
                liffId: settings.line_liff_id,
                liffIdLoyalty: settings.line_liff_id_loyalty
            });

            // 2. Trigger Auto Setup
            await api.post('/admin/line/setup-richmenu');
            alert('✅ ติดตั้ง Rich Menu สำเร็จเรียบร้อยค่ะ! \nลองเช็คในมือถือได้เลย');
        } catch (error) {
            console.error(error);
            alert('❌ เกิดข้อผิดพลาด: ' + (error.message || 'Unknown error'));
        } finally {
            setSetupLoading(false);
        }
    };

    return (
        <section className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-lg">💬</div>
                <div>
                    <h3 className="font-bold text-slate-900 leading-none">เชื่อมต่อ LINE OA</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">LINE Messaging API & LIFF Integration</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[24px] shadow-sm border border-slate-100 space-y-8">
                {/* Header with Auto-Connect Button */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
                    <div>
                        <h4 className="font-bold text-slate-800">การตั้งค่าการเชื่อมต่อ</h4>
                        <p className="text-sm text-slate-500 mt-1">
                            กรอกข้อมูลจาก <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-green-500 font-bold hover:underline">LINE Developers Console</a> เพื่อเปิดใช้งานระบบ
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleAutoSetup}
                            disabled={setupLoading}
                            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${setupLoading ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20'}`}
                        >
                            {setupLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Installing...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀 One-Click Setup</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowGuide(true)}
                            className="px-5 py-2.5 bg-green-50 text-green-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-green-100 transition-all flex items-center gap-2"
                        >
                            <span>📚 คู่มือการหา Key</span>
                        </button>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Channel Access Token (Long-lived)</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="line_channel_access_token"
                                value={settings.line_channel_access_token || ''}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pl-10 focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none font-medium text-slate-900 transition-all text-sm font-mono tracking-wide"
                                placeholder="Enter Channel Access Token"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔑</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Channel ID</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="line_channel_id"
                                value={settings.line_channel_id || ''}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pl-10 focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none font-medium text-slate-900 transition-all text-sm font-mono"
                                placeholder="165XXXXXXX"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🆔</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Channel Secret</label>
                        <div className="relative">
                            <input
                                type="password"
                                name="line_channel_secret"
                                value={settings.line_channel_secret || ''}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pl-10 focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none font-medium text-slate-900 transition-all text-sm font-mono"
                                placeholder="Enter Channel Secret"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
                        </div>
                    </div>

                    <div className="space-y-1.5 md:col-span-2 border-t border-slate-100 pt-6 mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">LIFF ID (Order System) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="line_liff_id"
                                        value={settings.line_liff_id || ''}
                                        onChange={handleChange}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pl-10 focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none font-medium text-slate-900 transition-all text-sm font-mono"
                                        placeholder="165XXXXXXX-XXXXXXXX"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🍔</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">LIFF ID (Loyalty / Member) <span className="text-slate-400 font-normal">(Optional)</span></label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="line_liff_id_loyalty"
                                        value={settings.line_liff_id_loyalty || ''}
                                        onChange={handleChange}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pl-10 focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none font-medium text-slate-900 transition-all text-sm font-mono"
                                        placeholder="165XXXXXXX-XXXXXXXX"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">👑</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 ml-1 italic mt-2">
                            * ใส่ ID เดียวเพื่อใช้ระบบ Combined App (แนะนำ) หรือใส่แยก 2 ID ถ้าต้องการแยก App กัน
                        </p>
                    </div>
                </div>
            </div>

            {/* Guide Modal */}
            {showGuide && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">วิธีค้นหา LINE Keys</h3>
                                <p className="text-slate-500 text-sm mt-1">ทำตามขั้นตอนง่ายๆ เพื่อเชื่อมต่อร้านของคุณ</p>
                            </div>
                            <button
                                onClick={() => setShowGuide(false)}
                                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-12">
                            {/* Step 1 */}
                            <div className="space-y-4">
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold uppercase tracking-widest">Step 1</span>
                                <h4 className="text-lg font-bold text-slate-800">เข้าสู่ระบบ LINE Developers Console</h4>
                                <p className="text-slate-600">
                                    ไปที่ <a href="https://developers.line.biz/" target="_blank" className="text-blue-500 underline">https://developers.line.biz/</a> แล้ว Log in ด้วย LINE Account ของคุณ จากนั้นเลือก Provider และ Channel ที่สร้างไว้ (หรือสร้างใหม่ถ้ายังไม่มี)
                                </p>
                            </div>

                            {/* Step 2 */}
                            <div className="space-y-4">
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold uppercase tracking-widest">Step 2</span>
                                <h4 className="text-lg font-bold text-slate-800">Basic Settings » Channel Secret</h4>
                                <p className="text-slate-600">
                                    ในแท็บ <strong>Basic Settings</strong> เลื่อนลงมาจะเจอหัวข้อ <strong>Channel Secret</strong> ให้กดปุ่ม Issue เพื่อดูรหัสและก๊อปปี้มาใส่
                                </p>
                                <div className="bg-slate-100 rounded-xl p-8 border-2 border-dashed border-slate-200 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">🔒</div>
                                        <p className="text-slate-400 font-bold">วางรูป Screenshot ที่นี่ (Channel Secret)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="space-y-4">
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold uppercase tracking-widest">Step 3</span>
                                <h4 className="text-lg font-bold text-slate-800">Messaging API » Access Token</h4>
                                <p className="text-slate-600">
                                    ไปที่แท็บ <strong>Messaging API</strong> เลื่อนลงล่างสุดที่หัวข้อ <strong>Channel Access Token (long-lived)</strong> กดปุ่ม Issue แล้วก๊อปปี้รหัสยาวๆ มาใส่
                                </p>
                                <div className="bg-slate-100 rounded-xl p-8 border-2 border-dashed border-slate-200 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">🔑</div>
                                        <p className="text-slate-400 font-bold">วางรูป Screenshot ที่นี่ (Access Token)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setShowGuide(false)}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                            >
                                เข้าใจแล้ว
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default LineConnectSettings;
