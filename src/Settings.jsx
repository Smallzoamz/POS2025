import React, { useState, useEffect } from 'react';
import MasterLayout from './layouts/MasterLayout';
import { api } from './services/api';
import QRCode from 'react-qr-code';

const Settings = () => {
    const [settings, setSettings] = useState({
        shop_name: '',
        shop_address: '',
        shop_phone: '',
        tax_rate: '7',
        service_charge: '0',
        late_hourly_deduction: '0',
        absent_daily_deduction: '0',
        leave_excess_deduction: '0',
        max_leave_days: '0',
        holiday_multiplier: '2.0',
        promptpay_number: '',
        public_url: '',
        enable_receipt_printer: 'true'
    });
    const [network, setNetwork] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [data, netData] = await Promise.all([
                api.getSettings(),
                api.getNetworkStatus()
            ]);
            // Merge with defaults to ensure controlled inputs
            setSettings(prev => ({ ...prev, ...data }));
            setNetwork(netData);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await api.saveSettings(settings);
            alert('✅ บันทึกการตั้งค่าเรียบร้อยแล้ว');
        } catch (error) {
            console.error(error);
            alert('❌ เกิดข้อผิดพลาดในการบันทึก');
        }
    };

    return (
        <MasterLayout>
            <div className="no-print max-w-5xl mx-auto space-y-12 pb-20">
                {/* Header Section */}
                <header>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-heading">ตั้งค่าระบบ <span className="text-orange-500">Master Control</span></h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">System Preferences & Business Identity</p>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Core Configurations...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-8">
                        {/* Section 1: Business Identity */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-lg">🏪</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 leading-none">ข้อมูลร้านค้า</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Receipt & Business Identity</p>
                                </div>
                            </div>

                            <div className="tasty-card grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Shop Name / หัวร้าน</label>
                                    <input
                                        type="text"
                                        name="shop_name"
                                        value={settings.shop_name}
                                        onChange={handleChange}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-medium text-slate-900 transition-all text-sm"
                                        placeholder="Tasty Station"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                                    <input
                                        type="text"
                                        name="shop_phone"
                                        value={settings.shop_phone}
                                        onChange={handleChange}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-medium text-slate-900 transition-all text-sm"
                                        placeholder="02-XXX-XXXX"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Shop Public URL (for QR Codes)</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            name="public_url"
                                            value={settings.public_url || ''}
                                            onChange={handleChange}
                                            className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-medium text-slate-900 transition-all text-sm font-mono"
                                            placeholder="https://your-shop.onrender.com"
                                        />
                                        <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center border border-blue-100 whitespace-nowrap">
                                            Stable Link
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 ml-1 italic">
                                        * ใส่ลิงก์ Render ของปะป๊าที่นี่ เพื่อให้ระบบสร้าง QR Code และลิงก์สั่งอาหารได้ถูกต้องค่ะ
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 2: Taxation & Service */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg">📑</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 leading-none">ภาษีและบริการ</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Taxation & Global Surcharges</p>
                                </div>
                            </div>

                            <div className="tasty-card grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">VAT Rate (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="tax_rate"
                                            value={settings.tax_rate}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-medium text-slate-900 transition-all text-sm"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">%</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 ml-1 italic">* Exclusive VAT implementation</p>
                                </div>
                                <div className="space-y-1.5 opacity-50">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Service Charge (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            disabled
                                            value="0"
                                            className="w-full bg-slate-100 border border-slate-100 rounded-xl px-4 py-2.5 outline-none font-medium text-slate-400 cursor-not-allowed text-sm"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-medium text-sm">%</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 ml-1 italic">* Multi-tier SC coming in v2.0</p>
                                </div>
                            </div>
                        </section>

                        {/* Section 3: Payment & Accounting */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">💳</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 leading-none">การชำระเงิน</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Digital Wallets & Transfers</p>
                                </div>
                            </div>

                            <div className="tasty-card space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">PromptPay Number / Citizen ID</label>
                                        <input
                                            type="text"
                                            name="promptpay_number"
                                            value={settings.promptpay_number || ''}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-medium text-slate-900 transition-all font-mono tracking-wider text-sm"
                                            placeholder="XXX-XXX-XXXX"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id="enable_receipt_printer"
                                                checked={settings.enable_receipt_printer !== 'false'}
                                                onChange={(e) => handleChange({ target: { name: 'enable_receipt_printer', value: e.target.checked ? 'true' : 'false' } })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                        </label>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-900 leading-none">Auto Print Receipt</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Automatic paper command</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#F8FAFC] p-6 rounded-3xl border border-slate-100 space-y-6">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-3 flex items-center gap-2">
                                        <span>🏦</span> Bank Account Detail (Manual Fallback)
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bank Name</label>
                                            <input
                                                type="text"
                                                name="bank_name"
                                                value={settings.bank_name || ''}
                                                onChange={handleChange}
                                                className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 focus:ring-2 focus:ring-orange-500/20 outline-none font-bold text-slate-900"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Number</label>
                                            <input
                                                type="text"
                                                name="bank_account_number"
                                                value={settings.bank_account_number || ''}
                                                onChange={handleChange}
                                                className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 focus:ring-2 focus:ring-orange-500/20 outline-none font-bold text-slate-900 font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Holder Name</label>
                                            <input
                                                type="text"
                                                name="bank_account_name"
                                                value={settings.bank_account_name || ''}
                                                onChange={handleChange}
                                                className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 focus:ring-2 focus:ring-orange-500/20 outline-none font-bold text-slate-900"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 4: Takeaway QR Code */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-lg">📸</div>
                                <div>
                                    <h3 className="font-bold text-slate-900 leading-none">Takeaway QR Code</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">QR Code for customer to order online</p>
                                </div>
                            </div>

                            <div className="tasty-card flex flex-col md:flex-row items-center gap-8 p-8">
                                <div className="bg-white p-4 rounded-3xl shadow-lg border-4 border-orange-500/10">
                                    {network ? (
                                        <div className="p-2 bg-white">
                                            <QRCode
                                                size={180}
                                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                value={settings.public_url
                                                    ? `${settings.public_url}/takeaway`
                                                    : network.cloudUrl
                                                        ? `${network.cloudUrl}/takeaway`
                                                        : `http://${network.localIp}:${window.location.port === '5173' ? '5173' : (network.port || 3000)}/takeaway`
                                                }
                                                viewBox={`0 0 256 256`}
                                                fgColor="#0F172A"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-[200px] h-[200px] bg-slate-100 rounded-2xl flex items-center justify-center italic text-slate-400 text-xs text-center p-4">
                                            Unable to detect network status
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-4 text-center md:text-left">
                                    <h4 className="text-xl font-bold text-slate-900">QR สำหรับสั่งอาหารกลับบ้าน</h4>
                                    <p className="text-slate-500 text-sm leading-relaxed max-w-md">
                                        แชร์ QR Code นี้เพื่อให้ลูกค้าสามารถสั่งอาหารผ่านมือถือได้ทันที ออเดอร์จะเด้งเข้าครัวโดยอัตโนมัติ พร้อมชื่อและเบอร์โทรลูกค้า
                                    </p>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Takeaway URL</p>
                                        <code className="text-xs font-mono text-orange-600 break-all">
                                            {settings.public_url
                                                ? `${settings.public_url}/takeaway`
                                                : network ? (
                                                    network.cloudUrl
                                                        ? `${network.cloudUrl}/takeaway`
                                                        : `http://${network.localIp}:${window.location.port === '5173' ? '5173' : (network.port || 3000)}/takeaway`
                                                ) : '...'}
                                        </code>
                                    </div>
                                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                        <button
                                            type="button"
                                            onClick={() => window.print()}
                                            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                                        >
                                            <span>🖨️ พิมพ์ QR</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="flex justify-end pt-10">
                            <button
                                type="submit"
                                className="bg-orange-500 hover:bg-orange-600 text-white px-12 py-4 rounded-[20px] font-bold shadow-xl shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest text-sm"
                            >
                                <span>Save Changes</span>
                                <span className="text-xl">✨</span>
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Hidden Printable QR Label (Master Control) */}
            <div className="print-only printable-qr-wrapper">
                <div className="flex flex-col items-center justify-center p-12 bg-white min-h-screen w-full">
                    <div className="border-[16px] border-orange-500 rounded-[100px] p-24 flex flex-col items-center max-w-4xl w-full bg-white shadow-none text-center">
                        <div className="text-9xl mb-12">✨ 🏪 ✨</div>
                        <h1 className="text-[80px] font-black text-slate-900 mb-4 leading-tight">{settings.shop_name || 'Tasty Station'}</h1>
                        <div className="w-40 h-3 bg-orange-500 rounded-full mb-12"></div>

                        <p className="text-4xl font-extrabold text-orange-500 uppercase tracking-[0.3em] mb-16">Scan to Order Takeaway</p>

                        <div className="bg-white p-12 rounded-[80px] shadow-2xl border-4 border-slate-50 mb-16 px-12">
                            <QRCode
                                value={network?.cloudUrl
                                    ? `${network.cloudUrl}/#/takeaway`
                                    : network ? `http://${network.localIp}:${window.location.port === '5173' ? '5173' : (network.port || 3000)}/#/takeaway` : ''
                                }
                                size={450}
                                level="H"
                            />
                        </div>

                        <div className="space-y-6">
                            <p className="text-4xl text-slate-400 font-bold uppercase tracking-widest italic">" สั่งง่าย ได้ไว ไม่ต้องรอคิว "</p>
                            <div className="flex items-center justify-center gap-6 mt-12 bg-slate-50 px-12 py-6 rounded-[40px] border-2 border-slate-100">
                                <span className="text-5xl">📱</span>
                                <span className="text-5xl font-black text-slate-900">{settings.shop_phone}</span>
                            </div>
                        </div>

                        <div className="mt-20 text-slate-300 font-bold uppercase tracking-[0.5em] text-sm">
                            Powered by Tasty Station POS 2025
                        </div>
                    </div>
                </div>
            </div>
        </MasterLayout >
    );
};

export default Settings;
