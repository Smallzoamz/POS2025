import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Import Auth
import { socket } from '../services/api'; // Import socket

const MasterLayout = ({ children }) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false); // Mobile Sidebar State
    const [isNotificationOpen, setIsNotificationOpen] = React.useState(false); // Notification History Sidebar
    const [notifications, setNotifications] = React.useState([]); // Persistent Notifications
    const [notification, setNotification] = React.useState(null); // Current transient notification
    const [isConnected, setIsConnected] = React.useState(socket.connected); // Connection State

    const isActive = (path) => location.pathname === path;
    const isOwner = user?.role === 'owner';
    const isAdmin = user?.role === 'admin';
    const isKitchen = user?.role === 'kitchen';
    const isStaff = user?.role === 'staff';
    const isRider = user?.role === 'rider' || user?.can_deliver === true;

    // Permission Helpers
    const canViewDashboard = isOwner || isAdmin;
    const canViewTables = isOwner || isAdmin || isStaff;
    const canViewKitchen = isOwner || isAdmin || isKitchen;

    // Management
    const canViewMenu = isOwner || isAdmin || isKitchen;
    const canViewStock = isOwner || isAdmin || isKitchen;
    const canViewLineOrders = isOwner || isAdmin; // LINE Orders
    const canViewDelivery = isOwner || isAdmin; // Delivery Orders Management
    const canViewRider = isOwner || isAdmin || isRider || isStaff; // Rider Dashboard

    // High Level
    const canViewSales = isOwner || isAdmin;
    const canViewSettings = isOwner;
    const canViewUsers = isOwner;
    const canViewFinance = isOwner || user?.role === 'finance';

    React.useEffect(() => {
        loadNotifications();

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onNewNotification = (notif) => {
            setNotifications(prev => [notif, ...prev].slice(0, 100));
            // Show toast for a few seconds if drawer is closed
            if (!isNotificationOpen) {
                setNotification(notif);
                setTimeout(() => setNotification(null), 5000);
            }
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('new-notification', onNewNotification);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('new-notification', onNewNotification);
        };
    }, []);

    const loadNotifications = async () => {
        try {
            const data = await fetch('/api/notifications').then(res => res.json());
            setNotifications(data);
        } catch (err) {
            console.error('Failed to load notifications', err);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) { }
    };

    const handleMarkAllRead = async () => {
        try {
            await fetch('/api/notifications/read-all', { method: 'POST' });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) { }
    };

    const handleClearAll = async () => {
        if (!confirm('ยืนยันที่จะลบประวัติการแจ้งเตือนทั้งหมด?')) return;
        try {
            await fetch('/api/notifications', { method: 'DELETE' });
            setNotifications([]);
        } catch (err) { }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getNotificationStyle = (type) => {
        switch (type) {
            case 'order': return { bg: 'bg-orange-50', text: 'text-orange-600', icon: '🛒', border: 'border-orange-100' };
            case 'bill': return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: '💰', border: 'border-emerald-100' };
            case 'takeaway': return { bg: 'bg-blue-50', text: 'text-blue-600', icon: '🛍️', border: 'border-blue-100' };
            default: return { bg: 'bg-slate-50', text: 'text-slate-600', icon: '🔔', border: 'border-slate-100' };
        }
    };

    const NavLink = ({ to, icon, label, active, onClick }) => (
        <Link
            to={to}
            onClick={onClick}
            className={`
                flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group mx-2
                ${active
                    ? 'sidebar-active-pill text-orange-600 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
            `}
        >
            <span className={`text-xl transition-transform group-hover:scale-110 ${active ? '' : 'opacity-70 group-hover:opacity-100'}`}>
                {icon}
            </span>
            <span className="text-sm font-medium">{label}</span>
        </Link>
    );

    return (
        <div className="flex h-screen bg-[#F2F6F9] text-[#1E293B] font-sans overflow-hidden">

            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 w-full z-[60] bg-white border-b border-slate-100 flex items-center justify-between px-4 h-16 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-xl bg-slate-50 text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="font-black text-xl tracking-tight text-orange-500 font-heading">Tasty Station</span>
                </div>
            </header>

            {/* Sidebar Desktop */}
            <aside className={`
                fixed inset-y-0 left-0 z-[70] w-72 bg-white border-r border-[#E8ECEB] flex flex-col transition-transform duration-300 ease-in-out
                md:translate-x-0 md:relative
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo Section */}
                <div className="p-8 flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-[#00A099] rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C14.07 4 15.93 4.71 17.41 5.89L5.89 17.41C4.71 15.93 4 14.07 4 12C4 7.58 7.58 4 12 4ZM12 20C9.93 20 8.07 19.29 6.59 18.11L18.11 6.59C19.29 8.07 20 9.93 20 12C20 16.42 16.42 20 12 20Z" fill="white" />
                        </svg>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">Tasty</h1>
                        <p className="text-[11px] font-bold text-slate-400 -mt-1 uppercase tracking-[0.1em]">Station POS</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-2 space-y-1 custom-scrollbar">
                    <div className="px-5">
                        {canViewDashboard && (
                            <NavLink to="/dashboard" icon="📊" label="Dashboard" active={isActive('/dashboard')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewTables && (
                            <NavLink to="/tables" icon="🪑" label="Table Plan" active={isActive('/tables')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewKitchen && (
                            <NavLink to="/kitchen" icon="🍳" label="Kitchen Display" active={isActive('/kitchen')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewRider && (
                            <NavLink to="/rider" icon="🏍️" label="Rider Dashboard" active={isActive('/rider')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-50 px-5">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-4 mb-2">Management</p>
                        {canViewLineOrders && (
                            <NavLink to="/line-orders" icon="📱" label="LINE Orders" active={isActive('/line-orders')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewDelivery && (
                            <NavLink to="/delivery-orders" icon="🚚" label="Delivery Orders" active={isActive('/delivery-orders')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewMenu && (
                            <NavLink to="/menu" icon="📖" label="Menu Management" active={isActive('/menu')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewStock && (
                            <NavLink to="/stock" icon="📦" label="Stock Management" active={isActive('/stock')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewTables && (
                            <NavLink to="/tables-manage" icon="🗂️" label="Table Management" active={isActive('/tables-manage')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {(user.role === 'owner' || user.role === 'admin') && (
                            <NavLink to="/promotions" icon="🎁" label="Promotions & Rewards" active={isActive('/promotions')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-50 px-5">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-4 mb-2">Reports & Admin</p>
                        {canViewSales && (
                            <NavLink to="/sales" icon="📈" label="Sales History" active={isActive('/sales')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewFinance && (
                            <NavLink to="/finance" icon="💰" label="Finance" active={isActive('/finance')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewUsers && (
                            <NavLink to="/attendance" icon="⏱️" label="Attendance" active={isActive('/attendance')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewUsers && (
                            <NavLink to="/users" icon="👥" label="User Management" active={isActive('/users')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                        {canViewSettings && (
                            <NavLink to="/settings" icon="⚙️" label="Settings" active={isActive('/settings')} onClick={() => setIsSidebarOpen(false)} />
                        )}
                    </div>
                </nav>


                {/* Logout Button (Bottom) */}
                <div className="p-6">
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-300 group"
                    >
                        <span className="text-xl grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 italic transition-all">🚪</span>
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Topbar */}
                <header className="hidden md:flex h-20 bg-white border-b border-[#E8ECEB] px-10 items-center justify-between shrink-0 sticky top-0 z-50">
                    <div className="flex-1 max-w-lg">
                        <div className="relative group">
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Search menu, orders and more"
                                className="w-full bg-[#f8fafc] border-none rounded-xl py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-orange-500/10 transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        {/* Connection Badge */}
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                            {isConnected ? 'Online' : 'Offline'}
                        </div>

                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotificationOpen(true)}
                                className={`relative p-2 transition-all duration-300 rounded-xl hover:bg-slate-50 ${isNotificationOpen ? 'text-orange-500 bg-orange-50' : 'text-slate-400 hover:text-orange-500'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-white flex items-center justify-center animate-pulse-soft">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Profile Wrapper */}
                        <div className="flex items-center gap-3 pl-6 border-l border-slate-100">
                            <div className="text-right hidden lg:block">
                                <p className="text-sm font-bold text-slate-900 leading-none">{user?.full_name || 'Ibrahim Kadri'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{user?.role || 'Admin'}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
                                <img src={`https://ui-avatars.com/api/?name=${user?.full_name || 'Admin'}&background=random`} alt="profile" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                    {children}
                </div>
            </main>

            {/* Notification Sidebar Drawer */}
            {isNotificationOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsNotificationOpen(false)}></div>
                    <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-slide-left overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">การแจ้งเตือน</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Notification History</p>
                            </div>
                            <button onClick={() => setIsNotificationOpen(false)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-4 flex gap-2 border-b border-slate-50">
                            <button onClick={handleMarkAllRead} className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-orange-500 bg-slate-50 rounded-lg transition-colors">
                                Mark all as read
                            </button>
                            <button onClick={handleClearAll} className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                Clear history
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                                    <div className="text-5xl mb-4 grayscale">📭</div>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">ไม่มีการแจ้งเตือนใหม่</p>
                                </div>
                            ) : (
                                notifications.map((n) => {
                                    const style = getNotificationStyle(n.type);
                                    return (
                                        <div
                                            key={n.id}
                                            onClick={() => handleMarkAsRead(n.id)}
                                            className={`
                                                group p-4 rounded-2xl border transition-all duration-300 cursor-pointer relative
                                                ${n.is_read ? 'bg-white border-slate-100 opacity-60' : `${style.bg} ${style.border} shadow-sm scale-[1.02]`}
                                            `}
                                        >
                                            {!n.is_read && <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full"></div>}
                                            <div className="flex gap-4">
                                                <div className={`w-10 h-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center text-xl`}>
                                                    {style.icon}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className={`text-sm font-black ${style.text} leading-tight`}>{n.title}</h4>
                                                    <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{n.message}</p>
                                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-2">
                                                        {new Date(n.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Transient Toast Notification */}
            {notification && !isNotificationOpen && (
                <div className="fixed bottom-8 right-8 z-[150] animate-fade-in-up">
                    <div className={`
                        flex items-center gap-4 bg-white p-5 rounded-[24px] shadow-2xl border-2 border-slate-50 min-w-[320px] max-w-md
                        cursor-pointer hover:scale-[1.02] transition-transform
                    `} onClick={() => { setIsNotificationOpen(true); setNotification(null); }}>
                        <div className={`w-12 h-12 rounded-2xl ${getNotificationStyle(notification.type).bg} flex items-center justify-center text-2xl`}>
                            {getNotificationStyle(notification.type).icon}
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-black text-slate-900">{notification.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{notification.message}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setNotification(null); }} className="text-slate-300 hover:text-slate-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterLayout;
