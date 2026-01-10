import { io } from 'socket.io-client';

// Use relative path for API calls (proxied by Vite in dev, or served by Express in prod)
const BASE_URL = '/api';

// Socket.io needs the full URL preferably, or reliable relative path.
// If we are using the Vite dev server (port 5173), the API/Socket is on port 3000.
// If we are in production or cloud tunnel, the API/Socket is on the same port as the UI.
const isVite = window.location.port === '5173';
const SOCKET_URL = isVite
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin;

export const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
});

export const api = {
    // Generic HTTP methods
    get: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            headers: {
                'X-Admin-Secret': import.meta.env.VITE_ADMIN_SECRET_KEY || 'pos2025-admin-secret-key'
            }
        });
        return res.json();
    },
    post: async (url, data) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Secret': import.meta.env.VITE_ADMIN_SECRET_KEY || 'pos2025-admin-secret-key'
            },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    put: async (url, data) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Secret': import.meta.env.VITE_ADMIN_SECRET_KEY || 'pos2025-admin-secret-key'
            },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    delete: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'DELETE',
            headers: {
                'X-Admin-Secret': import.meta.env.VITE_ADMIN_SECRET_KEY || 'pos2025-admin-secret-key'
            }
        });
        return res.json();
    },

    // Get all tables
    getTables: async () => api.get('/tables'),

    // --- ZONES & TABLES MANAGEMENT ---
    getZones: async () => api.get('/zones'),
    addZone: async (name) => api.post('/zones', { name }),
    deleteZone: async (id) => api.delete(`/zones/${id}`),
    addTable: async (data) => api.post('/tables', data),
    deleteTable: async (id) => api.delete(`/tables/${id}`),

    // --- ANALYTICS ---
    getSalesTrend: async (dateRange = {}) => {
        const { startDate, endDate } = dateRange;
        const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
        return api.get(`/analytics/sales-trend${query}`);
    },
    getTopItems: async (dateRange = {}) => {
        const { startDate, endDate } = dateRange;
        const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
        return api.get(`/analytics/top-items${query}`);
    },

    // Get menu (products + categories)
    getMenu: async () => api.get('/products'),

    // Update table status
    updateTableStatus: async (id, status) => api.post(`/tables/${id}/status`, { status }),

    // Create new order
    createOrder: async (tableName, items, total, orderType = 'dine_in') =>
        api.post('/orders', { tableName, items, total, orderType }),

    // Get active order for table
    getOrder: async (tableName) => api.get(`/orders/${tableName}`),

    // Delete/Cancel Order
    deleteOrder: async (id) => api.delete(`/orders/${id}`),

    // Update Order Metadata
    updateOrder: async (id, data) => api.patch(`/orders/${id}`, data),

    // Pay bill
    payOrder: async (orderId, data = {}) => api.post(`/orders/${orderId}/pay`, data),

    // Call Bill
    callBill: async (tableName) => api.post(`/tables/${tableName}/call-bill`),

    // Get Kitchen Orders (In-store)
    getKitchenOrders: async () => api.get('/kitchen/orders'),

    // Get Kitchen LINE Orders (confirmed/preparing)
    getKitchenLineOrders: async () => api.get('/kitchen/line-orders'),

    // Serve Order (Mark as served)
    serveOrder: async (orderId) => api.post(`/kitchen/orders/${orderId}/serve`),

    // Takeaway Orders
    getActiveTakeawayOrders: async () => api.get('/orders/takeaway/active'),

    completeOrder: async (orderId, paymentMethod = 'cash') =>
        api.post(`/orders/${orderId}/complete`, { paymentMethod }),

    // Get Sales History
    getSalesHistory: async (dateRange = {}) => {
        const { startDate, endDate } = dateRange;
        const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
        return api.get(`/orders/history${query}`);
    },

    // Get Dashboard Stats
    getDashboardStats: async () => api.get('/dashboard'),

    // Product Management
    addProduct: async (product) => api.post('/products', product),
    updateProduct: async (id, product) => api.put(`/products/${id}`, product),
    deleteProduct: async (id) => api.delete(`/products/${id}`),

    // --- NOTIFICATIONS ---
    getNotifications: async () => api.get('/notifications'),
    markNotificationAsRead: async (id) => api.post(`/notifications/${id}/read`),
    markAllNotificationsAsRead: async () => api.post('/notifications/read-all'),
    deleteNotification: async (id) => api.delete(`/notifications/${id}`),
    clearAllNotifications: async () => api.delete('/notifications'),

    addCategory: async (category) => api.post('/categories', category),
    deleteCategory: async (id) => api.delete(`/categories/${id}`),

    // Sync Menu to Website
    syncMenu: async () => api.post('/sync-menu-to-website'),

    // --- INGREDIENTS / INVENTORY ---
    getIngredients: async () => api.get('/ingredients'),
    addIngredient: async (ingredient) => api.post('/ingredients', ingredient),
    updateIngredient: async (id, ingredient) => api.put(`/ingredients/${id}`, ingredient),
    deleteIngredient: async (id) => api.delete(`/ingredients/${id}`),
    getProductRecipe: async (productId) => api.get(`/products/${productId}/recipe`),
    updateProductRecipe: async (productId, ingredients) =>
        api.post(`/products/${productId}/recipe`, { ingredients }),

    // --- PRODUCT OPTIONS ---
    getProductOptions: async (productId) => api.get(`/products/${productId}/options`),
    addProductOption: async (productId, option) =>
        api.post(`/products/${productId}/options`, option),
    updateProductOption: async (optionId, option) =>
        api.put(`/product-options/${optionId}`, option),
    deleteProductOption: async (optionId) => api.delete(`/product-options/${optionId}`),

    // --- OPTION RECIPES ---
    getOptionRecipe: async (optionId) => api.get(`/option-recipes/${optionId}`),
    saveOptionRecipe: async (optionId, ingredients) =>
        api.post(`/option-recipes/${optionId}`, { ingredients }),

    // --- GLOBAL OPTIONS (Category-level) ---
    getGlobalOptions: async () => api.get('/global-options'),
    getGlobalOptionsByCategory: async (categoryId) =>
        api.get(`/global-options/by-category/${categoryId}`),
    addGlobalOption: async (option) => api.post('/global-options', option),
    updateGlobalOption: async (id, option) => api.put(`/global-options/${id}`, option),
    deleteGlobalOption: async (id) => api.delete(`/global-options/${id}`),
    getGlobalOptionRecipe: async (optionId) => api.get(`/global-option-recipes/${optionId}`),
    saveGlobalOptionRecipe: async (optionId, items) =>
        api.post(`/global-option-recipes/${optionId}`, { items }),

    // --- SETTINGS ---
    getSettings: async () => api.get('/settings'),
    saveSettings: async (settings) => api.post('/settings', { settings }),

    getStoreStatus: async () => api.get('/store-status'),

    // --- USERS MANAGEMENT ---
    getUsers: async () => api.get('/users'),
    addUser: async (user) => api.post('/users', user),
    updateUser: async (id, user) => api.put(`/users/${id}`, user),
    deleteUser: async (id) => api.delete(`/users/${id}`),

    // --- AUTH ---
    login: (pin) => api.post('/login', { pin }),
    logout: (attendanceId) => api.post('/logout', { attendanceId }),

    getAttendanceLogs: async () => api.get('/attendance'),
    addAttendanceManual: async (data) => api.post('/attendance/manual', data),

    // --- NETWORK & CLOUD ---
    getNetworkStatus: async () => api.get('/network/status'),
    toggleCloud: async (active) => api.post('/network/cloud-toggle', { active }),

    // --- DELIVERY SYSTEM ---
    getDeliveryOrders: async (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/delivery-orders?${query}`);
    },
    getDeliverySettings: async () => api.get('/delivery/settings'),
    getRiders: async () => api.get('/riders'),
    getPendingPickups: async () => api.get('/delivery-orders/pending-pickup'),
    getMyDeliveries: async (riderId) => api.get(`/delivery-orders/my-deliveries/${riderId}`),
    pickupDeliveryOrder: async (orderId, riderId) =>
        api.post(`/delivery-orders/${orderId}/pickup`, { riderId }),
    startDelivery: async (orderId) => api.post(`/delivery-orders/${orderId}/start-delivery`),
    updateRiderLocation: async (orderId, lat, lng) =>
        api.patch(`/delivery-orders/${orderId}/rider-location`, { lat, lng }),
    markDelivered: async (orderId) => api.post(`/delivery-orders/${orderId}/delivered`),
    getTrackingInfo: async (token) => api.get(`/public/tracking/${token}`),
    getPublicMenu: async () => api.get('/public/menu'),
    getPublicSettings: async () => api.get('/public/settings'),

    // --- LOYALTY & PROMOTIONS ---
    syncLoyaltyProfile: async (data) => api.post('/loyalty/sync', data),
    getLoyaltyProfile: async (lineUserId) => api.get(`/loyalty/profile/${lineUserId}`),
    getActivePromotions: async () => api.get('/loyalty/active-promotions'),
    redeemLoyaltyPoints: async (data) => api.post('/loyalty/redeem', data),
    getAdminPromotions: async () => api.get('/admin/loyalty/promotions'),
    addPromotion: async (promo) => api.post('/admin/loyalty/promotions', promo),
    updatePromotion: async (id, promo) => api.put(`/admin/loyalty/promotions/${id}`, promo),
    deletePromotion: async (id) => api.delete(`/admin/loyalty/promotions/${id}`),
    searchLoyaltyCustomers: async (query) =>
        api.get(`/admin/loyalty/customers?query=${encodeURIComponent(query)}`),
    linkCustomerToOrder: async (orderId, customerId) =>
        api.post(`/orders/${orderId}/link-customer`, { customerId }),
    getCustomerCoupons: async (customerId) => api.get(`/loyalty/coupons/${customerId}`),
    updateMemberProfile: async (data) => api.post('/member/profile', data),
    verifyCoupon: async (couponId) => api.get(`/coupons/verify/${couponId}`),
    useCoupon: async (code, orderId = null, lineOrderId = null) =>
        api.post('/loyalty/coupons/use', { code, orderId, lineOrderId }),

    // --- FLOOR PLAN & MAP OBJECTS ---
    batchUpdateTableLayout: async (layouts) => api.post('/tables/batch-layout', { layouts }),
    getMapObjects: async () => api.get('/map-objects'),
    addMapObject: async (data) => api.post('/map-objects', data),
    updateMapObject: async (id, data) => api.patch(`/map-objects/${id}`, data),
    deleteMapObject: async (id) => api.delete(`/map-objects/${id}`),

    // API Helpers
    patch: async (url, data) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Secret': import.meta.env.VITE_ADMIN_SECRET_KEY || 'pos2025-admin-secret-key'
            },
            body: JSON.stringify(data)
        });
        return res.json();
    }
};

export default api;
