import React, { useState } from 'react';
import { api } from '../../services/api';

const GuideModal = ({ onClose }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "1. เข้าสู่ระบบ & สร้าง Provider",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. ไปที่ <a href="https://developers.line.biz/" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold underline">LINE Developers Console</a><br />
                        2. กดปุ่ม <strong>Log in</strong> (ใช้ไลน์ส่วนตัวได้เลย)<br />
                        3. กดปุ่ม <strong>Create a new provider</strong> (ตั้งชื่อร้านของคุณ)<br />
                        4. กด <strong>Create</strong>
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">🏢</span>
                        <p className="text-xs text-slate-400 mt-2">สร้าง "บริษัท/ร้านค้า" (Provider) ก่อนเป็นอันดับแรก</p>
                    </div>
                </div>
            )
        },
        {
            title: "2. สร้าง Messaging API Channel",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. เลือก Provider ที่เพิ่งสร้าง<br />
                        2. กดปุ่ม <strong>Create a new channel</strong><br />
                        3. เลือกประเภท <strong>Messaging API</strong><br />
                        4. กรอกข้อมูลให้ครบ (ชื่อร้าน, รูปโลโก้, ประเภทธุรกิจ)<br />
                        5. ติ๊กถูกยอมรับข้อตกลง แล้วกด <strong>Create</strong>
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">🤖</span>
                        <p className="text-xs text-slate-400 mt-2">Channel นี้คือ "น้องบอท" ที่จะคุยกับลูกค้า</p>
                    </div>
                </div>
            )
        },
        {
            title: "3. เอา Channel ID & Secret",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. กดเข้าไปที่ Channel ที่เพิ่งสร้าง<br />
                        2. ไปที่แท็บ <strong>Basic Settings</strong><br />
                        3. เลื่อนลงมาหา <strong>Channel ID</strong> (ก๊อปปี้เก็บไว้)<br />
                        4. เลื่อนลงมาหา <strong>Channel Secret</strong> -&gt; กดปุ่ม <strong>Issue</strong> (ก๊อปปี้เก็บไว้)
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200 text-slate-500">
                        <p>🆔 Channel ID: <strong>165xxxxxxx</strong></p>
                        <p>🔒 Channel Secret: <strong>abcd1234xxxx...</strong></p>
                    </div>
                </div>
            )
        },
        {
            title: "4. เอา Access Token",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. คลิกที่แท็บ <strong>Messaging API</strong> ด้านบน<br />
                        2. เลื่อนลงล่างสุด หาหัวข้อ <strong>Channel Access Token</strong><br />
                        3. กดปุ่ม <strong>Issue</strong> เพื่อสร้าง Token ยาวๆ<br />
                        4. ก๊อปปี้รหัสยาวๆ นั้นมาใส่ในช่อง <strong>Access Token</strong> ในระบบนี้
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">🔑</span>
                        <p className="text-xs text-slate-400 mt-2">Access Token เปรียบเหมือน "กุญแจหลัก" ในการสั่งงานบอท</p>
                    </div>
                </div>
            )
        },
        {
            title: "5. สร้าง LIFF App (สำหรับเปิดเมนู)",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. กลับไปหน้า Provider (กดชื่อ Provider ด้านซ้ายบน)<br />
                        2. กด <strong>Create a new channel</strong> -&gt; เลือก <strong>LIFF</strong><br />
                        3. ตั้งชื่อแอป (เช่น "สั่งอาหาร")<br />
                        4. <strong>Scopes:</strong> เลือก <code>chat_message.write</code>, <code>profile</code>, <code>openid</code><br />
                        5. <strong>Scan QR:</strong> ปิด (Off)<br />
                        6. กด Create -&gt; จะได้ <strong>LIFF ID</strong> (เช่น 165xxxx-xxxx)<br />
                        ** นำ LIFF ID มาใส่ช่อง "LIFF ID (Order System)"
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">📱</span>
                        <p className="text-xs text-slate-400 mt-2">LIFF คือหน้าเว็บสั่งอาหารที่จะเด้งขึ้นมาใน LINE</p>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">STEP {step + 1}/{steps.length}</span>
                        <h3 className="text-xl font-bold text-slate-900 mt-1">{steps[step].title}</h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">✕</button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1">
                    {steps[step].content}
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <button
                        type="button"
                        onClick={() => setStep(s => Math.max(0, s - 1))}
                        disabled={step === 0}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${step === 0 ? 'opacity-0 pointer-events-none' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                    >
                        ← ย้อนกลับ
                    </button>

                    {/* Dots */}
                    <div className="flex gap-2">
                        {steps.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-orange-500 w-6' : 'bg-slate-300'}`}></div>
                        ))}
                    </div>

                    {step < steps.length - 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
                            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                        >
                            ถัดไป →
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"
                        >
                            เข้าใจแล้ว! 🎉
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

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
            await api.post('/admin/line/setup-richmenu', {});
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
                        <p className="text-[10px] text-slate-400 ml-1 italic">
                            * ใส่ ID เดียวเพื่อใช้ระบบ Combined App (แนะนำ) หรือใส่แยก 2 ID ถ้าต้องการแยก App กัน
                        </p>
                    </div>
                </div>
            </div>

            {/* Guide Modal - Interactive Carousel */}
            {showGuide && (
                <GuideModal onClose={() => setShowGuide(false)} />
            )}
        </section>
    );
};

export default LineConnectSettings;
