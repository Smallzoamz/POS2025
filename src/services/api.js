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

export const socket = io(SOCKET_URL);

export const api = {
    // Generic HTTP methods
    get: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`);
        return res.json();
    },
    post: async (url, data) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    put: async (url, data) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    delete: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // Get all tables
    getTables: async () => {
        const res = await fetch(`${BASE_URL}/tables`);
        return res.json();
    },

    // --- ZONES & TABLES MANAGEMENT ---
    getZones: async () => {
        const res = await fetch(`${BASE_URL}/zones`);
        return res.json();
    },
    addZone: async (name) => {
        const res = await fetch(`${BASE_URL}/zones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        return res.json();
    },
    deleteZone: async (id) => {
        const res = await fetch(`${BASE_URL}/zones/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    addTable: async (data) => {
        const res = await fetch(`${BASE_URL}/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    deleteTable: async (id) => {
        const res = await fetch(`${BASE_URL}/tables/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // --- ANALYTICS ---
    getSalesTrend: async (dateRange = {}) => {
        const { startDate, endDate } = dateRange;
        const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
        const res = await fetch(`${BASE_URL}/analytics/sales-trend${query}`);
        return res.json();
    },
    getTopItems: async (dateRange = {}) => {
        const { startDate, endDate } = dateRange;
        const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
        const res = await fetch(`${BASE_URL}/analytics/top-items${query}`);
        return res.json();
    },

    // Get menu (products + categories)
    getMenu: async () => {
        const res = await fetch(`${BASE_URL}/products`);
        return res.json();
    },

    // Update table status
    updateTableStatus: async (id, status) => {
        const res = await fetch(`${BASE_URL}/tables/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        return res.json();
    },

    // Create new order
    createOrder: async (tableName, items, total, orderType = 'dine_in') => {
        const res = await fetch(`${BASE_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableName, items, total, orderType })
        });
        return res.json();
    },

    // Get active order for table
    getOrder: async (tableName) => {
        const res = await fetch(`${BASE_URL}/orders/${tableName}`);
        return res.json();
    },

    // Pay bill
    payOrder: async (orderId, data = {}) => {
        const res = await fetch(`${BASE_URL}/orders/${orderId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    // Call Bill
    callBill: async (tableName) => {
        const res = await fetch(`${BASE_URL}/tables/${tableName}/call-bill`, {
            method: 'POST'
        });
        return res.json();
    },

    // Get Kitchen Orders (In-store)
    getKitchenOrders: async () => {
        const res = await fetch(`${BASE_URL}/kitchen/orders`);
        return res.json();
    },

    // Get Kitchen LINE Orders (confirmed/preparing)
    getKitchenLineOrders: async () => {
        const res = await fetch(`${BASE_URL}/kitchen/line-orders`);
        return res.json();
    },

    // Serve Order (Mark as served)
    serveOrder: async (orderId) => {
        const res = await fetch(`${BASE_URL}/kitchen/orders/${orderId}/serve`, {
            method: 'POST'
        });
        return res.json();
    },

    // Takeaway Orders
    getActiveTakeawayOrders: async () => {
        const res = await fetch(`${BASE_URL}/orders/takeaway/active`);
        return res.json();
    },

    completeOrder: async (orderId, paymentMethod = 'cash') => {
        const res = await fetch(`${BASE_URL}/orders/${orderId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod })
        });
        return res.json();
    },

    // Get Sales History
    getSalesHistory: async (dateRange = {}) => {
        const { startDate, endDate } = dateRange;
        const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
        const res = await fetch(`${BASE_URL}/orders/history${query}`);
        return res.json();
    },

    // Get Dashboard Stats
    getDashboardStats: async () => {
        const res = await fetch(`${BASE_URL}/dashboard`);
        return res.json();
    },

    // Product Management
    addProduct: async (product) => {
        const res = await fetch(`${BASE_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        return res.json();
    },
    updateProduct: async (id, product) => {
        const res = await fetch(`${BASE_URL}/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        return res.json();
    },
    deleteProduct: async (id) => {
        const res = await fetch(`${BASE_URL}/products/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // --- NOTIFICATIONS ---
    getNotifications: async () => {
        const res = await fetch(`${BASE_URL}/notifications`);
        return res.json();
    },
    markNotificationAsRead: async (id) => {
        const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
            method: 'POST'
        });
        return res.json();
    },
    markAllNotificationsAsRead: async () => {
        const res = await fetch(`${BASE_URL}/notifications/read-all`, {
            method: 'POST'
        });
        return res.json();
    },
    deleteNotification: async (id) => {
        const res = await fetch(`${BASE_URL}/notifications/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    clearAllNotifications: async () => {
        const res = await fetch(`${BASE_URL}/notifications`, {
            method: 'DELETE'
        });
        return res.json();
    },
    addCategory: async (category) => {
        const res = await fetch(`${BASE_URL}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(category)
        });
        return res.json();
    },
    deleteCategory: async (id) => {
        const res = await fetch(`${BASE_URL}/categories/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // --- INGREDIENTS / INVENTORY ---
    getIngredients: async () => {
        const res = await fetch(`${BASE_URL}/ingredients`);
        return res.json();
    },
    addIngredient: async (ingredient) => {
        const res = await fetch(`${BASE_URL}/ingredients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ingredient)
        });
        return res.json();
    },
    updateIngredient: async (id, ingredient) => {
        const res = await fetch(`${BASE_URL}/ingredients/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ingredient)
        });
        return res.json();
    },
    deleteIngredient: async (id) => {
        const res = await fetch(`${BASE_URL}/ingredients/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    getProductRecipe: async (productId) => {
        const res = await fetch(`${BASE_URL}/products/${productId}/recipe`);
        return res.json();
    },
    updateProductRecipe: async (productId, ingredients) => {
        const res = await fetch(`${BASE_URL}/products/${productId}/recipe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredients })
        });
        return res.json();
    },

    // --- SETTINGS ---
    getSettings: async () => {
        const res = await fetch(`${BASE_URL}/settings`);
        return res.json();
    },
    saveSettings: async (settings) => {
        const res = await fetch(`${BASE_URL}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
        });
        return res.json();
    },

    // --- USERS MANAGEMENT ---
    getUsers: async () => {
        const res = await fetch(`${BASE_URL}/users`);
        return res.json();
    },
    addUser: async (user) => {
        const res = await fetch(`${BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        return res.json();
    },
    updateUser: async (id, user) => {
        const res = await fetch(`${BASE_URL}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        return res.json();
    },
    deleteUser: async (id) => {
        const res = await fetch(`${BASE_URL}/users/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },

    // --- AUTH ---
    login: (pin) => fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
    }).then(res => res.json()),

    logout: (attendanceId) => fetch(`${BASE_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId })
    }).then(res => res.json()),

    getAttendanceLogs: async () => {
        const res = await fetch(`${BASE_URL}/attendance`);
        return res.json();
    },
    addAttendanceManual: async (data) => {
        const res = await fetch(`${BASE_URL}/attendance/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    // --- NETWORK & CLOUD ---
    getNetworkStatus: async () => {
        const res = await fetch(`${BASE_URL}/network/status`);
        return res.json();
    },
    toggleCloud: async (active) => {
        const res = await fetch(`${BASE_URL}/network/cloud-toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active })
        });
        return res.json();
    },

    // --- DELIVERY SYSTEM ---
    getDeliveryOrders: async (params = {}) => {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${BASE_URL}/delivery-orders?${query}`);
        return res.json();
    },
    getDeliverySettings: async () => {
        const res = await fetch(`${BASE_URL}/delivery/settings`);
        return res.json();
    },
    getRiders: async () => {
        const res = await fetch(`${BASE_URL}/riders`);
        return res.json();
    },
    getPendingPickups: async () => {
        const res = await fetch(`${BASE_URL}/delivery-orders/pending-pickup`);
        return res.json();
    },
    getMyDeliveries: async (riderId) => {
        const res = await fetch(`${BASE_URL}/delivery-orders/my-deliveries/${riderId}`);
        return res.json();
    },
    pickupDeliveryOrder: async (orderId, riderId) => {
        const res = await fetch(`${BASE_URL}/delivery-orders/${orderId}/pickup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ riderId })
        });
        return res.json();
    },
    startDelivery: async (orderId) => {
        const res = await fetch(`${BASE_URL}/delivery-orders/${orderId}/start-delivery`, { method: 'POST' });
        return res.json();
    },
    updateRiderLocation: async (orderId, lat, lng) => {
        const res = await fetch(`${BASE_URL}/delivery-orders/${orderId}/rider-location`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng })
        });
        return res.json();
    },
    markDelivered: async (orderId) => {
        const res = await fetch(`${BASE_URL}/delivery-orders/${orderId}/delivered`, { method: 'POST' });
        return res.json();
    },
    getTrackingInfo: async (token) => {
        const res = await fetch(`${BASE_URL}/public/tracking/${token}`);
        return res.json();
    },
    getPublicMenu: async () => {
        const res = await fetch(`${BASE_URL}/public/menu`);
        return res.json();
    },
    getPublicSettings: async () => {
        const res = await fetch(`${BASE_URL}/public/settings`);
        return res.json();
    },

    // --- LOYALTY & PROMOTIONS ---
    syncLoyaltyProfile: async (data) => {
        const res = await fetch(`${BASE_URL}/loyalty/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    getLoyaltyProfile: async (lineUserId) => {
        const res = await fetch(`${BASE_URL}/loyalty/profile/${lineUserId}`);
        return res.json();
    },
    getActivePromotions: async () => {
        const res = await fetch(`${BASE_URL}/loyalty/active-promotions`);
        return res.json();
    },
    redeemLoyaltyPoints: async (data) => {
        const res = await fetch(`${BASE_URL}/loyalty/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    getAdminPromotions: async () => {
        const res = await fetch(`${BASE_URL}/admin/loyalty/promotions`);
        return res.json();
    },
    addPromotion: async (promo) => {
        const res = await fetch(`${BASE_URL}/admin/loyalty/promotions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promo)
        });
        return res.json();
    },
    updatePromotion: async (id, promo) => {
        const res = await fetch(`${BASE_URL}/admin/loyalty/promotions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promo)
        });
        return res.json();
    },
    deletePromotion: async (id) => {
        const res = await fetch(`${BASE_URL}/admin/loyalty/promotions/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    searchLoyaltyCustomers: async (query) => {
        const res = await fetch(`${BASE_URL}/admin/loyalty/customers?query=${encodeURIComponent(query)}`);
        return res.json();
    },
    linkCustomerToOrder: async (orderId, customerId) => {
        const res = await fetch(`${BASE_URL}/orders/${orderId}/link-customer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId })
        });
        return res.json();
    }
};
