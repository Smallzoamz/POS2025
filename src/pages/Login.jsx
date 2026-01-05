import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [pin, setPin] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleNumClick = (num) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleClear = () => {
        setPin('');
        setError('');
    };

    const handleBackspace = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        if (!pin) return;

        setLoading(true);
        try {
            const res = await login(pin);
            if (res.success) {
                // Redirect based on Role
                const role = res.user.role;
                if (role === 'admin') {
                    navigate('/dashboard');
                } else if (role === 'kitchen') {
                    navigate('/kitchen');
                } else {
                    navigate('/tables');
                }
            } else {
                setError(res.error || 'รหัส PIN ไม่ถูกต้อง');
                setPin('');
            }
        } catch (err) {
            console.error("Login Error:", err);
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + (err.message || "Unknown error"));
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full flex flex-col md:flex-row min-h-[500px] md:h-[600px]">

                {/* Brand Side */}
                <div className="bg-gradient-to-br from-primary to-orange-600 p-6 md:p-10 text-white flex flex-col justify-center items-center md:w-1/2 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-white opacity-10 transform -skew-x-12 translate-x-10"></div>
                    <div className="relative z-10 text-center">
                        <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto shadow-xl">
                            <span className="text-3xl md:text-5xl">🏪</span>
                        </div>
                        <h1 className="text-2xl md:text-4xl font-bold mb-2">POS 2025</h1>
                        <p className="text-white/80 text-sm md:text-lg">System for Restaurants</p>
                    </div>
                </div>

                {/* Login Form Side */}
                <div className="p-6 md:p-12 flex flex-col justify-center w-full md:w-1/2 bg-gray-50 flex-1">
                    <div className="text-center mb-6">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h2>
                        <p className="text-sm text-gray-500">กรุณากรอกรหัส PIN Code</p>
                    </div>

                    <form onSubmit={handleLogin} className="w-full max-w-xs mx-auto">
                        <div className="mb-4 relative">
                            <input
                                type="password"
                                value={pin}
                                readOnly
                                className="w-full text-center text-3xl tracking-[1em] font-bold py-3 rounded-xl border-2 border-slate-200 focus:border-primary focus:ring-0 bg-white shadow-inner outline-none touch-manipulation"
                                placeholder="••••"
                            />
                            {error && <p className="absolute -bottom-5 left-0 right-0 text-center text-red-500 text-xs font-bold animate-shake">{error}</p>}
                        </div>

                        {/* Numeric Keypad */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleNumClick(num)}
                                    className="h-14 md:h-16 rounded-xl bg-white shadow-sm border border-gray-200 text-xl md:text-2xl font-bold text-gray-700 active:bg-gray-100 hover:shadow-md transition-all active:scale-95 touch-manipulation"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={handleClear}
                                className="h-14 md:h-16 rounded-xl bg-red-50 text-red-500 font-bold hover:bg-red-100 transition-colors touch-manipulation"
                            >
                                C
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNumClick(0)}
                                className="h-14 md:h-16 rounded-xl bg-white shadow-sm border border-gray-200 text-xl md:text-2xl font-bold text-gray-700 active:bg-gray-100 hover:shadow-md transition-all active:scale-95 touch-manipulation"
                            >
                                0
                            </button>
                            <button
                                type="button"
                                onClick={handleBackspace}
                                className="h-14 md:h-16 rounded-xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors touch-manipulation"
                            >
                                ⌫
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || pin.length === 0}
                            className={`w-full py-3 md:py-4 rounded-xl font-bold text-white text-lg shadow-lg transform transition-all active:scale-95 touch-manipulation ${loading || pin.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 hover:-translate-y-1'
                                }`}
                        >
                            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
                        </button>
                    </form>
                </div>
            </div>

            <div className="absolute bottom-4 text-slate-500 text-xs text-center">
                Default PINs: Owner (1111), Chef (2222), Staff (0000)
            </div>
        </div>
    );
};

export default Login;
