import React, { useEffect, useState } from 'react';
import { socket } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const GlobalNotificationListener = () => {
    const { user } = useAuth();
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        // Only listen if user is logged in (Staff/Owner/Admin)
        // Customers (user === null) should NOT receive these notifications
        if (!user) return;

        const handleOrderReady = ({ tableName }) => {
            // Play Sound
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio error:', e));

            // Show Notification
            setNotification({
                message: `✅ อาหารโต๊ะ ${tableName} พร้อมเสริฟแล้ว!`,
                type: 'success'
            });

            // Auto-hide
            setTimeout(() => setNotification(null), 5000);
        };

        socket.on('order-ready', handleOrderReady);

        return () => {
            socket.off('order-ready', handleOrderReady);
        };
    }, [user]);

    if (!notification) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] animate-bounce-short">
            <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border-2 border-white/20">
                <span className="text-3xl">🔔</span>
                <div>
                    <h4 className="font-bold text-lg">แจ้งเตือนครัว (Kitchen)</h4>
                    <p className="font-medium">{notification.message}</p>
                </div>
                <button onClick={() => setNotification(null)} className="ml-4 text-white/50 hover:text-white">✕</button>
            </div>
        </div>
    );
};

export default GlobalNotificationListener;
