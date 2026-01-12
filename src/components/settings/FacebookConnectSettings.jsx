import React, { useState } from 'react';

const GuideModal = ({ onClose }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "1. สร้างและตั้งค่าแอพ",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. ไปที่ <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold underline">Meta for Developers</a><br />
                        2. กด <strong>My Apps</strong> &gt; <strong>Create App</strong><br />
                        3. เลือก <strong>Other</strong> &gt; <strong>Business</strong><br />
                        4. กรอกชื่อแอพ (เช่น POS Chatbot) และอีเมล<br />
                        5. กด <strong>Create App</strong>
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">🏗️</span>
                        <p className="text-xs text-slate-400 mt-2">สร้าง App เพื่อเป็นตัวกลางเชื่อมต่อ</p>
                    </div>
                </div>
            )
        },
        {
            title: "2. เพิ่ม Messenger Platform",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. ในหน้า Dashboard ของแอพ หาหัวข้อ <strong>Messenger</strong><br />
                        2. กดปุ่ม <strong>Set up</strong><br />
                        3. ระบบจะพาไปหน้า Configuration เพื่อเตรียมเชื่อมต่อ
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">💬</span>
                        <p className="text-xs text-slate-400 mt-2">เปิดใช้งานระบบแชท</p>
                    </div>
                </div>
            )
        },
        {
            title: "3. รับ Page Access Token",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. ไปที่ส่วน <strong>Access Tokens</strong><br />
                        2. กด <strong>Add or Remove Pages</strong> &gt; เลือกเพจร้านค้าของคุณ<br />
                        3. กดอนุญาตสิทธิ์ให้เรียบร้อย<br />
                        4. กดปุ่ม <strong>Generate Token</strong> หลังชื่อเพจ<br />
                        5. ⚠️ <strong>Copy Token เก็บไว้ทันที!</strong> (ต้องใช้อันนี้)
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">🔑</span>
                        <p className="text-xs text-slate-400 mt-2">Access Token คือกุญแจสำคัญ</p>
                    </div>
                </div>
            )
        },
        {
            title: "4. ตั้งค่า Webhook",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. เลื่อนลงมาที่ <strong>Webhooks</strong> &gt; กด <strong>Add Callback URL</strong><br />
                        2. <strong>Callback URL:</strong> ใส่ URL ร้านตามด้วย <code>/webhook/facebook</code><br />
                        3. <strong>Verify Token:</strong> ตั้งเอง (เช่น <code>pos2025secret</code>) และต้องนำมาใส่ใน POS นี้ด้วย<br />
                        4. ⚠️ <strong>กด Save ใน POS ก่อน!</strong> แล้วค่อยกด <strong>Verify and Save</strong> ใน Facebook
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">🔗</span>
                        <p className="text-xs text-slate-400 mt-2">เชื่อมต่อให้ Facebook ส่งข้อความเข้าระบบ</p>
                    </div>
                </div>
            )
        },
        {
            title: "5. เลือกเหตุการณ์ (Subscriptions)",
            content: (
                <div className="space-y-4">
                    <p className="text-slate-600">
                        1. ในส่วน Webhooks (ตรงชื่อเพจ) กด <strong>Add Subscriptions</strong><br />
                        2. ติ๊กถูก <code>messages</code> และ <code>messaging_postbacks</code><br />
                        3. กด <strong>Save</strong>
                    </p>
                    <div className="bg-slate-100 p-4 rounded-xl text-center border-2 border-dashed border-slate-200">
                        <span className="text-4xl">📡</span>
                        <p className="text-xs text-slate-400 mt-2">บอก Facebook ว่าจะรับข้อมูลอะไรบ้าง</p>
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
                        <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">STEP {step + 1}/{steps.length}</span>
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
                            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-blue-500 w-6' : 'bg-slate-300'}`}></div>
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
                            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                        >
                            พร้อมลุย! 🎉
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const FacebookConnectSettings = ({ settings, handleChange }) => {
    const [showGuide, setShowGuide] = useState(false);

    return (
        <section className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg">📘</div>
                <div>
                    <h3 className="font-bold text-slate-900 leading-none">เชื่อมต่อ Facebook Page</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Messenger API Integration</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[24px] shadow-sm border border-slate-100 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
                    <div>
                        <h4 className="font-bold text-slate-800">การตั้งค่า Facebook Chat Bot</h4>
                        <p className="text-sm text-slate-500 mt-1">
                            นำข้อมูลจาก <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">Meta for Developers</a> มาใส่ที่นี่
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowGuide(true)}
                            className="px-5 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-2"
                        >
                            <span>📚 คู่มือการติดตั้ง</span>
                        </button>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Page Access Token</label>
                        <div className="relative">
                            <input
                                type="password"
                                name="facebook_page_access_token"
                                value={settings.facebook_page_access_token || ''}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pl-10 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium text-slate-900 transition-all text-sm font-mono tracking-wide"
                                placeholder="EAAxxxx..."
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔑</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Page ID</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="facebook_page_id"
                                value={settings.facebook_page_id || ''}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pl-10 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium text-slate-900 transition-all text-sm font-mono"
                                placeholder="1000xxxx"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🆔</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Verify Token (ที่คุณตั้งเอง)</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="facebook_verify_token"
                                value={settings.facebook_verify_token || ''}
                                onChange={handleChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 pl-10 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium text-slate-900 transition-all text-sm"
                                placeholder="my_secure_token_2025"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-800">
                        <strong>💡 Tip:</strong> Verify Token คือรหัสที่คุณต้องตั้งขึ้นมาเอง และนำไปกรอกในช่อง "Verify Token" ในหน้า Webhook Settings ของ Facebook App เพื่อยืนยันว่าเป็นคุณจริงๆ
                    </p>
                </div>
            </div>

            {/* Guide Modal */}
            {showGuide && (
                <GuideModal onClose={() => setShowGuide(false)} />
            )}
        </section>
    );
};

export default FacebookConnectSettings;
