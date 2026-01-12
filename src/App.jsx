import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './Dashboard';
import TablePlan from './TablePlan';
import OrderEntry from './OrderEntry';
import KitchenDisplay from './KitchenDisplay';
import SalesHistory from './SalesHistory';
import MenuManagement from './MenuManagement';
import StockManagement from './StockManagement';
import TableManagement from './TableManagement';
import Settings from './Settings';
import Login from './pages/Login';
import UserManagement from './UserManagement';
import AttendanceHistory from './AttendanceHistory';
import Finance from './Finance';
import GlobalNotificationListener from './components/GlobalNotificationListener';
import LineOrder from './pages/LineOrder';
import LineOrderManagement from './LineOrderManagement';
import DeliveryOrderManagement from './DeliveryOrderManagement';
import RiderDashboard from './RiderDashboard';
import CustomerTracking from './pages/CustomerTracking';
import TakeawayOrder from './pages/TakeawayOrder';
import CustomerLoyalty from './pages/CustomerLoyalty';
import Promotions from './pages/Promotions';

// Protected Route Component
const ProtectedRoute = ({ children, roles = [] }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <div>Loading...</div>;

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Owner has access to EVERYTHING, so if roles includes 'owner' or 'admin', owner generally gets handled.
    // But specific checks: if roles array is passed, check if user's role is in it.
    // OWNER SPECIAL RULE: Owner has all permissions.
    if (user.role === 'owner') return children;

    if (roles.length > 0 && !roles.includes(user.role)) {
        return <div className="p-10 text-center text-red-500 font-bold">⛔ Access Denied: You do not have permission.</div>;
    }

    return children;
};

const RoleBasedRedirect = () => {
    const { user, loading } = useAuth();
    if (loading) return null;

    if (!user) {
        // Staff/Admin entry point should go to login
        return <Navigate to="/login" replace />;
    }

    if (user.role === 'owner' || user.role === 'admin' || user.role === 'finance') return <Navigate to="/dashboard" replace />;
    if (user.role === 'kitchen') return <Navigate to="/kitchen" replace />;
    if (user.role === 'rider') return <Navigate to="/rider" replace />;
    return <Navigate to="/tables" replace />;
};

function App() {
    return (
        <AuthProvider>
            <GlobalNotificationListener />
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />

                    {/* Protected Routes */}

                    {/* Staff/Admin Smart Redirect */}
                    <Route path="/" element={
                        <ProtectedRoute>
                            <RoleBasedRedirect />
                        </ProtectedRoute>
                    } />

                    <Route path="/dashboard" element={<ProtectedRoute roles={['owner', 'admin', 'finance']}><Dashboard /></ProtectedRoute>} />

                    {/* Staff & Admin - Order Taking (Shared with Customers for now) */}
                    <Route path="/tables" element={<ProtectedRoute roles={['owner', 'admin', 'staff']}><TablePlan /></ProtectedRoute>} />
                    {/* Public Route for Customers (Scan QR) & Staff */}
                    <Route path="/order/:tableId" element={<OrderEntry />} />

                    {/* LINE Order - Public Route (ลูกค้าสั่งจาก LINE) */}
                    <Route path="/line-order" element={<LineOrder />} />

                    {/* Takeaway Order - Public Route (ลูกค้าสั่งกลับบ้าน) */}
                    <Route path="/takeaway" element={<TakeawayOrder />} />

                    {/* Kitchen & Admin - KDS & Management */}
                    <Route path="/kitchen" element={<ProtectedRoute roles={['owner', 'admin', 'kitchen']}><KitchenDisplay /></ProtectedRoute>} />
                    <Route path="/menu" element={<ProtectedRoute roles={['owner', 'admin', 'kitchen']}><MenuManagement /></ProtectedRoute>} />
                    <Route path="/stock" element={<ProtectedRoute roles={['owner', 'admin', 'kitchen']}><StockManagement /></ProtectedRoute>} />
                    <Route path="/tables-manage" element={<ProtectedRoute roles={['owner', 'admin']}><TableManagement /></ProtectedRoute>} />

                    {/* Admin Only */}
                    <Route path="/sales" element={<ProtectedRoute roles={['owner', 'admin']}><SalesHistory /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute roles={['owner']}><Settings /></ProtectedRoute>} />

                    {/* Owner & Finance */}
                    <Route path="/finance" element={<ProtectedRoute roles={['owner', 'finance']}><Finance /></ProtectedRoute>} />

                    {/* Owner Only */}
                    <Route path="/users" element={<ProtectedRoute roles={['owner']}><UserManagement /></ProtectedRoute>} />
                    <Route path="/attendance" element={<ProtectedRoute roles={['owner']}><AttendanceHistory /></ProtectedRoute>} />

                    {/* LINE Order Management - Admin */}
                    <Route path="/line-orders" element={<ProtectedRoute roles={['owner', 'admin']}><LineOrderManagement /></ProtectedRoute>} />

                    {/* Delivery System */}
                    <Route path="/delivery-orders" element={<ProtectedRoute roles={['owner', 'admin']}><DeliveryOrderManagement /></ProtectedRoute>} />
                    <Route path="/rider" element={<ProtectedRoute roles={['owner', 'admin', 'rider', 'staff']}><RiderDashboard /></ProtectedRoute>} />

                    {/* Public Tracking Page */}
                    <Route path="/tracking/:token" element={<CustomerTracking />} />

                    {/* Loyalty System - Public */}
                    <Route path="/loyalty" element={<CustomerLoyalty />} />

                    {/* Loyalty System - Admin Management */}
                    <Route path="/admin/promotions" element={<ProtectedRoute roles={['owner', 'admin']}><Promotions /></ProtectedRoute>} />
                    <Route path="/promotions" element={<Navigate to="/admin/promotions" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
