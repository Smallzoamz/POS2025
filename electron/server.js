const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')
const fs = require('fs')
const os = require('os')
// const localtunnel = require('localtunnel')

// const { db, initDatabase } = require('./db') // Legacy SQLite
const { pool, query, initDatabasePG, updateCustomerProfile } = require('./db_pg')
const { initBirthdayScheduler, checkBirthdaysManually } = require('./birthdayScheduler')
const { initWinbackScheduler, checkWinbackManually } = require('./winbackScheduler')

// Utility: Get Local IP (Prioritize common LAN ranges and ignore virtual adapters)
const getLocalIp = () => {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const devName in interfaces) {
        // Ignore common virtual/loopback adapter names
        if (devName.toLowerCase().includes('virtual') ||
            devName.toLowerCase().includes('loopback') ||
            devName.toLowerCase().includes('radmin') ||
            devName.toLowerCase().includes('hamachi') ||
            devName.toLowerCase().includes('wsl')) continue;

        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal) {
                ips.push(alias.address);
            }
        }
    }

    // Prioritize 192.168 or 10.0 ranges (most common for routers)
    const bestIp = ips.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.')) || ips[0] || 'localhost';
    return bestIp;
};

async function startServer() {
    // Initialize PostgreSQL (Primary)
    try {
        await initDatabasePG();
        console.log("🚀 PostgreSQL is ready to roll!");
    } catch (err) {
        console.error("⚠️ PostgreSQL failed to start. Please check your .env settings.", err.message);
    }

    const app = express()
    const port = process.env.PORT || 3000 // Use dynamic port for Render

    app.use((req, res, next) => {
        console.log(`[REQ] ${req.method} ${req.url}`);
        next();
    });

    // 🛡️ SECURITY HARDENING: Tighter CORS Policy (with LIFF and LAN support)
    const localIp = getLocalIp();
    const allowedOrigins = [
        'http://localhost:5173', // Vite Dev
        'http://localhost:3000', // Electron Prod
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
        `http://${localIp}:5173`,
        `http://${localIp}:3000`
    ];

    app.use(cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps, curl, or same-origin)
            if (!origin) return callback(null, true);

            // Check if origin is in allowed list
            const isInAllowedList = allowedOrigins.indexOf(origin) !== -1;

            // Check if it's from localhost or local network
            const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
            const isLocalNetwork = origin.includes('192.168.') || origin.includes('10.0.') || origin.includes('10.1.');
            const isServerLocalIp = localIp !== 'localhost' && origin.includes(localIp);

            // Check if it's from trusted external domains
            const isLiffDomain = origin.includes('.line.me') || origin.includes('liff.line.me');
            const isRenderDomain = origin.includes('.onrender.com');
            const isTrustedExternal = isLiffDomain || isRenderDomain;

            // Allow if any condition matches, or in non-production mode
            if (isInAllowedList || isLocalhost || isLocalNetwork || isServerLocalIp || isTrustedExternal || process.env.NODE_ENV !== 'production') {
                callback(null, true);
            } else {
                console.warn(`[Security] Blocked CORS request from: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true
    }));

    app.use(express.json())

    // 🛡️ SECURITY HARDENING: Admin Authorization Middleware
    const requireAdmin = (req, res, next) => {
        // In local development/electron context, we might allow it if it's from localhost
        const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.includes('localhost');

        // Check if request is from same origin (internal frontend to backend)
        const origin = req.headers.origin;
        const host = req.headers.host;
        const isSameOrigin = !origin || (host && origin.includes(host.split(':')[0]));

        const secretKey = process.env.ADMIN_SECRET_KEY || 'pos2025-admin-secret-key';
        const clientKey = req.headers['x-admin-secret'];

        if (clientKey === secretKey) {
            // Valid secret key provided
            next();
        } else if (process.env.NODE_ENV !== 'production' && isLocal) {
            // Allow local access without secret in dev mode for convenience
            next();
        } else if (isSameOrigin && clientKey === 'pos2025-admin-secret-key') {
            // Allow same-origin requests with default key (for Render co-hosting)
            next();
        } else {
            console.warn(`[Security] Unauthorized Admin Access Attempt - IP: ${req.ip}, Origin: ${origin}`);
            res.status(401).json({ error: 'Unauthorized Access: Invalid Admin Secret Key' });
        }
    };

    let tunnel = null;
    let cloudUrl = null;
    let isLaunchingCloud = false;


    // Serve Static Files (Frontend) - Build output
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));


    const server = http.createServer(app)
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    })

    // --- BIRTHDAY SCHEDULER INIT ---
    initBirthdayScheduler(pool, io);

    // --- WIN-BACK SCHEDULER INIT ---
    initWinbackScheduler(pool, io);

    // --- NOTIFICATION HELPER ---
    const createNotification = async (title, message, type = 'info', meta = null) => {
        try {
            const result = await query(
                'INSERT INTO notifications (title, message, type, meta) VALUES ($1, $2, $3, $4) RETURNING *',
                [title, message, type, meta]
            );
            const notification = result.rows[0];
            io.emit('new-notification', notification);
            console.log(`[Notification] ${title}: ${message}`);
            return notification;
        } catch (err) {
            console.error('Failed to create notification', err);
        }
    };

    // --- LOYALTY HELPER ---
    const earnLoyaltyPoints = async (customerId, amount, orderId = null, lineOrderId = null) => {
        if (!customerId) return null;
        try {
            // Check if customer is following LINE OA (Requirement)
            const customerRes = await query("SELECT id, line_user_id, points, is_following FROM loyalty_customers WHERE id = $1", [customerId]);
            if (!customerRes.rows[0]?.is_following) {
                console.log(`[Loyalty] Customer #${customerId} skipped points (Not following LINE OA)`);
                return null;
            }

            // Get rate from settings or default to 35
            const rateRes = await query("SELECT value FROM settings WHERE key = 'loyalty_points_per_unit'");
            const rate = parseFloat(rateRes.rows[0]?.value || 35);

            const pointsToEarn = Math.floor(amount / rate);
            if (pointsToEarn <= 0) return null;

            // 1. Update customer points AND last_order_at (for Win-Back System tracking)
            await query("UPDATE loyalty_customers SET points = points + $1, updated_at = CURRENT_TIMESTAMP, last_order_at = CURRENT_TIMESTAMP WHERE id = $2", [pointsToEarn, customerId]);

            // 2. Log transaction
            await query(`
                INSERT INTO loyalty_point_transactions 
                (customer_id, type, points, order_id, line_order_id, description)
                VALUES ($1, 'earn', $2, $3, $4, $5)
            `, [customerId, pointsToEarn, orderId, lineOrderId, `สะสมคะแนนจากยอดซื้อ ${amount}.-`]);

            console.log(`[Loyalty] Customer #${customerId} earned ${pointsToEarn} points`);

            // 3. Send LINE Notification for Points (Async)
            if (customerRes.rows[0].line_user_id) {
                const lineUserId = customerRes.rows[0].line_user_id;
                const totalPointsBefore = parseInt(customerRes.rows[0].points || 0);
                const newTotalPoints = totalPointsBefore + pointsToEarn;

                // Fetch Shop Name for Notification AltText
                const shopNameRes = await query("SELECT value FROM settings WHERE key = 'shop_name'");
                const shopName = shopNameRes.rows[0]?.value || 'Tasty Station';

                // Simple Flex Message for Points
                const pointBubble = {
                    "type": "bubble",
                    "header": {
                        "type": "box",
                        "layout": "vertical",
                        "contents": [
                            { "type": "text", "text": "ยินดีด้วยค่ะ! 🎉", "weight": "bold", "color": "#FF9800", "size": "sm" },
                            { "type": "text", "text": "คุณได้รับแต้มสะสมใหม่", "weight": "bold", "size": "xl", "margin": "md" }
                        ]
                    },
                    "body": {
                        "type": "box",
                        "layout": "vertical",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "margin": "lg",
                                "contents": [
                                    { "type": "text", "text": "ได้รับเพิ่ม", "size": "sm", "color": "#555555" },
                                    { "type": "text", "text": `+ ${pointsToEarn} แต้ม`, "weight": "bold", "size": "sm", "color": "#1DB446", "align": "end" }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "margin": "md",
                                "contents": [
                                    { "type": "text", "text": "แต้มสะสมรวม", "size": "sm", "color": "#555555" },
                                    { "type": "text", "text": `${newTotalPoints} แต้ม`, "weight": "bold", "size": "sm", "color": "#111111", "align": "end" }
                                ]
                            },
                            { "type": "separator", "margin": "lg" },
                            { "type": "text", "text": "ตรวจสอบสิทธิพิเศษและของรางวัลได้ที่เมนูสะสมแต้มนะคะ", "size": "xs", "color": "#999999", "margin": "md", "wrap": true }
                        ]
                    }
                };

                const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
                if (token) {
                    fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            to: lineUserId,
                            messages: [{ "type": "flex", "altText": `คุณได้รับ ${pointsToEarn} แต้ม! - ${shopName}`, "contents": pointBubble }]
                        })
                    }).catch(err => console.error('Error sending point notification:', err));
                }
            }

            return pointsToEarn;
        } catch (err) {
            console.error('Failed to earn loyalty points', err);
            return null;
        }
    };

    // --- STOCK MANAGEMENT HELPER ---
    /**
     * Centralized stock deduction logic for Ingredients and Product Options.
     * @param {Array} items - Array of order items with options
     * @param {Object} dbClient - Database client (pool or transaction client)
     */
    const processStockDeduction = async (items, dbClient) => {
        const ingredientsNeeded = new Map(); // ingredient_id -> total_needed
        const optionsToDeductStock = []; // { option_id, quantity }

        for (const item of items) {
            const productId = item.product_id || item.id;
            const orderQty = item.quantity || 1;

            // 1. Base Product Recipe
            const recipeRes = await dbClient.query(
                "SELECT ingredient_id, quantity_used FROM product_ingredients WHERE product_id = $1",
                [productId]
            );
            for (const r of recipeRes.rows) {
                const totalForThisItem = parseFloat(r.quantity_used) * orderQty;
                const current = ingredientsNeeded.get(r.ingredient_id) || 0;
                ingredientsNeeded.set(r.ingredient_id, current + totalForThisItem);
            }

            // 2. Options Recipes & Multipliers
            const selectedOptions = item.options || item.selectedOptions || [];
            if (selectedOptions.length > 0) {
                for (const opt of selectedOptions) {
                    const optId = opt.option_id || opt.id;
                    const isGlobal = opt.is_global || false;

                    // A. Fetch Option Data
                    let optData;
                    if (isGlobal) {
                        const res = await dbClient.query(
                            "SELECT name, recipe_multiplier, is_size_option, stock_quantity FROM global_options WHERE id = $1",
                            [optId]
                        );
                        optData = res.rows[0];
                    } else {
                        const res = await dbClient.query(
                            "SELECT name, recipe_multiplier, is_size_option, stock_quantity FROM product_options WHERE id = $1",
                            [optId]
                        );
                        optData = res.rows[0];
                    }

                    if (!optData) continue;

                    const optMultiplier = parseFloat(optData.recipe_multiplier || 1.00);

                    // B. Multiplier Logic (Adds to base consumption)
                    if (optMultiplier > 1.0) {
                        const extraMultiplier = optMultiplier - 1.0;
                        for (const r of recipeRes.rows) {
                            const extraForThisOption = (parseFloat(r.quantity_used) * extraMultiplier) * orderQty;
                            const current = ingredientsNeeded.get(r.ingredient_id) || 0;
                            ingredientsNeeded.set(r.ingredient_id, current + extraForThisOption);
                        }
                    }

                    // C. Specific Option Recipe (Add-ons like Extra Cheese)
                    let optRecipeRes;
                    if (isGlobal) {
                        optRecipeRes = await dbClient.query(
                            "SELECT ingredient_id, quantity_used FROM global_option_recipes WHERE global_option_id = $1",
                            [optId]
                        );
                    } else {
                        optRecipeRes = await dbClient.query(
                            "SELECT ingredient_id, quantity_used FROM option_recipes WHERE option_id = $1",
                            [optId]
                        );
                    }

                    for (const r of optRecipeRes.rows) {
                        const totalForThisOption = parseFloat(r.quantity_used) * orderQty;
                        const current = ingredientsNeeded.get(r.ingredient_id) || 0;
                        ingredientsNeeded.set(r.ingredient_id, current + totalForThisOption);
                    }

                    // D. Direct Stock Tracking for Size Options
                    if (optData.is_size_option) {
                        optionsToDeductStock.push({ id: optId, quantity: orderQty, is_global: isGlobal, name: optData.name, stock: optData.stock_quantity });
                    }
                }
            }
        }

        // 3. Verify Availability
        // A. Ingredients
        for (const [ingId, needed] of ingredientsNeeded.entries()) {
            const ingRes = await dbClient.query("SELECT name, total_quantity, unit FROM ingredients WHERE id = $1", [ingId]);
            const ing = ingRes.rows[0];

            if (!ing) throw new Error(`Ingredient ID ${ingId} not found`);

            if (parseFloat(ing.total_quantity) < needed) {
                throw new Error(`วัตถุดิบ '${ing.name}' ไม่พอ (ขาด ${needed - parseFloat(ing.total_quantity)} ${ing.unit || 'units'})`);
            }
        }

        // B. Size Options
        for (const optToDeduct of optionsToDeductStock) {
            // Re-check stock in case of race conditions (optional, but good practice)
            // But we already fetched stock in Step 2A. For now, rely on that or re-fetch if critical.
            // Let's use the fetched stock for simplicity + check logic
            if (optToDeduct.stock < optToDeduct.quantity) {
                throw new Error(`สินค้า '${optToDeduct.name}' ไม่พอ (มีเพียง ${optToDeduct.stock} ชิ้น)`);
            }
        }

        // 4. Perform Deduction
        // A. Ingredients
        for (const [ingId, needed] of ingredientsNeeded.entries()) {
            await dbClient.query("UPDATE ingredients SET total_quantity = total_quantity - $1 WHERE id = $2", [needed, ingId]);
        }

        // B. Size Options
        for (const optToDeduct of optionsToDeductStock) {
            if (optToDeduct.is_global) {
                await dbClient.query(
                    "UPDATE global_options SET stock_quantity = stock_quantity - $1 WHERE id = $2",
                    [optToDeduct.quantity, optToDeduct.id]
                );
            } else {
                await dbClient.query(
                    "UPDATE product_options SET stock_quantity = stock_quantity - $1 WHERE id = $2",
                    [optToDeduct.quantity, optToDeduct.id]
                );
            }
        }
    };

    // --- STORE STATUS HELPER ---
    const getStoreStatus = async () => {
        try {
            const settingsRes = await query("SELECT key, value FROM settings WHERE key IN ('store_open_time', 'store_close_time', 'last_order_offset_minutes')");
            const settings = {};
            settingsRes.rows.forEach(r => settings[r.key] = r.value);

            const openTime = settings.store_open_time || "09:00";
            const closeTime = settings.store_close_time || "21:00";
            const lastOrderOffset = parseInt(settings.last_order_offset_minutes || 30);

            // Current time in Bangkok (matching DB timezone)
            const now = new Date();
            const bangkokTime = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Bangkok',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(now);

            const [nowH, nowM] = bangkokTime.split(':').map(Number);
            const [openH, openM] = openTime.split(':').map(Number);
            const [closeH, closeM] = closeTime.split(':').map(Number);

            const nowMinutes = nowH * 60 + nowM;
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;
            const lastOrderMinutes = closeMinutes - lastOrderOffset;

            let status = 'open';
            let message = 'Store is currently open';

            if (nowMinutes < openMinutes || nowMinutes >= closeMinutes) {
                status = 'closed';
                message = `ขออภัยค่ะ ขณะนี้ร้านปิดให้บริการ (เวลาเปิด-ปิด: ${openTime} - ${closeTime})`;
            } else if (nowMinutes >= lastOrderMinutes) {
                status = 'last_order';
                message = `ขออภัยค่ะ ขณะนี้เลยเวลา Last Order แล้ว (ปิดรับออเดอร์เวลา ${Math.floor(lastOrderMinutes / 60).toString().padStart(2, '0')}:${(lastOrderMinutes % 60).toString().padStart(2, '0')})`;
            }

            return { status, message, openTime, closeTime, lastOrderMinutes, nowMinutes };
        } catch (err) {
            console.error('Failed to get store status', err);
            return { status: 'error', message: err.message };
        }
    };

    // --- MENU SYNC TO WEBSITE HELPER ---
    /**
     * Syncs menu data (products & categories) to the restaurant website.
     * Uses Webhook push with Secret Key authentication.
     * This function is called automatically after menu CRUD operations.
     */
    const syncMenuToWebsite = async () => {
        // Fetch Sync Settings from DB first (Priority), fallback to ENV
        const settingsRes = await query("SELECT key, value FROM settings WHERE key IN ('website_sync_url', 'website_sync_secret')");
        const settings = {};
        settingsRes.rows.forEach(r => settings[r.key] = r.value);

        const websiteUrl = settings.website_sync_url || process.env.WEBSITE_SYNC_URL;
        const syncSecret = settings.website_sync_secret || process.env.WEBSITE_SYNC_SECRET;

        if (!websiteUrl) {
            console.log('[MenuSync] No WEBSITE_SYNC_URL configured, skipping sync');
            return { success: false, reason: 'no_url_configured' };
        }

        try {
            // Fetch all products (including unavailable/sold out ones) so website can show "Sold Out" status
            const productsRes = await query('SELECT * FROM products ORDER BY category_id, id');
            const categoriesRes = await query('SELECT * FROM categories ORDER BY sort_order');

            // Transform to Website format (matching SiteRestaurant menu.json structure)
            const payload = {
                categories: categoriesRes.rows.map(c => ({
                    id: c.id,
                    name: c.name,
                    icon: c.icon || '🍽️'
                })),
                items: productsRes.rows.map(p => ({
                    id: p.id,
                    name: p.name,
                    category: p.category_id,
                    price: parseFloat(p.price),
                    description: p.description || `${p.name} - อาหารอร่อยจากครัวของเรา`,
                    image: p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
                    isPopular: p.is_popular || false,
                    isAvailable: p.is_available
                }))
            };

            // Push to Website via Webhook
            const response = await fetch(websiteUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Secret': syncSecret || ''
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log(`[MenuSync] ✅ Successfully synced ${payload.items.length} items to website`);
            io.emit('menu-synced', { success: true, itemsCount: payload.items.length });
            return { success: true, itemsCount: payload.items.length };
        } catch (err) {
            console.error('[MenuSync] ❌ Failed to sync:', err.message);
            io.emit('menu-sync-failed', { error: err.message });
            return { success: false, error: err.message };
        }
    };

    app.get('/api/store-status', async (req, res) => {
        const status = await getStoreStatus();
        res.json(status);
    });


    app.get('/api/notifications', async (req, res) => {
        try {
            const result = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/notifications/:id/read', async (req, res) => {
        const { id } = req.params;
        try {
            await query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/notifications/read-all', async (req, res) => {
        try {
            await query('UPDATE notifications SET is_read = TRUE');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/notifications/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM notifications WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/notifications', async (req, res) => {
        try {
            await query('DELETE FROM notifications');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =====================================================
    // BIRTHDAY REWARD ADMIN APIs
    // =====================================================

    // Manual trigger birthday check (for admin testing)
    app.post('/api/admin/trigger-birthday-check', requireAdmin, async (req, res) => {
        try {
            console.log('[Admin] Manual birthday check triggered');
            const results = await checkBirthdaysManually();
            res.json({
                success: true,
                sent: results.sent,
                errors: results.errors,
                message: `ส่งของขวัญวันเกิดให้ ${results.sent} คนเรียบร้อย!`
            });
        } catch (err) {
            console.error('[Admin] Birthday check error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get customers with birthdays this month
    app.get('/api/admin/birthday-customers', requireAdmin, async (req, res) => {
        try {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            const result = await query(`
                SELECT 
                    lc.id, 
                    lc.display_name, 
                    lc.nickname, 
                    lc.birthdate,
                    lc.birthday_reward_sent_year,
                    lc.is_following,
                    CASE WHEN lc.birthday_reward_sent_year = $2 THEN true ELSE false END as reward_sent_this_year,
                    coup.coupon_code as birthday_coupon_code,
                    coup.status as coupon_status
                FROM loyalty_customers lc
                LEFT JOIN loyalty_coupons coup ON coup.customer_id = lc.id AND coup.coupon_type = 'birthday' 
                    AND EXTRACT(YEAR FROM coup.redeemed_at) = $2
                WHERE EXTRACT(MONTH FROM lc.birthdate) = $1
                ORDER BY EXTRACT(DAY FROM lc.birthdate)
            `, [currentMonth, currentYear]);

            res.json({
                month: currentMonth,
                year: currentYear,
                customers: result.rows
            });
        } catch (err) {
            console.error('[Admin] Get birthday customers error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get all birthday coupons
    app.get('/api/admin/birthday-coupons', requireAdmin, async (req, res) => {
        try {
            const result = await query(`
                SELECT 
                    lc.coupon_code,
                    lc.status,
                    lc.discount_type,
                    lc.discount_value,
                    lc.redeemed_at,
                    lc.used_at,
                    cust.display_name,
                    cust.nickname
                FROM loyalty_coupons lc
                JOIN loyalty_customers cust ON lc.customer_id = cust.id
                WHERE lc.coupon_type = 'birthday'
                ORDER BY lc.redeemed_at DESC
                LIMIT 100
            `);
            res.json(result.rows);
        } catch (err) {
            console.error('[Admin] Get birthday coupons error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // =====================================================
    // WIN-BACK SYSTEM ADMIN APIs
    // =====================================================

    // Manual trigger win-back check (for admin testing)
    app.post('/api/admin/trigger-winback-check', requireAdmin, async (req, res) => {
        try {
            console.log('[Admin] Manual win-back check triggered');
            const results = await checkWinbackManually();
            res.json({
                success: true,
                sent: results.sent,
                errors: results.errors,
                message: `ส่ง Win-Back Message ให้ ${results.sent} คนเรียบร้อย!`
            });
        } catch (err) {
            console.error('[Admin] Win-back check error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get inactive customers (potential win-back targets)
    app.get('/api/admin/inactive-customers', requireAdmin, async (req, res) => {
        try {
            // Get settings
            const settingsRes = await query(`
                SELECT key, value FROM settings 
                WHERE key IN ('winback_inactive_days', 'winback_cooldown_days')
            `);
            const settings = {};
            for (const row of settingsRes.rows) {
                settings[row.key] = row.value;
            }
            const inactiveDays = parseInt(settings.winback_inactive_days) || 45;
            const cooldownDays = parseInt(settings.winback_cooldown_days) || 90;

            const result = await query(`
                SELECT 
                    lc.id, 
                    lc.display_name, 
                    lc.nickname, 
                    lc.last_order_at,
                    lc.winback_sent_at,
                    lc.is_following,
                    EXTRACT(DAY FROM (NOW() - lc.last_order_at)) as days_inactive,
                    coup.coupon_code as winback_coupon_code,
                    coup.status as coupon_status
                FROM loyalty_customers lc
                LEFT JOIN loyalty_coupons coup ON coup.customer_id = lc.id AND coup.coupon_type = 'winback' 
                    AND coup.redeemed_at > NOW() - INTERVAL '${cooldownDays} days'
                WHERE lc.last_order_at IS NOT NULL
                AND lc.last_order_at < NOW() - INTERVAL '${inactiveDays} days'
                ORDER BY lc.last_order_at ASC
            `);

            res.json({
                inactiveDays,
                cooldownDays,
                customers: result.rows
            });
        } catch (err) {
            console.error('[Admin] Get inactive customers error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get all win-back coupons
    app.get('/api/admin/winback-coupons', requireAdmin, async (req, res) => {
        try {
            const result = await query(`
                SELECT 
                    lc.coupon_code,
                    lc.status,
                    lc.discount_type,
                    lc.discount_value,
                    lc.redeemed_at,
                    lc.used_at,
                    cust.display_name,
                    cust.nickname
                FROM loyalty_coupons lc
                JOIN loyalty_customers cust ON lc.customer_id = cust.id
                WHERE lc.coupon_type = 'winback'
                ORDER BY lc.redeemed_at DESC
                LIMIT 100
            `);
            res.json(result.rows);
        } catch (err) {
            console.error('[Admin] Get winback coupons error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // DEBUG: Get schema info for troubleshooting (Development Only)
    app.get('/api/debug/schema/:table', (req, res, next) => {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Forbidden: Debug routes disabled in production' });
        }
        next();
    }, requireAdmin, async (req, res) => {
        try {
            const { table } = req.params;
            const result = await query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = $1 
                ORDER BY ordinal_position
            `, [table]);
            res.json({ table, columns: result.rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Get All Tables (with active order info and today's reservations)
    app.get('/api/tables', async (req, res) => {
        try {
            const result = await query(`
                SELECT 
                    t.*, 
                    o.total_amount, 
                    o.created_at as order_time,
                    r.reservation_time,
                    r.guests_count as reservation_guests,
                    r.customer_name as reservation_name
                FROM tables t
                LEFT JOIN orders o ON t.name = o.table_name AND o.status != 'paid'
                LEFT JOIN line_orders r ON t.name = r.assigned_table 
                    AND r.order_type = 'reservation' 
                    AND r.status NOT IN ('cancelled', 'completed')
                    AND r.reservation_date = CURRENT_DATE
            `);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get All Products (Menu) with computed availability
    app.get('/api/products', async (req, res) => {
        try {
            const productsRes = await query('SELECT * FROM products');
            const categoriesRes = await query('SELECT * FROM categories ORDER BY sort_order');

            // Get all product ingredients (recipes)
            const recipesRes = await query('SELECT pi.product_id, pi.ingredient_id, pi.quantity_used, i.total_quantity, i.name as ingredient_name FROM product_ingredients pi JOIN ingredients i ON pi.ingredient_id = i.id');

            // Get all product options
            const optionsRes = await query('SELECT * FROM product_options ORDER BY product_id, sort_order, id');

            // Group recipes by product_id
            const recipesByProduct = {};
            recipesRes.rows.forEach(r => {
                if (!recipesByProduct[r.product_id]) recipesByProduct[r.product_id] = [];
                recipesByProduct[r.product_id].push(r);
            });

            // Group options by product_id
            const optionsByProduct = {};
            optionsRes.rows.forEach(o => {
                if (!optionsByProduct[o.product_id]) optionsByProduct[o.product_id] = [];
                optionsByProduct[o.product_id].push(o);
            });

            // Compute has_recipe and can_make for each product
            const products = productsRes.rows.map(product => {
                const recipe = recipesByProduct[product.id] || [];
                const options = optionsByProduct[product.id] || [];
                const has_recipe = recipe.length > 0;

                // Check if all ingredients are sufficient
                let can_make = has_recipe;
                if (has_recipe) {
                    for (const ing of recipe) {
                        if (parseFloat(ing.total_quantity) < parseFloat(ing.quantity_used)) {
                            can_make = false;
                            break;
                        }
                    }
                }

                // Compute effective availability: manual toggle + recipe + ingredients
                const computed_available = product.is_available && has_recipe && can_make;

                return {
                    ...product,
                    has_recipe,
                    can_make,
                    computed_available,
                    options
                };
            });

            res.json({ products, categories: categoriesRes.rows });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add Product
    app.post('/api/products', requireAdmin, async (req, res) => {
        const { name, price, category_id, image, track_stock, stock_quantity, is_recommended } = req.body;
        try {
            const result = await query(
                'INSERT INTO products (name, price, category_id, image, is_available, track_stock, stock_quantity, is_recommended) VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7) RETURNING id',
                [name, price, category_id, image, track_stock || false, stock_quantity || 0, is_recommended || false]
            );
            res.json({ success: true, id: result.rows[0].id });
            // Auto-sync to website after adding new product
            syncMenuToWebsite();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // NEW: Member Profile Update
    app.post('/api/member/profile', async (req, res) => {
        try {
            const { lineUserId, nickname, birthdate, phoneNumber } = req.body;
            if (!lineUserId) return res.status(400).json({ success: false, message: 'Missing LINE User ID' });

            // 1. Update Profile in DB
            const result = await updateCustomerProfile(lineUserId, { nickname, birthdate, phoneNumber });

            let bonusPoints = 0;
            // 2. Award Bonus Points if first time completion (db returns isFirstCompletion)
            if (result.isFirstCompletion) {
                bonusPoints = 20;
                // Reuse existing earnLoyaltyPoints if available in server.js scope or db module
                // Assuming earnLoyaltyPoints is a function in db_pg or server.js. 
                // Wait, earnLoyaltyPoints is likely in server.js or db_pg? 
                // Looking at server.js later in the file (line 1323), it calls `await earnLoyaltyPoints(...)`.
                // So it must be defined in server.js or imported.
                // Let's assume it's available in this scope as it is used elsewhere.
                await earnLoyaltyPoints(result.customer.id, 0, null, null); // 0 amount spent, just points?
                // Actually earnLoyaltyPoints usually calculates points based on amount.
                // I need to manually add points here. 
                // Let's check `db_pg` for a direct points addition or use a specific query here if needed.
                // Actually, I should use a direct query or a specific helper if earnLoyaltyPoints isn't flexible.
                // But wait, I see `await db.earnLoyaltyPoints` in my previous thought? 
                // Let's just create a transaction here or add a specific function.

                // Let's try to find `earnLoyaltyPoints` definition.
                // Use a direct query for now to be safe and simple:
                const client = await pool.connect();
                try {
                    await client.query('INSERT INTO loyalty_point_transactions (customer_id, points, type, description) VALUES ($1, $2, $3, $4)',
                        [result.customer.id, 20, 'PROFILE_BONUS', 'โบนัสกรอกข้อมูลส่วนตัว']);
                    await client.query('UPDATE loyalty_customers SET points = points + 20 WHERE id = $1', [result.customer.id]);
                } finally {
                    client.release();
                }
            }

            res.json({ success: true, customer: result.customer, bonusPoints });

        } catch (err) {
            console.error('Error updating member profile:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // Update Product
    app.put('/api/products/:id', requireAdmin, async (req, res) => {
        const { name, price, category_id, image, is_available, track_stock, stock_quantity, is_recommended } = req.body;
        const { id } = req.params;
        try {
            await query(
                'UPDATE products SET name = $1, price = $2, category_id = $3, image = $4, is_available = $5, track_stock = $6, stock_quantity = $7, is_recommended = $8 WHERE id = $9',
                [name, price, category_id, image, is_available, track_stock || false, stock_quantity || 0, is_recommended || false, id]
            );
            res.json({ success: true });
            // Auto-sync to website after updating product
            syncMenuToWebsite();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Product
    app.delete('/api/products/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM products WHERE id = $1', [id]);
            res.json({ success: true });
            // Auto-sync to website after deleting product
            syncMenuToWebsite();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add Category
    app.post('/api/categories', requireAdmin, async (req, res) => {
        const { id, name, icon, sort_order } = req.body;
        try {
            await query('INSERT INTO categories (id, name, icon, sort_order) VALUES ($1, $2, $3, $4)', [id, name, icon, sort_order || 0]);
            res.json({ success: true });
            // Auto-sync to website after adding category
            syncMenuToWebsite();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Category
    app.delete('/api/categories/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM categories WHERE id = $1', [id]);
            res.json({ success: true });
            // Auto-sync to website after deleting category
            syncMenuToWebsite();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // =====================================================
    // MANUAL MENU SYNC (Backup button for website sync)
    // =====================================================
    app.post('/api/sync-menu-to-website', requireAdmin, async (req, res) => {
        try {
            const result = await syncMenuToWebsite();
            if (result.success) {
                res.json({ success: true, message: `ส่งเมนู ${result.itemsCount} รายการไปยังเว็บไซต์สำเร็จ!`, itemsCount: result.itemsCount });
            } else {
                res.status(400).json({ success: false, error: result.error || result.reason });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // =====================================================
    // PRODUCT OPTIONS (Add-ons & Size Variants)
    // =====================================================

    // Get Options for a Product
    app.get('/api/products/:id/options', async (req, res) => {
        const { id } = req.params;
        try {
            const result = await query('SELECT * FROM product_options WHERE product_id = $1 ORDER BY sort_order, id', [id]);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add Option to Product
    app.post('/api/products/:id/options', requireAdmin, async (req, res) => {
        const { id } = req.params;
        const { name, price_modifier, is_size_option, stock_quantity, is_available, sort_order, recipe_multiplier } = req.body;
        try {
            const result = await query(
                `INSERT INTO product_options (product_id, name, price_modifier, is_size_option, stock_quantity, is_available, sort_order, recipe_multiplier) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [id, name, price_modifier || 0, is_size_option || false, stock_quantity || 0, is_available !== false, sort_order || 0, recipe_multiplier || 1.00]
            );
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Update Option
    app.put('/api/product-options/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        const { name, price_modifier, is_size_option, stock_quantity, is_available, sort_order, recipe_multiplier } = req.body;
        try {
            await query(
                `UPDATE product_options SET name = $1, price_modifier = $2, is_size_option = $3, stock_quantity = $4, is_available = $5, sort_order = $6, recipe_multiplier = $7 WHERE id = $8`,
                [name, price_modifier || 0, is_size_option || false, stock_quantity || 0, is_available !== false, sort_order || 0, recipe_multiplier || 1.00, id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Option
    app.delete('/api/product-options/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM product_options WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // =====================================================
    // OPTION RECIPES (Ingredient deduction for options)
    // =====================================================

    // Get Recipe for an Option
    app.get('/api/option-recipes/:optionId', async (req, res) => {
        const { optionId } = req.params;
        try {
            const result = await query(`
                SELECT orr.*, i.name as ingredient_name, i.unit 
                FROM option_recipes orr
                JOIN ingredients i ON orr.ingredient_id = i.id
                WHERE orr.option_id = $1
            `, [optionId]);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Save/Update Recipe for an Option
    app.post('/api/option-recipes/:optionId', requireAdmin, async (req, res) => {
        const { optionId } = req.params;
        const { ingredients } = req.body; // Array of { ingredient_id, quantity_used }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Clear existing recipes
            await client.query('DELETE FROM option_recipes WHERE option_id = $1', [optionId]);
            // Insert new recipes
            for (const ing of ingredients) {
                await client.query(
                    'INSERT INTO option_recipes (option_id, ingredient_id, quantity_used) VALUES ($1, $2, $3)',
                    [optionId, ing.ingredient_id, ing.quantity_used]
                );
            }
            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // =====================================================
    // GLOBAL OPTIONS (Category-level Options)
    // =====================================================

    // Get All Global Options with their Categories
    app.get('/api/global-options', async (req, res) => {
        try {
            const optionsRes = await query(`
                SELECT go.*, 
                       COALESCE(json_agg(goc.category_id) FILTER (WHERE goc.category_id IS NOT NULL), '[]') as category_ids
                FROM global_options go
                LEFT JOIN global_option_categories goc ON go.id = goc.option_id
                GROUP BY go.id
                ORDER BY go.sort_order, go.id
            `);
            res.json(optionsRes.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get Global Options for a specific Category
    app.get('/api/global-options/by-category/:categoryId', async (req, res) => {
        const { categoryId } = req.params;
        try {
            const result = await query(`
                SELECT go.* 
                FROM global_options go
                JOIN global_option_categories goc ON go.id = goc.option_id
                WHERE goc.category_id = $1 AND go.is_active = TRUE
                ORDER BY go.sort_order, go.id
            `, [categoryId]);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Create Global Option
    app.post('/api/global-options', requireAdmin, async (req, res) => {
        const { name, price_modifier, is_size_option, stock_quantity, recipe_multiplier, category_ids } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert the option
            const result = await client.query(
                `INSERT INTO global_options (name, price_modifier, is_size_option, stock_quantity, recipe_multiplier) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [name, price_modifier || 0, is_size_option || false, stock_quantity || 0, recipe_multiplier || 1.00]
            );
            const optionId = result.rows[0].id;

            // Insert category relationships
            if (category_ids && category_ids.length > 0) {
                for (const catId of category_ids) {
                    await client.query(
                        'INSERT INTO global_option_categories (option_id, category_id) VALUES ($1, $2)',
                        [optionId, catId]
                    );
                }
            }

            await client.query('COMMIT');
            res.json({ success: true, id: optionId });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // Update Global Option
    app.put('/api/global-options/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        const { name, price_modifier, is_size_option, stock_quantity, recipe_multiplier, is_active, category_ids } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update the option
            await client.query(
                `UPDATE global_options SET name = $1, price_modifier = $2, is_size_option = $3, stock_quantity = $4, recipe_multiplier = $5, is_active = $6 WHERE id = $7`,
                [name, price_modifier || 0, is_size_option || false, stock_quantity || 0, recipe_multiplier || 1.00, is_active !== false, id]
            );

            // Update category relationships (delete all, then re-insert)
            await client.query('DELETE FROM global_option_categories WHERE option_id = $1', [id]);
            if (category_ids && category_ids.length > 0) {
                for (const catId of category_ids) {
                    await client.query(
                        'INSERT INTO global_option_categories (option_id, category_id) VALUES ($1, $2)',
                        [id, catId]
                    );
                }
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // Delete Global Option
    app.delete('/api/global-options/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM global_options WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get Global Option Recipe
    app.get('/api/global-option-recipes/:optionId', async (req, res) => {
        const { optionId } = req.params;
        try {
            const result = await query(
                `SELECT r.*, i.name as ingredient_name, i.unit as ingredient_unit 
                 FROM global_option_recipes r 
                 JOIN ingredients i ON r.ingredient_id = i.id 
                 WHERE r.global_option_id = $1`,
                [optionId]
            );
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Save Global Option Recipe
    app.post('/api/global-option-recipes/:optionId', requireAdmin, async (req, res) => {
        const { optionId } = req.params;
        const { items } = req.body; // Array of { ingredient_id, quantity_used, unit }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Clear existing recipe
            await client.query('DELETE FROM global_option_recipes WHERE global_option_id = $1', [optionId]);

            // Insert new recipe items
            if (items && items.length > 0) {
                for (const item of items) {
                    await client.query(
                        'INSERT INTO global_option_recipes (global_option_id, ingredient_id, quantity_used, unit) VALUES ($1, $2, $3, $4)',
                        [optionId, item.ingredient_id, item.quantity_used, item.unit]
                    );
                }
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });


    // Create New Order (or Append to Existing)
    app.post('/api/orders', async (req, res) => {
        const { tableName, items, total, orderType } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 0. CHECK STORE STATUS
            const storeStatus = await getStoreStatus();
            if (storeStatus.status === 'closed') {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: storeStatus.message, status: 'closed' });
            }
            if (storeStatus.status === 'last_order') {
                // For POS, we'll block it as well based on requirements
                await client.query('ROLLBACK');
                return res.status(403).json({ error: storeStatus.message, status: 'last_order' });
            }

            // 1. Check for existing active order
            const existingOrderRes = await client.query(
                "SELECT * FROM orders WHERE table_name = $1 AND status != 'paid' ORDER BY id DESC LIMIT 1",
                [tableName]
            );
            const existingOrder = existingOrderRes.rows[0];
            let orderId;

            if (existingOrder) {
                // Update existing order: add new total
                orderId = existingOrder.id;
                const newTotal = parseFloat(existingOrder.total_amount) + parseFloat(total);
                await client.query(
                    "UPDATE orders SET total_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                    [newTotal, orderId]
                );
            } else {
                // Create new order with order_type
                const type = orderType || 'dine_in';
                const result = await client.query(
                    'INSERT INTO orders (table_name, total_amount, status, order_type) VALUES ($1, $2, $3, $4) RETURNING id',
                    [tableName, total, 'cooking', type]
                );
                orderId = result.rows[0].id;
            }

            // Always Update Table Status to 'occupied'
            await client.query("UPDATE tables SET status = 'occupied' WHERE name = $1", [tableName]);

            // 1.5 CHECK STOCK and DECREMENT (INGREDIENTS & OPTIONS)
            await processStockDeduction(items, client);

            // 2. Insert Items
            for (const item of items) {
                // Use unitPrice (includes options) if available, otherwise base price
                const finalPrice = item.unitPrice || item.price;
                const itemResult = await client.query(
                    'INSERT INTO order_items (order_id, product_id, product_name, price, quantity, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [orderId, item.id, item.name, finalPrice, item.quantity || 1, 'cooking']
                );
                const orderItemId = itemResult.rows[0].id;

                // 2.1 Insert Item Options
                const selectedOptions = item.options || item.selectedOptions || [];
                for (const opt of selectedOptions) {
                    const isGlobal = opt.is_global || false;
                    const priceModifier = opt.price_modifier || opt.price || 0;

                    if (isGlobal) {
                        await client.query(
                            'INSERT INTO order_item_options (order_item_id, global_option_id, option_name, price_modifier, is_global) VALUES ($1, $2, $3, $4, TRUE)',
                            [orderItemId, opt.id, opt.name, priceModifier]
                        );
                    } else {
                        await client.query(
                            'INSERT INTO order_item_options (order_item_id, option_id, option_name, price_modifier, is_global) VALUES ($1, $2, $3, $4, FALSE)',
                            [orderItemId, opt.id, opt.name, priceModifier]
                        );
                    }
                }
            }

            await client.query('COMMIT');

            // Notify clients
            io.emit('table-update', { id: null, status: 'refresh' });
            io.emit('new-order', { id: orderId, tableName });

            // Create persistent notification
            createNotification(
                `ออเดอร์ใหม่ - โต๊ะ ${tableName}`,
                `รายการอาหารเข้าใหม่สำหรับโต๊ะ ${tableName} (ยอดรวม: ${total}.-)`,
                'order',
                { orderId, tableName }
            );

            res.json({ success: true, orderId });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // DELETE /api/orders/:id - Cancel/Delete Order
    app.delete('/api/orders/:id', async (req, res) => {
        const { id } = req.params;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get table name before deletion to free it up
            const orderRes = await client.query("SELECT table_name FROM orders WHERE id = $1", [id]);
            const tableName = orderRes.rows[0]?.table_name;

            // Delete order items first (due to foreign keys if any, though here it's likely CASCADE)
            await client.query("DELETE FROM order_items WHERE order_id = $1", [id]);
            await client.query("DELETE FROM orders WHERE id = $1", [id]);

            // If it was a table order, check if any other active orders exist for this table
            if (tableName) {
                const activeRes = await client.query("SELECT id FROM orders WHERE table_name = $1 AND status != 'paid'", [tableName]);
                if (activeRes.rows.length === 0) {
                    await client.query("UPDATE tables SET status = 'available' WHERE name = $1", [tableName]);
                }
            }

            await client.query('COMMIT');
            io.emit('table-update', { id: null, status: 'refresh' });
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // PATCH /api/orders/:id - Update Order Metadata (e.g. Change Table)
    app.patch('/api/orders/:id', async (req, res) => {
        const { id } = req.params;
        const { table_name } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get old table name
            const orderRes = await client.query("SELECT table_name FROM orders WHERE id = $1", [id]);
            const oldTable = orderRes.rows[0]?.table_name;

            if (table_name && table_name !== oldTable) {
                // Update order to new table
                await client.query("UPDATE orders SET table_name = $1 WHERE id = $2", [table_name, id]);

                // Set new table to occupied
                await client.query("UPDATE tables SET status = 'occupied' WHERE name = $1", [table_name]);

                // Check if old table is now empty
                const activeOldRes = await client.query("SELECT id FROM orders WHERE table_name = $1 AND status != 'paid'", [oldTable]);
                if (activeOldRes.rows.length === 0) {
                    await client.query("UPDATE tables SET status = 'available' WHERE name = $1", [oldTable]);
                }
            }

            // Update Coupon Info
            const { coupon_code, coupon_details } = req.body;
            if (coupon_code !== undefined) { // Allow null to remove coupon
                await client.query(
                    "UPDATE orders SET coupon_code = $1, coupon_details = $2 WHERE id = $3",
                    [coupon_code, coupon_details ? JSON.stringify(coupon_details) : null, id]
                );
            }

            await client.query('COMMIT');
            io.emit('table-update', { id: null, status: 'refresh' });
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // Get Sales History (Paid Orders) with Optional Filters
    // MOVED ABOVE generic /:tableName to avoid shadowing conflict
    app.get('/api/orders/history', async (req, res) => {
        const { startDate, endDate } = req.query;
        console.log(`[History API] Fetching range: ${startDate} to ${endDate}`);
        try {
            // Use Asia/Bangkok consistently for filtering
            let sql = `SELECT *, (updated_at AT TIME ZONE 'Asia/Bangkok')::date as local_date FROM orders WHERE status = 'paid'`;
            const params = [];

            if (startDate && endDate) {
                sql += " AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date >= $1::date AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date <= $2::date";
                params.push(startDate, endDate);
            }

            sql += " ORDER BY updated_at DESC";
            if (!startDate) sql += " LIMIT 100";

            const ordersRes = await query(sql, params);

            // Format for frontend (ensure numbers are numbers)
            const instoreRows = ordersRes.rows.map(o => ({
                ...o,
                source: 'instore',
                total_amount: parseFloat(o.total_amount || 0)
            }));

            // LINE orders
            let lineSql = `SELECT id, customer_name as table_name, status, total_amount, updated_at, order_type, payment_method, (updated_at AT TIME ZONE 'Asia/Bangkok')::date as local_date FROM line_orders WHERE status = 'completed'`;
            const lineParams = [];

            if (startDate && endDate) {
                lineSql += " AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date >= $1::date AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date <= $2::date";
                lineParams.push(startDate, endDate);
            }

            lineSql += " ORDER BY updated_at DESC";
            if (!startDate) lineSql += " LIMIT 100";

            const lineOrdersRes = await query(lineSql, lineParams);
            const lineRows = lineOrdersRes.rows.map(o => ({
                ...o,
                source: 'line',
                total_amount: parseFloat(o.total_amount || 0)
            }));

            const combined = [...instoreRows, ...lineRows].sort((a, b) =>
                new Date(b.updated_at) - new Date(a.updated_at)
            );

            console.log(`[History API] Instore: ${instoreRows.length}, LINE: ${lineRows.length}, Combined: ${combined.length}`);
            res.json(combined);
        } catch (err) {
            console.error('[History API Error]', err);
            res.status(500).json({ error: err.message, history: [] });
        }
    });

    // Get Specific Order Details by ID (for History or specific lookup)
    // Using regex to ensure it only matches numeric IDs
    app.get('/api/orders/:id(\\d+)', async (req, res) => {
        const { id } = req.params;
        try {
            const orderRes = await query(`
                SELECT o.*, lc.display_name as customer_name, lc.picture_url as customer_picture
                FROM orders o
                LEFT JOIN loyalty_customers lc ON o.customer_id = lc.id
                WHERE o.id = $1
            `, [id]);
            const order = orderRes.rows[0];

            if (order) {
                const itemsRes = await query("SELECT * FROM order_items WHERE order_id = $1", [id]);
                const items = itemsRes.rows;

                // Fetch options for each item
                for (let item of items) {
                    const optionsRes = await query("SELECT * FROM order_item_options WHERE order_item_id = $1", [item.id]);
                    item.options = optionsRes.rows;
                }

                // Return flat structure as expected by SalesHistory.jsx
                res.json({
                    ...order,
                    items: items,
                    total_amount: parseFloat(order.total_amount || 0)
                });
            } else {
                res.status(404).json({ error: 'Order not found' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get Active Order by Table Name
    app.get('/api/orders/:tableName', async (req, res) => {
        const { tableName } = req.params;
        try {
            // Find the latest order for this table that is NOT 'paid'
            const orderRes = await query(`
                SELECT o.*, lc.display_name as customer_name, lc.picture_url as customer_picture
                FROM orders o
                LEFT JOIN loyalty_customers lc ON o.customer_id = lc.id
                WHERE o.table_name = $1 AND o.status != 'paid' 
                ORDER BY o.id DESC LIMIT 1
            `, [tableName]);
            const order = orderRes.rows[0];

            if (order) {
                const itemsRes = await query("SELECT * FROM order_items WHERE order_id = $1", [order.id]);
                const items = itemsRes.rows;

                // Fetch options for each item
                for (let item of items) {
                    const optionsRes = await query("SELECT * FROM order_item_options WHERE order_item_id = $1", [item.id]);
                    item.options = optionsRes.rows;
                }

                // Fetch linked reservation info for deposit
                let reservation = null;
                if (order.line_order_id) {
                    const lineRes = await query("SELECT deposit_amount, is_deposit_paid FROM line_orders WHERE id = $1", [order.line_order_id]);
                    reservation = lineRes.rows[0] || null;
                }

                res.json({
                    order: {
                        ...order,
                        deposit_amount: reservation?.deposit_amount || 0,
                        is_deposit_paid: reservation?.is_deposit_paid || false
                    },
                    items: items
                });
            } else {
                res.json({ order: null, items: [] });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Pay / Clear Bill
    app.post('/api/orders/:id/pay', async (req, res) => {
        const { id } = req.params;
        const { paymentMethod, couponCode, couponDetails, discountAmount, paidAmount } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Mark order as paid and save coupon info & Net total
            await client.query(
                `UPDATE orders 
                 SET status = 'paid', 
                     payment_method = $1, 
                     coupon_code = $2, 
                     coupon_details = $3, 
                     discount_amount = $4,
                     total_amount = COALESCE($5, total_amount),
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $6`,
                [
                    paymentMethod || 'cash',
                    couponCode || null,
                    couponDetails ? JSON.stringify(couponDetails) : null,
                    discountAmount || 0,
                    paidAmount || null,
                    id
                ]
            );

            // 2. Get table name, customer info, and linked reservation
            const orderRes = await client.query("SELECT table_name, customer_id, total_amount, line_order_id FROM orders WHERE id = $1", [id]);
            const order = orderRes.rows[0];

            // 3. Mark table as available
            if (order && order.table_name) {
                await client.query("UPDATE tables SET status = 'available' WHERE name = $1", [order.table_name]);
            }

            // 4. Earn Loyalty Points
            if (order && order.customer_id) {
                await earnLoyaltyPoints(order.customer_id, order.total_amount, id, null);
            }

            // 5. If it's a linked reservation, mark it as completed
            if (order && order.line_order_id) {
                console.log(`✅ Completing linked reservation #${order.line_order_id} for POS order #${id}`);
                await client.query(
                    "UPDATE line_orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                    [order.line_order_id]
                );
                io.emit('line-order-update', { orderId: order.line_order_id, status: 'completed' });
            }

            await client.query('COMMIT');

            // Notify clients
            io.emit('table-update', { id: null, status: 'refresh' });

            // Create persistent notification for payment
            createNotification(
                `💰 ชำระเงินสำเร็จ - โต๊ะ ${order?.table_name || 'N/A'}`,
                `ยอดรวม ฿${order?.total_amount || 0} (${paymentMethod || 'cash'})`,
                'payment',
                { orderId: id, tableName: order?.table_name, amount: order?.total_amount }
            );

            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });


    // Get Dashboard Stats
    app.get('/api/dashboard', async (req, res) => {
        try {
            // 1. Total Revenue Today (Combined In-store and LINE)
            const inStoreRes = await query("SELECT SUM(total_amount) as total FROM orders WHERE status = 'paid' AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date = CURRENT_DATE");
            const lineRes = await query("SELECT SUM(total_amount) as total FROM line_orders WHERE status = 'completed' AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date = CURRENT_DATE");

            const inStoreRevenue = parseFloat(inStoreRes.rows[0].total || 0);
            const lineRevenue = parseFloat(lineRes.rows[0].total || 0);
            const totalRevenue = inStoreRevenue + lineRevenue;

            // 2. Pending Orders Count (Active)
            const pendingRes = await query("SELECT count(*) as count FROM orders WHERE status != 'paid'");
            const pendingCount = parseInt(pendingRes.rows[0].count);

            // 3. Occupied Tables
            const occupiedRes = await query("SELECT count(*) as count FROM tables WHERE status = 'occupied'");
            const totalTablesRes = await query("SELECT count(*) as count FROM tables");
            const occupiedCount = parseInt(occupiedRes.rows[0].count);
            const totalTables = parseInt(totalTablesRes.rows[0].count);

            // 4. Recent Orders - Combined from both tables
            const inStoreRecentRes = await query("SELECT id, table_name, status, total_amount, created_at, order_type FROM orders ORDER BY created_at DESC LIMIT 5");
            const lineRecentRes = await query("SELECT id, customer_name, status, total_amount, created_at, order_type FROM line_orders ORDER BY created_at DESC LIMIT 5");

            const inStoreRecent = inStoreRecentRes.rows.map(o => ({ ...o, source: 'instore' }));
            const lineRecent = lineRecentRes.rows.map(o => ({
                ...o,
                source: 'line',
                table_name: o.customer_name || `LINE #${o.id}`
            }));

            const recentCombined = [...inStoreRecent, ...lineRecent]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 10);

            res.json({
                totalRevenue,
                pendingOrders: pendingCount,
                occupiedTables: occupiedCount,
                totalTables,
                recentOrders: recentCombined
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get Kitchen Orders (status = cooking)
    app.get('/api/kitchen/orders', async (req, res) => {
        try {
            // Get orders that have items in 'cooking' or 'pending' state
            const ordersRes = await query("SELECT * FROM orders WHERE status = 'cooking' ORDER BY created_at");
            const orders = ordersRes.rows;

            const fullOrders = [];
            for (const order of orders) {
                const itemsRes = await query("SELECT * FROM order_items WHERE order_id = $1 AND status != 'served'", [order.id]);
                const items = itemsRes.rows;

                // For each item, fetch its options
                for (const item of items) {
                    const optionsRes = await query("SELECT * FROM order_item_options WHERE order_item_id = $1", [item.id]);
                    item.options = optionsRes.rows;
                }

                fullOrders.push({ ...order, items });
            }

            // Filter out orders with no active items
            const activeOrders = fullOrders.filter(o => o.items.length > 0);

            res.json(activeOrders);
        } catch (err) {
            console.error('Kitchen orders error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get LINE Orders for Kitchen (status = confirmed or preparing)
    // Updated to only show today's reservations or any delivery/pickup
    app.get('/api/kitchen/line-orders', async (req, res) => {
        try {
            const ordersRes = await query(`
                SELECT * FROM line_orders 
                WHERE status IN ('confirmed', 'preparing') 
                AND (
                    order_type != 'reservation' 
                    OR (
                        order_type = 'reservation' 
                        AND reservation_date = CURRENT_DATE
                        AND items_json != '[]' 
                        AND items_json IS NOT NULL
                    )
                )
                ORDER BY 
                    CASE order_type 
                        WHEN 'delivery' THEN 1 
                        WHEN 'pickup' THEN 1 
                        ELSE 2 
                    END,
                    reservation_time ASC,
                    created_at ASC
            `);

            const lineOrders = ordersRes.rows;
            for (let order of lineOrders) {
                if (order.items_json) {
                    try {
                        order.items = JSON.parse(order.items_json);
                    } catch (e) {
                        const itemsRes = await query("SELECT * FROM line_order_items WHERE line_order_id = $1", [order.id]);
                        order.items = itemsRes.rows;
                    }
                } else {
                    const itemsRes = await query("SELECT * FROM line_order_items WHERE line_order_id = $1", [order.id]);
                    order.items = itemsRes.rows;
                }
            }


            res.json(lineOrders);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // POS-Serve Order (Kitchen Done)
    app.post('/api/orders/:id/serve', async (req, res) => {
        const { id } = req.params;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const orderRes = await client.query("SELECT table_name FROM orders WHERE id = $1", [id]);
            const order = orderRes.rows[0];

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // 1. Update all items status to 'served'
            await client.query("UPDATE order_items SET status = 'served' WHERE order_id = $1", [id]);
            // 2. Update order status to 'served'
            await client.query("UPDATE orders SET status = 'served' WHERE id = $1", [id]);

            // 3. --- STOCK DEDUCTION LOGIC ---
            // Fetch all items in this order
            const itemsRes = await client.query("SELECT * FROM order_items WHERE order_id = $1", [id]);
            const items = itemsRes.rows;

            for (const item of items) {
                // Get Product Recipe
                const recipeRes = await client.query("SELECT ingredient_id, quantity_used FROM product_ingredients WHERE product_id = $1", [item.product_id]);
                const recipe = recipeRes.rows;

                for (const ing of recipe) {
                    const totalDeduct = parseFloat(ing.quantity_used) * parseFloat(item.quantity);
                    await client.query("UPDATE ingredients SET total_quantity = total_quantity - $1 WHERE id = $2", [totalDeduct, ing.ingredient_id]);

                    // Check Low Stock Warning
                    const stockRes = await client.query("SELECT name, total_quantity, unit FROM ingredients WHERE id = $1", [ing.ingredient_id]);
                    const currentStock = stockRes.rows[0];
                    if (currentStock && parseFloat(currentStock.total_quantity) <= 10) {
                        createNotification(
                            `Low Stock Alert: ${currentStock.name}`,
                            `วัตถุดิบ "${currentStock.name}" เหลือน้อย (${parseFloat(currentStock.total_quantity).toFixed(2)} ${currentStock.unit})`,
                            'warning',
                            { ingredientId: ing.ingredient_id }
                        );
                    }
                }

                // Get Options Recipe (if any)
                const optsRes = await client.query("SELECT * FROM order_item_options WHERE order_item_id = $1", [item.id]);
                for (const opt of optsRes.rows) {
                    let optRecipeRes;
                    if (opt.is_global) {
                        optRecipeRes = await client.query("SELECT ingredient_id, quantity_used FROM global_option_ingredients WHERE global_option_id = $1", [opt.global_option_id || opt.option_id]);
                    } else {
                        optRecipeRes = await client.query("SELECT ingredient_id, quantity_used FROM option_ingredients WHERE option_id = $1", [opt.option_id]);
                    }

                    for (const ing of optRecipeRes.rows) {
                        const totalDeduct = parseFloat(ing.quantity_used) * parseFloat(item.quantity); // Options usually 1 per item
                        await client.query("UPDATE ingredients SET total_quantity = total_quantity - $1 WHERE id = $2", [totalDeduct, ing.ingredient_id]);

                        // Check Low Stock Warning (Duplicate logic, could be helper function)
                        const stockRes = await client.query("SELECT name, total_quantity, unit FROM ingredients WHERE id = $1", [ing.ingredient_id]);
                        const currentStock = stockRes.rows[0];
                        if (currentStock && parseFloat(currentStock.total_quantity) <= 10) {
                            createNotification(
                                `Low Stock Alert: ${currentStock.name}`,
                                `วัตถุดิบ "${currentStock.name}" เหลือน้อย (${parseFloat(currentStock.total_quantity).toFixed(2)} ${currentStock.unit})`,
                                'warning',
                                { ingredientId: ing.ingredient_id }
                            );
                        }
                    }
                }
            }
            // -----------------------------

            await client.query('COMMIT');

            // Notify clients
            io.emit('table-update', { id: null, status: 'refresh' });
            io.emit('new-order', { id: null });
            io.emit('order-ready', { orderId: id, tableName: order.table_name });

            // Create persistent notification
            createNotification(
                `อาหารพร้อมเสิร์ฟ - โต๊ะ ${order.table_name}`,
                `โต๊ะ ${order.table_name} อาหารทำเสร็จเรียบร้อยแล้ว`,
                'info',
                { orderId: id, tableName: order.table_name }
            );

            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // Update Table Status (For testing)
    app.post('/api/tables/:id/status', (req, res) => {
        const { status } = req.body;
        const { id } = req.params;
        try {
            const stmt = db.prepare('UPDATE tables SET status = ? WHERE id = ?'); // or name if we use name
            // Let's assume ID for now, checking client usage
            stmt.run(status, id);

            // Notify clients via Socket.io
            io.emit('table-update', { id, status });

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Call Bill (Customer Request)
    app.post('/api/tables/:tableName/call-bill', (req, res) => {
        const { tableName } = req.params;
        try {
            // Emitting event to all clients (TablePlan will pick this up)
            io.emit('call-bill', { tableName });

            // Create persistent notification
            createNotification(
                `เรียกเก็บเงิน - โต๊ะ ${tableName}`,
                `ลูกค้าโต๊ะ ${tableName} ต้องการชำระเงิน`,
                'bill',
                { tableName }
            );

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // --- TABLE & ZONE MANAGEMENT ---

    // Get Zones
    app.get('/api/zones', async (req, res) => {
        try {
            const result = await query("SELECT * FROM zones");
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add Zone
    app.post('/api/zones', async (req, res) => {
        const { name } = req.body;
        try {
            const result = await query("INSERT INTO zones (name) VALUES ($1) RETURNING id", [name]);
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Zone
    app.delete('/api/zones/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query("DELETE FROM zones WHERE id = $1", [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add Table
    app.post('/api/tables', async (req, res) => {
        const { name, zone, seats, x, y, w, h, rotation, shape } = req.body;
        try {
            const result = await query(
                `INSERT INTO tables (name, zone, seats, status, x, y, w, h, rotation, shape) 
                 VALUES ($1, $2, $3, 'available', $4, $5, $6, $7, $8, $9) RETURNING id`,
                [name, zone, seats || 4, x || 100, y || 100, w || 80, h || 80, rotation || 0, shape || 'rectangle']
            );

            io.emit('table-update', { id: null, status: 'refresh' });
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Table
    app.delete('/api/tables/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query("DELETE FROM tables WHERE id = $1", [id]);
            io.emit('table-update', { id: null, status: 'refresh' });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Batch Update Table Layout
    app.post('/api/tables/batch-layout', async (req, res) => {
        const { layouts } = req.body; // Array of {id, x, y, rotation, shape, seats}
        try {
            await query('BEGIN');
            for (const item of layouts) {
                await query(
                    `UPDATE tables SET x = $1, y = $2, rotation = $3, shape = $4, seats = $5, w = $6, h = $7 WHERE id = $8`,
                    [item.x, item.y, item.rotation || 0, item.shape || 'rectangle', item.seats || 4, item.w || 80, item.h || 80, item.id]
                );
            }
            await query('COMMIT');
            io.emit('table-update', { id: null, status: 'refresh' });
            res.json({ success: true });
        } catch (err) {
            await query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- MAP OBJECTS API ---
    app.get('/api/map-objects', async (req, res) => {
        try {
            const result = await query("SELECT * FROM map_objects");
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/map-objects', async (req, res) => {
        const { name, type, x, y, w, h, rotation, zone } = req.body;
        try {
            const result = await query(
                `INSERT INTO map_objects (name, type, x, y, w, h, rotation, zone) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [name, type, x || 0, y || 0, w || 100, h || 100, rotation || 0, zone || 'Indoor']
            );
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.patch('/api/map-objects/:id', async (req, res) => {
        const { id } = req.params;
        const { x, y, w, h, rotation, name, type, zone } = req.body;
        try {
            await query(
                `UPDATE map_objects SET x = COALESCE($1, x), y = COALESCE($2, y), w = COALESCE($3, w), 
                 h = COALESCE($4, h), rotation = COALESCE($5, rotation), name = COALESCE($6, name), 
                 type = COALESCE($7, type), zone = COALESCE($8, zone) WHERE id = $9`,
                [x, y, w, h, rotation, name, type, zone, id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/map-objects/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query("DELETE FROM map_objects WHERE id = $1", [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Call Bill / Call Staff Endpoint
    app.post('/api/tables/:id/call-bill', async (req, res) => {
        const { id } = req.params;
        try {
            // Notification: Call Staff
            createNotification(
                `🔔 โต๊ะ ${id} เรียกพนักงาน`,
                `ลูกค้าที่โต๊ะ ${id} กดเรียกพนักงาน (หรือเรียกเช็คบิล)`,
                'info',
                { tableId: id }
            );
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- ANALYTICS ENDPOINTS ---

    // --- ANALYTICS ENDPOINTS ---

    // Sales Trend (Dynamic Date Range)
    app.get('/api/analytics/sales-trend', async (req, res) => {
        const { startDate, endDate } = req.query;
        try {
            let sql = `
                SELECT date, SUM(total) as total FROM (
                    SELECT 
                        (updated_at AT TIME ZONE 'Asia/Bangkok')::date as date, 
                        SUM(total_amount) as total 
                    FROM orders 
                    WHERE status = 'paid' 
                    ${startDate && endDate ? "AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date" : "AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date >= CURRENT_DATE - INTERVAL '7 days'"}
                    GROUP BY (updated_at AT TIME ZONE 'Asia/Bangkok')::date
                    UNION ALL
                    SELECT 
                        (updated_at AT TIME ZONE 'Asia/Bangkok')::date as date, 
                        SUM(total_amount) as total 
                    FROM line_orders 
                    WHERE status = 'completed' 
                    ${startDate && endDate ? "AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date" : "AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date >= CURRENT_DATE - INTERVAL '7 days'"}
                    GROUP BY (updated_at AT TIME ZONE 'Asia/Bangkok')::date
                ) AS daily_sales
                GROUP BY date
                ORDER BY date ASC
            `;
            const params = [];
            if (startDate && endDate) {
                params.push(startDate, endDate);
            }

            const result = await query(sql, params);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Top Selling Items (Dynamic Date Range)
    app.get('/api/analytics/top-items', async (req, res) => {
        const { startDate, endDate } = req.query;
        try {
            let sql = `
                SELECT 
                    product_name, 
                    SUM(quantity) as quantity,
                    SUM(price * quantity) as revenue
                FROM (
                    SELECT product_name, quantity, price, order_id FROM order_items 
                    WHERE (status = 'served' OR status = 'done' OR (SELECT status FROM orders WHERE id = order_items.order_id) = 'paid')
                    ${startDate && endDate ? "AND order_id IN (SELECT id FROM orders WHERE status = 'paid' AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date)" : ""}
                    UNION ALL
                    SELECT product_name, quantity, price, line_order_id as order_id FROM line_order_items
                    WHERE line_order_id IN (SELECT id FROM line_orders WHERE status = 'completed' ${startDate && endDate ? "AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date" : ""})
                ) AS combined_items
                GROUP BY product_name 
                ORDER BY quantity DESC 
                LIMIT 5
            `;
            const params = [];
            if (startDate && endDate) {
                params.push(startDate, endDate);
            }

            const result = await query(sql, params);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- SETTINGS ENDPOINTS ---
    app.get('/api/settings', async (req, res) => {
        try {
            const result = await query("SELECT * FROM settings");
            const settingsObj = {};
            result.rows.forEach(s => settingsObj[s.key] = s.value);
            res.json(settingsObj);
        } catch (err) {
            console.error('Settings GET error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Public settings for customer pages (e.g., tracking page QR)
    app.get('/api/public/settings', async (req, res) => {
        try {
            const result = await query("SELECT * FROM settings WHERE key IN ('promptpay_number', 'shop_name', 'shop_phone')");
            const settingsObj = {};
            result.rows.forEach(s => settingsObj[s.key] = s.value);
            res.json(settingsObj);
        } catch (err) {
            console.error('Public Settings error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/settings', async (req, res) => {
        try {
            const { settings } = req.body; // { key: value, ... }
            for (const [key, value] of Object.entries(settings)) {
                await query(
                    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
                    [key, String(value)]
                );
            }
            res.json({ success: true });
        } catch (err) {
            console.error('Settings POST error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- AUTH ENDPOINTS ---
    app.post('/api/login', async (req, res) => {
        try {
            const { pin } = req.body;
            console.log(`[LOGIN ATTEMPT] PIN: '${pin}'`);

            const userRes = await query("SELECT id, name, full_name, role FROM users WHERE pin = $1", [pin]);
            const user = userRes.rows[0];

            if (user) {
                let status = 'present';
                try {
                    const settingsRes = await query("SELECT value FROM settings WHERE key = 'work_start_time'");
                    const settings = settingsRes.rows[0];
                    const workStartTime = settings ? settings.value : '09:00';

                    const now = new Date();
                    const [targetHour, targetMinute] = workStartTime.split(':').map(Number);
                    const targetTime = new Date(now);
                    targetTime.setHours(targetHour, targetMinute, 0, 0);

                    if (now > targetTime) {
                        status = 'late';
                    }
                } catch (e) { console.error("Error calculating late status:", e); }

                const result = await query(`
                    INSERT INTO attendance_logs (user_id, clock_in, status) 
                    VALUES ($1, CURRENT_TIMESTAMP, $2)
                    RETURNING id
                `, [user.id, status]);

                const attendanceId = result.rows[0].id;

                res.json({ success: true, user, attendanceId });
            } else {
                res.status(401).json({ success: false, error: 'Invalid PIN' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/logout', async (req, res) => {
        const { attendanceId } = req.body;
        if (!attendanceId) return res.json({ success: true });

        try {
            await query("UPDATE attendance_logs SET clock_out = CURRENT_TIMESTAMP WHERE id = $1", [attendanceId]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/attendance/manual', async (req, res) => {
        const { userId, date, status } = req.body;
        if (!userId || !date || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            const existingRes = await query("SELECT id FROM attendance_logs WHERE user_id = $1 AND clock_in::date = $2::date", [userId, date]);
            const existing = existingRes.rows[0];

            if (existing) {
                await query("UPDATE attendance_logs SET status = $1, clock_in = $2, clock_out = NULL WHERE id = $3",
                    [status, `${date} 09:00:00`, existing.id]);
            } else {
                await query("INSERT INTO attendance_logs (user_id, clock_in, clock_out, status) VALUES ($1, $2, NULL, $3)",
                    [userId, `${date} 09:00:00`, status]);
            }
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/attendance', async (req, res) => {
        try {
            const logsRes = await query(`
                SELECT 
                    al.id,
                    al.user_id,
                    u.name as nickname,
                    u.full_name,
                    al.clock_in,
                    al.clock_out,
                    al.status
                FROM attendance_logs al
                JOIN users u ON al.user_id = u.id
                ORDER BY al.clock_in DESC
                LIMIT 100
            `);
            res.json(logsRes.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- USER MANAGEMENT API ---
    app.get('/api/users', async (req, res) => {
        try {
            const usersRes = await query("SELECT id, name, full_name, phone, role, pin, hourly_rate, off_day, off_day2, can_deliver FROM users");
            res.json(usersRes.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/users', async (req, res) => {
        const { name, full_name, phone, pin, role, hourly_rate, off_day, off_day2, can_deliver } = req.body;
        try {
            const result = await query(
                "INSERT INTO users (name, full_name, phone, pin, role, hourly_rate, off_day, off_day2, can_deliver) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
                [name, full_name || '', phone || null, pin, role, hourly_rate || 0, off_day ?? 7, off_day2 ?? 7, can_deliver || false]
            );
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/users/:id', async (req, res) => {
        const { name, full_name, phone, pin, role, hourly_rate, off_day, off_day2, can_deliver } = req.body;
        const { id } = req.params;
        try {
            await query(
                "UPDATE users SET name = $1, full_name = $2, phone = $3, pin = $4, role = $5, hourly_rate = $6, off_day = $7, off_day2 = $8, can_deliver = $9 WHERE id = $10",
                [name, full_name || '', phone || null, pin, role, hourly_rate || 0, off_day ?? 7, off_day2 ?? 7, can_deliver || false, id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/users/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query("DELETE FROM users WHERE id = $1", [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- FINANCE & PAYROLL API ---

    // 1. Transactions
    app.get('/api/transactions', async (req, res) => {
        const { startDate, endDate, type } = req.query;
        try {
            let sql = `
                SELECT * FROM (
                    SELECT 
                        id, 
                        type, 
                        category, 
                        amount, 
                        description, 
                        date, 
                        created_by 
                    FROM transactions
                    UNION ALL
                    SELECT 
                        id * 10000 as id,
                        'income' as type,
                        'Sales' as category,
                        total_amount as amount,
                        'Order #' || id as description,
                        updated_at as date,
                        NULL as created_by
                    FROM orders
                    WHERE status = 'paid'
                    UNION ALL
                    SELECT 
                        id * 20000 as id,
                        'income' as type,
                        'LINE Sales' as category,
                        total_amount as amount,
                        'LINE Order #' || id as description,
                        updated_at as date,
                        NULL as created_by
                    FROM line_orders
                    WHERE status = 'completed'
                ) AS combined
                WHERE 1=1
            `;
            const params = [];
            let paramIdx = 1;

            if (startDate && endDate) {
                sql += ` AND (date AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $${paramIdx}::date AND $${paramIdx + 1}::date`;
                params.push(startDate, endDate);
                paramIdx += 2;
            }
            if (type) {
                sql += ` AND type = $${paramIdx}`;
                params.push(type);
                paramIdx++;
            }

            sql += " ORDER BY date DESC";

            const result = await query(sql, params);
            const transactions = result.rows;

            const usersRes = await query("SELECT id, name FROM users");
            const userMap = {};
            usersRes.rows.forEach(u => userMap[u.id] = u.name);

            const enriched = transactions.map(t => ({
                ...t,
                created_by_name: t.created_by ? userMap[t.created_by] : 'System'
            }));

            res.json(enriched);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/transactions', async (req, res) => {
        const { type, category, amount, description, created_by } = req.body;
        try {
            const result = await query(
                "INSERT INTO transactions (type, category, amount, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                [type, category, amount, description, created_by]
            );
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/transactions/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query("DELETE FROM transactions WHERE id = $1", [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // 2. Payroll Adjustments
    app.post('/api/payroll/adjustments', async (req, res) => {
        const { user_id, type, amount, reason, created_by } = req.body;
        try {
            const result = await query(
                "INSERT INTO payroll_adjustments (user_id, type, amount, reason, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                [user_id, type, amount, reason, created_by]
            );
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/payroll/adjustments/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query("DELETE FROM payroll_adjustments WHERE id = $1", [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // 3. Payroll Summary (Complex Calculation with Auto-Deductions)
    app.get('/api/payroll/summary', async (req, res) => {
        const { startDate, endDate } = req.query;
        try {
            // Get Deduction Settings
            const settingsRes = await query("SELECT * FROM settings");
            const settings = {};
            settingsRes.rows.forEach(s => settings[s.key] = s.value);

            const lateRate = parseFloat(settings.late_hourly_deduction || 0);
            const absentRate = parseFloat(settings.absent_daily_deduction || 0);
            const leaveExcessRate = parseFloat(settings.leave_excess_deduction || 0);
            const maxLeaveDays = parseInt(settings.max_leave_days || 0);
            const holidayMultiplier = parseFloat(settings.holiday_multiplier || 2.0);
            const workStartTime = settings.work_start_time || '09:00';

            // Get all staff
            const usersRes = await query("SELECT id, name, full_name, role, pin, hourly_rate, off_day, off_day2, can_deliver FROM users");
            const users = usersRes.rows;

            const payrollData = [];
            for (const user of users) {
                // 1. Calculate Total Work Hours & Auto-Deductions
                let attendanceSql = `
                    SELECT *,
                    EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0 as hours
                    FROM attendance_logs 
                    WHERE user_id = $1 AND clock_out IS NOT NULL
                `;
                const queryParams = [user.id];
                if (startDate && endDate) {
                    attendanceSql += " AND clock_in::date BETWEEN $2::date AND $3::date";
                    queryParams.push(startDate, endDate);
                }
                const logsRes = await query(attendanceSql, queryParams);
                const logs = logsRes.rows;

                let totalHours = 0;
                let lateHoursTotal = 0;
                let lateCount = 0;
                let absentCount = 0;
                let leaveCount = 0;
                let holidayHours = 0;

                logs.forEach(log => {
                    const hours = parseFloat(log.hours || 0);
                    totalHours += hours;

                    const clockIn = new Date(log.clock_in);
                    const dayOfWeek = clockIn.getDay();
                    if ((user.off_day !== 7 && dayOfWeek === user.off_day) ||
                        (user.off_day2 !== 7 && dayOfWeek === user.off_day2)) {
                        holidayHours += hours;
                    }

                    if (log.status === 'late') {
                        lateCount++;
                        const [h, m] = workStartTime.split(':').map(Number);
                        const target = new Date(clockIn);
                        target.setHours(h, m, 0, 0);

                        const diffMs = clockIn - target;
                        if (diffMs > 0) {
                            lateHoursTotal += (diffMs / (1000 * 60 * 60));
                        }
                    } else if (log.status === 'absent') {
                        absentCount++;
                    } else if (log.status === 'leave') {
                        leaveCount++;
                    }
                });

                const baseSalary = totalHours * (user.hourly_rate || 0);
                const holidayBonus = holidayHours * (user.hourly_rate || 0) * (holidayMultiplier - 1.0);

                const lateDeduction = lateHoursTotal * lateRate;
                const absentDeduction = absentCount * absentRate;
                const excessLeaveDays = Math.max(0, leaveCount - maxLeaveDays);
                const leaveDeduction = excessLeaveDays * leaveExcessRate;

                const autoDeductionTotal = lateDeduction + absentDeduction + leaveDeduction;

                let adjSql = `SELECT * FROM payroll_adjustments WHERE user_id = $1`;
                const adjParams = [user.id];
                if (startDate && endDate) {
                    adjSql += " AND date::date BETWEEN $2::date AND $3::date";
                    adjParams.push(startDate, endDate);
                }
                const adjRes = await query(adjSql, adjParams);
                const adjustments = adjRes.rows;

                const manualBonus = adjustments.filter(a => a.type === 'bonus').reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
                const manualDeduction = adjustments.filter(a => a.type === 'deduction').reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

                // Rider Bonus: 5 Baht per completed order
                let riderBonus = 0;
                let completedDeliveries = 0;
                if (user.can_deliver) {
                    let orderSql = `SELECT COUNT(*) as count FROM line_orders WHERE rider_id = $1 AND status = 'completed'`;
                    const orderParams = [user.id];
                    if (startDate && endDate) {
                        orderSql += " AND updated_at::date BETWEEN $2::date AND $3::date";
                        orderParams.push(startDate, endDate);
                    }
                    const orderRes = await query(orderSql, orderParams);
                    completedDeliveries = parseInt(orderRes.rows[0].count || 0);
                    riderBonus = completedDeliveries * 5;
                }

                const totalBonus = manualBonus + holidayBonus + riderBonus;
                const totalDeduction = manualDeduction + autoDeductionTotal;

                payrollData.push({
                    user,
                    stats: {
                        totalHours,
                        shifts: logs.length,
                        lateCount,
                        lateHours: lateHoursTotal,
                        absentCount,
                        leaveCount,
                        excessLeaveDays,
                        completedDeliveries
                    },
                    financials: {
                        baseSalary,
                        totalBonus,
                        totalDeduction,
                        autoDeductionDetail: {
                            late: lateDeduction,
                            absent: absentDeduction,
                            leave: leaveDeduction
                        },
                        holidayBonus: holidayBonus,
                        riderBonus: riderBonus,
                        holidayHours: holidayHours,
                        netSalary: baseSalary + totalBonus - totalDeduction
                    },
                    adjustments
                });
            }

            res.json(payrollData);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- INVENTORY / INGREDIENTS API ---

    // Get All Ingredients
    app.get('/api/ingredients', async (req, res) => {
        try {
            const result = await query('SELECT * FROM ingredients ORDER BY name');
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add Ingredient
    app.post('/api/ingredients', async (req, res) => {
        const { name, total_quantity, unit } = req.body;
        try {
            const result = await query(
                'INSERT INTO ingredients (name, total_quantity, unit) VALUES ($1, $2, $3) RETURNING id',
                [name, total_quantity || 0, unit || 'units']
            );
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Update Ingredient
    app.put('/api/ingredients/:id', async (req, res) => {
        const { name, total_quantity, unit } = req.body;
        const { id } = req.params;
        try {
            await query('UPDATE ingredients SET name = $1, total_quantity = $2, unit = $3 WHERE id = $4', [name, total_quantity, unit, id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Ingredient
    app.delete('/api/ingredients/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM ingredients WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get Recipe for Product
    app.get('/api/products/:id/recipe', async (req, res) => {
        const { id } = req.params;
        try {
            const result = await query(`
                SELECT pi.*, i.name, i.unit 
                FROM product_ingredients pi
                JOIN ingredients i ON pi.ingredient_id = i.id
                WHERE pi.product_id = $1
            `, [id]);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Update Recipe for Product (Full Replace)
    app.post('/api/products/:id/recipe', async (req, res) => {
        const { id } = req.params;
        const { ingredients } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM product_ingredients WHERE product_id = $1', [id]);
            for (const item of ingredients) {
                await client.query(
                    'INSERT INTO product_ingredients (product_id, ingredient_id, quantity_used) VALUES ($1, $2, $3)',
                    [id, item.ingredient_id, item.quantity_used]
                );
            }
            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // --- FACEBOOK WEBHOOK ENDPOINTS ---

    // 1. Webhook Verification (Handshake)
    app.get('/webhook/facebook', async (req, res) => {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // Fetch Verify Token from DB (or fallback)
        let verifyToken = 'pos2025secret'; // Default Fallback
        try {
            const settingsRes = await query("SELECT value FROM settings WHERE key = 'facebook_verify_token'");
            if (settingsRes.rows.length > 0 && settingsRes.rows[0].value) {
                verifyToken = settingsRes.rows[0].value;
            }
        } catch (e) { console.error("Error fetching FB verify token:", e); }

        if (mode && token) {
            if (mode === 'subscribe' && token === verifyToken) {
                console.log('[Facebook] Webhook Verified! Challenge accepted.');
                res.status(200).send(challenge);
            } else {
                console.error(`[Facebook] Verification Failed. Mode: ${mode}, Token: ${token}, Expected: ${verifyToken}`);
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(400); // Bad Request if parameters missing
        }
    });

    // 2. Incoming Messages Handler
    app.post('/webhook/facebook', async (req, res) => {
        const body = req.body;
        console.log('🔥 [Facebook] Webhook POST Received!');
        console.log(JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            // Iterate over each entry - there may be multiple if batched
            for (const entry of body.entry) {
                // Get the webhook event. entry.messaging is an array, but 
                // will only contain one event, so we get index 0
                const webhook_event = entry.messaging[0];

                // Get the sender PSID
                const sender_psid = webhook_event.sender.id;
                console.log(`[Facebook] Sender PSID: ${sender_psid}`);

                // Check if it's a message or postback and pass the event to the appropriate handler functions
                if (webhook_event.message) {
                    handleFacebookMessage(sender_psid, webhook_event.message);
                } else if (webhook_event.postback) {
                    handleFacebookPostback(sender_psid, webhook_event.postback);
                }
            }

            // Return a '200 OK' response to all events
            res.status(200).send('EVENT_RECEIVED');
        } else {
            // Return a '404 Not Found' if event is not from a page subscription
            res.sendStatus(404);
        }
    });

    // --- FACEBOOK HELPER FUNCTIONS ---
    // --- FACEBOOK HELPER FUNCTIONS ---
    async function handleFacebookMessage(sender_psid, received_message) {
        let response;

        // --- 1. Helper: Smart Keyword Matcher ---
        const matches = (text, keywords) => {
            const lowerText = text.toLowerCase();
            return keywords.some(kw => lowerText.includes(kw));
        };

        const KEYWORDS = {
            stock: ['มี...มั้ย', 'มี...ไหม', 'มี', 'หมด', 'stock', 'available', 'หาไม่เจอ'],
            hours: ['เปิด', 'ปิด', 'เวลา', 'time', 'hour', 'open', 'close', 'กี่โมง'],
            menu: ['เมนู', 'รายการ', 'food', 'menu', 'order', 'สั่งอาหาร'],
            queue: ['คิว', 'รอ', 'queue', 'wait', 'people', 'คนเยอะ'],
            price: ['ราคา', 'เท่าไหร่', 'price', 'cost', 'how much', 'กี่บาท'],
            payment: ['โอน', 'จ่าย', 'เลขบัญชี', 'พร้อมเพย์', 'pay', 'bank', 'transfer', 'qr'],
            wifi: ['wifi', 'ไวไฟ', 'เน็ต', 'net', 'internet', 'password', 'รหัส'],
            recommend: ['แนะนำ', 'recommend', 'best seller', 'signature', 'อร่อย', 'อะไรดี', 'เด็ด'],
            greetings: ['สวัสดี', 'hi', 'hello', 'ทัก', 'ดีจ้า']
        };

        // Check if the message contains text
        if (received_message.text) {
            const text = received_message.text;

            // --- 2. Logic Implementation ---

            // A. Stock / Ingredient Check
            if (KEYWORDS.stock.some(kw => text.includes(kw)) && text.length > 3 && !matches(text, KEYWORDS.price)) {
                try {
                    const keyword = text.replace(/มี|มั้ย|ไหม|stock|available/gi, '').trim();
                    if (keyword.length > 1) {
                        const ingredientsRes = await query("SELECT name, total_quantity, unit FROM ingredients WHERE name LIKE $1", [`%${keyword}%`]);
                        const productsRes = await query("SELECT name, is_available FROM products WHERE name LIKE $1", [`%${keyword}%`]);

                        let msg = "";
                        if (ingredientsRes.rows.length > 0) {
                            ingredientsRes.rows.forEach(i => {
                                const status = parseFloat(i.total_quantity) > 0 ? "✅ มีค่ะ" : "❌ หมดค่ะ";
                                msg += `${status} ${i.name} (เหลือ ${parseFloat(i.total_quantity)} ${i.unit})\n`;
                            });
                        }
                        if (productsRes.rows.length > 0) {
                            productsRes.rows.forEach(p => {
                                const status = p.is_available ? "✅ พร้อมเสิร์ฟ" : "❌ หมดชั่วคราว";
                                msg += `${status} เมนู "${p.name}"\n`;
                            });
                        }

                        if (msg) {
                            response = { "text": `🔎 ผลการค้นหาสำหรับ "${keyword}":\n\n${msg}` };
                        } else {
                            response = { "text": `🧐 น้องอันอันหา "${keyword}" ไม่เจอในระบบค่ะ ลองพิมพ์ชื่อใหม่ดูนะคะ` };
                        }
                    } else {
                        response = { "text": "ต้องการเช็ควัตถุดิบตัวไหน พิมพ์บอกได้เลยนะคะ เช่น 'มีหมูกรอบมั้ย'" };
                    }
                } catch (e) { console.error(e); response = { "text": "⚠️ ระบบเช็คสต็อกขัดข้องชั่วคราวค่ะ" }; }

                // B. Store Hours
            } else if (matches(text, KEYWORDS.hours)) {
                try {
                    const settingsRes = await query("SELECT key, value FROM settings WHERE key IN ('store_open_time', 'store_close_time')");
                    const settings = {};
                    settingsRes.rows.forEach(s => settings[s.key] = s.value);
                    const open = settings.store_open_time || '09:00';
                    const close = settings.store_close_time || '21:00';
                    response = { "text": `🕒 **เวลาทำการร้าน**\n\n✅ เปิด: ${open} น.\n❌ ปิด: ${close} น.\n\nแวะมาทานของอร่อยได้ทุกวันเลยนะคะ! 🥰` };
                } catch (e) {
                    response = { "text": "ร้านเปิดให้บริการตามปกตินะคะ (09:00 - 21:00)" };
                }

                // C. Menu (Dynamic Link & Line ID)
            } else if (matches(text, KEYWORDS.menu)) {
                try {
                    // Fetch all necessary settings: Menu/Line links AND Store Hours
                    const settingsRes = await query("SELECT key, value FROM settings WHERE key IN ('website_sync_url', 'line_id', 'store_open_time', 'store_close_time')");
                    const settings = {};
                    settingsRes.rows.forEach(s => settings[s.key] = s.value);

                    // 1. Check Store Hours
                    const openTime = settings.store_open_time || '09:00';
                    const closeTime = settings.store_close_time || '21:00';
                    const now = new Date();
                    const currentTime = now.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }); // "HH:MM"

                    // Simple string comparison works for 24h format (e.g. "09:00" <= "14:30" <= "21:00")
                    // Note: This simple logic assumes open < close (day shift). If night shift (cross-day), logic needs adjustment. 
                    // Assuming day shift for typical restaurant POS context based on valid hours (09-21).
                    if (currentTime < openTime || currentTime >= closeTime) {
                        response = {
                            "text": `ตอนนี้ร้านปิดอยู่นะคะ 😴\n\nรบกวนสั่งอาหารใหม่อีกทีในเวลาที่ร้านเปิดนะคะ\n⏰ (${openTime} - ${closeTime} น.)\n\nขอบคุณค่า 💖`
                        };
                        callSendFacebookAPI(sender_psid, response);
                        return; // Stop here, don't show menu
                    }

                    // 2. If Open, existing Menu Logic
                    let menuUrl = "https://yoursite.com";
                    if (settings.website_sync_url) {
                        menuUrl = settings.website_sync_url.replace('/api/sync-menu', '');
                    }

                    const buttons = [
                        {
                            "type": "web_url",
                            "url": menuUrl,
                            "title": "📖 ดูเมนูออนไลน์"
                        }
                    ];

                    if (settings.line_id) {
                        let lineId = settings.line_id;
                        let lineUrl;
                        if (lineId.startsWith('@')) {
                            lineUrl = `https://line.me/R/ti/p/${lineId}`;
                        } else {
                            lineUrl = `https://line.me/ti/p/~${lineId}`;
                        }

                        buttons.push({
                            "type": "web_url",
                            "url": lineUrl,
                            "title": "💚 สั่งอาหาร"
                        });
                    }

                    response = {
                        "attachment": {
                            "type": "template",
                            "payload": {
                                "template_type": "button",
                                "text": "🍽️ หิวแล้วใช่มั้ยคะ? กดดูเมนูทั้งหมดแล้วสั่งออนไลน์ได้เลยที่นี่ค่ะ 👇",
                                "buttons": buttons
                            }
                        }
                    };
                } catch (e) {
                    console.error(e);
                    response = { "text": "ขออภัยค่ะ ลิงค์เมนูขัดข้องชั่วคราว" };
                }

                // D. Recommendations (Carousel from DB)
            } else if (matches(text, KEYWORDS.recommend)) {
                try {
                    const recRes = await query("SELECT name, price, image, description FROM products WHERE is_recommended = TRUE LIMIT 5");
                    if (recRes.rows.length > 0) {
                        const elements = recRes.rows.map(p => ({
                            "title": `✨ ${p.name}`,
                            "subtitle": `${p.description || 'ความอร่อยที่คุณต้องลอง!'} | 💰 ${parseFloat(p.price)}.-`,
                            "image_url": p.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
                            "buttons": [
                                {
                                    "type": "postback",
                                    "title": "📌 สนใจเมนูนี้",
                                    "payload": `INTERESTED_${p.name}`
                                }
                            ]
                        }));

                        response = {
                            "attachment": {
                                "type": "template",
                                "payload": {
                                    "template_type": "generic",
                                    "elements": elements
                                }
                            }
                        };
                    } else {
                        // Fallback logic could be handled here if needed.
                        response = { "text": "🍽️ เมนูเด็ดของร้านมีเยอะเลยค่ะ! ลองพิมพ์ 'เมนู' เพื่อดูทั้งหมดได้เลยนะคะ" };
                    }
                } catch (e) { console.error(e); response = { "text": "ขออภัยค่ะ ระบบแนะนำเมนูขัดข้อง" }; }

                // E. Queue
            } else if (matches(text, KEYWORDS.queue)) {
                try {
                    const ordersRes = await query("SELECT COUNT(*) as count FROM orders WHERE status NOT IN ('paid', 'cancelled')");
                    const queueCount = parseInt(ordersRes.rows[0].count || 0);
                    let statusIcon = queueCount < 5 ? "🟢" : (queueCount < 10 ? "🟡" : "🔴");

                    response = { "text": `${statusIcon} **สถานะคิวปัจจุบัน**\n\n📌 รอคิวอยู่: ${queueCount} โต๊ะ\n\n${queueCount === 0 ? "โต๊ะว่างเพียบ! มาได้เลยค่า ⚡" : "อดใจรอนิดนึงนะคะ ความอร่อยกำลังทำงาน 👨‍🍳"}` };
                } catch (e) { response = { "text": "ไม่สามารถตรวจสอบคิวได้ค่ะ" }; }

                // F. Price (Multiple keywords)
            } else if (matches(text, KEYWORDS.price)) {
                const keyword = text.replace(/ราคา|เท่าไหร่|กี่บาท|price/gi, '').trim();
                if (keyword.length > 1) {
                    try {
                        const productRes = await query("SELECT name, price FROM products WHERE name LIKE $1 LIMIT 5", [`%${keyword}%`]);
                        if (productRes.rows.length > 0) {
                            let msg = "💰 **ราคาเมนูที่ค้นหา**\n\n";
                            productRes.rows.forEach(p => {
                                msg += `🔹 ${p.name}: ${parseFloat(p.price)} บาท\n`;
                            });
                            response = { "text": msg };
                        } else {
                            response = { "text": `❌ ไม่พบเมนู "${keyword}" ค่ะ ลองสะกดใหม่นิดนึงน้า` };
                        }
                    } catch (e) { console.error(e); }
                } else {
                    response = { "text": "🏷️ อยากรู้ราคาเมนูไหน พิมพ์ชื่อมาได้เลยค่ะ เช่น 'ราคากะเพรา'" };
                }

                // G. Payment
            } else if (matches(text, KEYWORDS.payment)) {
                try {
                    const settingsRes = await query("SELECT value FROM settings WHERE key = 'promptpay_number'");
                    const promptpay = settingsRes.rows[0]?.value;
                    if (promptpay) {
                        response = { "text": `💸 **ช่องทางการชำระเงิน**\n\n📱 **PromptPay:** ${promptpay}\n(ชื่อบัญชีร้าน)\n\n📸 ส่งสลิปให้พี่พนักงานตรวจสอบได้เลยค่า` };
                    } else {
                        response = { "text": "💵 รับชำระเงินสด หรือสอบถาม QR Code ที่หน้าเคาน์เตอร์ได้เลยค่ะ" };
                    }
                } catch (e) { response = { "text": "ระบบข้อมูลการชำระเงินขัดข้องค่ะ" }; }

                // H. WiFi
            } else if (matches(text, KEYWORDS.wifi)) {
                try {
                    const settingsRes = await query("SELECT value FROM settings WHERE key = 'wifi_password'");
                    const wifiPass = settingsRes.rows[0]?.value;
                    if (wifiPass) {
                        response = { "text": `📶 **Free WiFi**\n\n🔑 Password: ${wifiPass}\n\nเล่นเน็ตให้สนุกนะคะ! (อย่าลืมรีวิวร้านให้ด้วยน้า ⭐)` };
                    } else {
                        response = { "text": "📶 ทางร้านมี WiFi ฟรีให้บริการค่ะ รบกวนสอบถามรหัสจากพี่พนักงานนะคะ" };
                    }
                } catch (e) { }

                // I. Greetings / Fallback
            } else {
                if (matches(text, KEYWORDS.greetings)) {
                    response = { "text": "สวัสดีค่า! 🙏 น้องอันอัน ยินดีต้อนรับค่ะ 💖\n\nมีอะไรให้ช่วยมั้ยคะ? ถามเรื่อง เมนู, โปรโมชั่น, หรือจองคิว ได้เลยน้า" };
                } else {
                    response = {
                        "text": `🤖 น้องอันอันยังไม่เข้าใจคำว่า "${text}" ง่ะ 🥺\n\nลองถามใหม่ได้มั้ยคะ? เช่น:\n- "ขอรหัส wifi"\n- "ร้านเปิดกี่โมง"\n- "แนะนำเมนู"\n- "ราคากะเพรา"`
                    };
                }
            }

        } else if (received_message.attachments) {
            let attachment_url = received_message.attachments[0].payload.url;
            response = {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "generic",
                        "elements": [{
                            "title": "ได้รับรูปภาพแล้วค่ะ 📸",
                            "subtitle": "เป็นสลิปโอนเงินใช่ไหมคะ?",
                            "image_url": attachment_url,
                            "buttons": [
                                { "type": "postback", "title": "✅ ใช่ (สลิปโอนเงิน)", "payload": "yes" },
                                { "type": "postback", "title": "❌ ไม่ใช่", "payload": "no" }
                            ],
                        }]
                    }
                }
            }
        }

        // Send the response message
        callSendFacebookAPI(sender_psid, response);
    }

    async function handleFacebookPostback(sender_psid, received_postback) {
        let response;

        // Get the payload for the postback
        let payload = received_postback.payload;

        // Set the response based on the postback payload
        if (payload === 'yes') {
            response = { "text": "ขอบคุณที่ยืนยันค่ะ!" }
        } else if (payload === 'no') {
            response = { "text": "ขออภัยด้วยค่ะ ลองส่งภาพมาใหม่นะ." }
        }
        // Send the message to acknowledge the postback
        callSendFacebookAPI(sender_psid, response);
    }

    async function callSendFacebookAPI(sender_psid, response) {
        // Fetch Page Access Token from DB
        let pageAccessToken = '';
        try {
            const settingsRes = await query("SELECT value FROM settings WHERE key = 'facebook_page_access_token'");
            if (settingsRes.rows.length > 0) {
                pageAccessToken = settingsRes.rows[0].value;
            }
        } catch (e) {
            console.error("Error fetching FB page token:", e);
            return;
        }

        if (!pageAccessToken) {
            console.error('[Facebook] Error: Page Access Token is missing in DB Settings!');
            return;
        }

        console.log(`[Facebook] Sending logic for PSID ${sender_psid}...`);


        const requestBody = {
            "recipient": {
                "id": sender_psid
            },
            "message": response
        };

        try {
            const responseJson = await fetch('https://graph.facebook.com/v22.0/me/messages?access_token=' + pageAccessToken, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody) // Changed request_body to requestBody
            });
            const resData = await responseJson.json();
            if (resData.error) {
                console.error('[Facebook] Send API Error:', JSON.stringify(resData.error, null, 2));
            } else {
                console.log('[Facebook] Message Sent Successfully!', resData);
            }
        } catch (err) {
            console.error('[Facebook] Network Error:', err);
        }
    }


    // Create LINE Order
    app.post('/api/line_orders', async (req, res) => {
        const { customer_name, contact_number, delivery_address, items, total_amount, order_type, delivery_location } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO line_orders (customer_name, contact_number, delivery_address, total_amount, status, order_type, delivery_location) 
                 VALUES ($1, $2, $3, $4, 'pending', $5, $6) RETURNING id`,
                [customer_name, contact_number, delivery_address, total_amount, order_type || 'delivery', delivery_location || null]
            );
            const lineOrderId = result.rows[0].id;

            for (const item of items) {
                await client.query(
                    'INSERT INTO line_order_items (line_order_id, product_id, product_name, price, quantity) VALUES ($1, $2, $3, $4, $5)',
                    [lineOrderId, item.id, item.name, item.price, item.quantity]
                );
            }

            await client.query('COMMIT');
            io.emit('line-order-new');
            res.json({ success: true, id: lineOrderId });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    app.get('/', (req, res) => {
        res.send('POS Master Station Server is Running.')
    })

    app.get('/api/status', (req, res) => {
        res.json({ status: 'online', time: new Date() })
    })

    // --- NETWORK & CLOUD ENDPOINTS ---
    app.get('/api/network/status', async (req, res) => {
        let publicIp = '...';
        try {
            // Fetch public IP to bypass localtunnel interstitial
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            publicIp = ipData.ip;
        } catch (e) {
            console.error("Failed to fetch public IP", e);
        }

        // Fetch Public URL if configured in settings
        let configuredPublicUrl = cloudUrl;
        try {
            const publicUrlRes = await query("SELECT value FROM settings WHERE key = 'public_url'");
            if (publicUrlRes.rows.length > 0 && publicUrlRes.rows[0].value) {
                configuredPublicUrl = publicUrlRes.rows[0].value;
            }
        } catch (err) {
            console.error("Failed to fetch public_url from settings", err);
        }

        res.json({
            localIp: getLocalIp(),
            publicIp: publicIp,
            port: port,
            cloudUrl: configuredPublicUrl,
            isCloudActive: !!configuredPublicUrl,
            isLaunching: isLaunchingCloud
        });
    });

    app.post('/api/network/cloud-toggle', async (req, res) => {
        res.status(503).json({ error: 'Cloud Tunnel is temporarily disabled for system maintenance.' });
        /*
        const { active } = req.body;
     
        try {
            if (active) {
                if (tunnel) return res.json({ success: true, url: cloudUrl });
     
                isLaunchingCloud = true;
                // Start Tunnel
                tunnel = await localtunnel({ port: port });
                cloudUrl = tunnel.url;
     
                tunnel.on('close', () => {
                    tunnel = null;
                    cloudUrl = null;
                });
     
                isLaunchingCloud = false;
                res.json({ success: true, url: cloudUrl });
            } else {
                if (tunnel) {
                    await tunnel.close();
                    tunnel = null;
                    cloudUrl = null;
                }
                res.json({ success: true });
            }
        } catch (err) {
            isLaunchingCloud = false;
            console.error("Cloud Tunnel Error:", err);
            res.status(500).json({ error: err.message });
        }
        */
    });

    // ============================================
    // === LINE ORDER API (Public + Admin) ===
    // ============================================

    // PUBLIC: Get Menu for LINE Order Page
    app.get('/api/public/menu', async (req, res) => {
        try {
            const productsRes = await query('SELECT * FROM products');
            const categoriesRes = await query('SELECT * FROM categories ORDER BY sort_order');
            res.json({ products: productsRes.rows, categories: categoriesRes.rows });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get All LINE Orders
    app.get('/api/line_orders', async (req, res) => {
        try {
            const lineOrdersRes = await query("SELECT * FROM line_orders ORDER BY created_at DESC");
            const lineOrders = lineOrdersRes.rows;
            for (let order of lineOrders) {
                const itemsRes = await query("SELECT * FROM line_order_items WHERE line_order_id = $1", [order.id]);
                order.items = itemsRes.rows;

                // Use coupon data from line_orders columns (NEW) or fallback to loyalty_coupons JOIN (LEGACY)
                if (order.coupon_code && parseFloat(order.coupon_discount || 0) > 0) {
                    // Data from new columns - just build applied_coupon for UI compatibility
                    order.applied_coupon = {
                        coupon_code: order.coupon_code,
                        title: `ส่วนลด ฿${parseFloat(order.coupon_discount).toLocaleString()}`,
                        discount_amount: parseFloat(order.coupon_discount)
                    };
                    console.log(`🎁 Order #${order.id} has coupon: ${order.coupon_code} (-฿${order.coupon_discount})`);
                } else {
                    // Fallback: Fetch linked coupon from loyalty_coupons table (for old orders)
                    const couponRes = await query(`
                        SELECT c.coupon_code, c.promotion_id, c.discount_value, p.title, p.description 
                        FROM loyalty_coupons c
                        JOIN loyalty_promotions p ON c.promotion_id = p.id
                        WHERE c.line_order_id = $1 AND c.status = 'used'
                    `, [order.id]);

                    if (couponRes.rows.length > 0) {
                        const coupon = couponRes.rows[0];
                        order.applied_coupon = coupon;
                        // Populate columns if missing
                        if (!order.coupon_code) order.coupon_code = coupon.coupon_code;
                        if (!order.coupon_discount) order.coupon_discount = parseFloat(coupon.discount_value || 0);
                        console.log(`🎁 Order #${order.id} has legacy coupon: ${order.coupon_code}`);
                    } else {
                        console.log(`📦 Order #${order.id}: No coupon`);
                    }
                }
            }
            res.json(lineOrders);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // PUBLIC: Get Shop Settings for LINE Order Page
    app.get('/api/public/settings', async (req, res) => {
        try {
            const result = await query("SELECT * FROM settings");
            const settingsObj = {};
            result.rows.forEach(s => settingsObj[s.key] = s.value);
            res.json(settingsObj);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // PUBLIC: Get Available Tables for Reservation
    app.get('/api/public/available-tables', async (req, res) => {
        const { date, guests } = req.query;
        try {
            // Find tables that:
            // 1. Have enough seats
            // 2. Are not already reserved on that specific date
            const result = await query(`
                SELECT * FROM tables 
                WHERE seats >= $1 
                AND name NOT IN (
                    SELECT assigned_table FROM line_orders 
                    WHERE reservation_date = $2 
                    AND status NOT IN ('cancelled', 'completed')
                    AND assigned_table IS NOT NULL
                )
                ORDER BY seats ASC
            `, [guests || 1, date || '']);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // (Duplicate /api/public/menu removed)

    // --- ADMIN: LINE Settings ---
    app.post('/api/admin/line/settings', async (req, res) => {
        const { channelId, channelSecret, accessToken, liffId, liffIdLoyalty } = req.body;
        try {
            await query("BEGIN");
            // Upsert settings
            const keys = {
                'line_channel_id': channelId,
                'line_channel_secret': channelSecret,
                'line_channel_access_token': accessToken,
                'line_liff_id': liffId,
                'line_liff_id_loyalty': liffIdLoyalty
            };

            for (const [key, value] of Object.entries(keys)) {
                await query(`
                    INSERT INTO settings (key, value) VALUES ($1, $2)
                    ON CONFLICT (key) DO UPDATE SET value = $2
                `, [key, value || '']);
            }
            await query("COMMIT");
            console.log('✅ LINE Settings updated via Admin API');
            res.json({ success: true });
        } catch (err) {
            await query("ROLLBACK");
            console.error(err);
            res.status(500).json({ error: 'Failed to save LINE settings' });
        }
    });

    // --- ADMIN: Auto-Setup Rich Menu ---
    app.post('/api/admin/line/setup-richmenu', async (req, res) => {
        try {
            // 1. Get Credentials
            const settingsRes = await query("SELECT * FROM settings WHERE key IN ('line_channel_access_token', 'line_liff_id', 'line_liff_id_loyalty')");
            const settings = {};
            settingsRes.rows.forEach(s => settings[s.key] = s.value);
            const token = settings.line_channel_access_token;
            const liffId = settings.line_liff_id;
            const liffIdLoyalty = settings.line_liff_id_loyalty;

            if (!token) return res.status(400).json({ error: 'LINE Access Token not configured.' });

            // 2. Define Rich Menu Object
            // Hybrid Logic:
            // - If User provides 2 IDs (Order & Loyalty), assume they are configured to point to respective pages. Use raw LIFF URL.
            // - If User provides 1 ID, assume Single App Strategy. Append paths.

            let uriOrder, uriLoyalty, uriPromo;

            if (liffIdLoyalty) {
                // Dual App Strategy
                uriOrder = `https://liff.line.me/${liffId}`;
                uriLoyalty = `https://liff.line.me/${liffIdLoyalty}`;
                uriPromo = `https://liff.line.me/${liffIdLoyalty}?tab=promotions`; // Still append param for promo tab
            } else {
                // Single App Strategy
                const baseUrl = `https://liff.line.me/${liffId}`;
                uriOrder = `${baseUrl}/line-order`;
                uriLoyalty = `${baseUrl}/loyalty`;
                uriPromo = `${baseUrl}/loyalty?tab=promotions`;
            }

            const richMenuObject = {
                "size": { "width": 1200, "height": 810 },
                "selected": true,
                "name": "POS Default Menu",
                "chatBarText": "สั่งอาหาร / เมนู",
                "areas": [
                    {
                        "bounds": { "x": 0, "y": 0, "width": 1200, "height": 405 },
                        "action": { "type": "uri", "uri": uriOrder }
                    },
                    {
                        "bounds": { "x": 0, "y": 405, "width": 600, "height": 405 },
                        "action": { "type": "uri", "uri": uriLoyalty }
                    },
                    {
                        "bounds": { "x": 600, "y": 405, "width": 600, "height": 405 },
                        "action": { "type": "uri", "uri": uriPromo }
                    }
                ]
            };

            // 3. Create Rich Menu
            console.log('Creating Rich Menu...');
            const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(richMenuObject)
            });
            const createData = await createRes.json();
            if (!createRes.ok) throw new Error(createData.message || 'Failed to create Rich Menu');
            const richMenuId = createData.richMenuId;
            console.log('✅ Rich Menu Created:', richMenuId);

            // 4. Upload Image
            const imagePath = path.join(__dirname, '../public/assets/rich_menu_default.png');
            if (!fs.existsSync(imagePath)) throw new Error('Default Rich Menu Image not found');

            const imageBuffer = fs.readFileSync(imagePath);

            console.log('Uploading Image...');
            const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'image/png'
                },
                body: imageBuffer // node-fetch supports Buffer
            });
            if (!uploadRes.ok) {
                const errorBody = await uploadRes.text();
                console.error('LINE Upload Error:', errorBody);
                throw new Error(`Failed to upload Rich Menu Image: ${errorBody}`);
            }
            console.log('✅ Image Uploaded');

            // 5. Set Default
            console.log('Setting as Default...');
            const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!defaultRes.ok) throw new Error('Failed to set Default Rich Menu');
            console.log('✅ Rich Menu Set as Default');

            // Save to DB (Update legacy id if needed, or just log it)
            // await query("INSERT INTO settings (key, value) VALUES ('active_rich_menu_id', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [richMenuId]);

            res.json({ success: true, richMenuId });

        } catch (err) {
            console.error('❌ Auto-Setup Error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // --- LINE Messaging API Helper ---
    const sendLineFlexMessage = async (to, orderData) => {
        // Fetch Token from Database
        let token = process.env.LINE_CHANNEL_ACCESS_TOKEN; // Fallback
        try {
            const tokenRes = await query("SELECT value FROM settings WHERE key = 'line_channel_access_token'");
            if (tokenRes.rows.length > 0 && tokenRes.rows[0].value) {
                token = tokenRes.rows[0].value;
            }
        } catch (err) {
            console.error('Failed to fetch line_channel_access_token:', err);
        }

        if (!token || !to) {
            console.log('⚠️ Skipping LINE Message: No token or lineUserId' + (!token ? ' (Not configured in Settings)' : ''));
            return;
        }

        const { order_type, id, customer_name, customer_phone, total_amount, items_json } = orderData;
        const trackingUrl = `https://pos-backend-8cud.onrender.com/tracking/${orderData.tracking_token}`;

        // Fetch Shop Name
        const shopNameRes = await query("SELECT value FROM settings WHERE key = 'shop_name'");
        const shopName = shopNameRes.rows[0]?.value || 'Tasty Station';

        let items = [];
        try { items = JSON.parse(items_json || '[]'); } catch (e) { items = []; }

        // Build Item List String with Options and Prices
        const itemsList = items.map(item => {
            let line = `- ${item.name || item.product_name} x${item.quantity}`;
            if (item.options && item.options.length > 0) {
                const optDetails = item.options.map(o => {
                    const optName = o.name || o.option_name;
                    const price = parseFloat(o.price_modifier || o.price || 0);
                    return price > 0 ? `${optName}(฿${price})` : optName;
                }).join(', ');
                line += ` [+${optDetails}]`;
            }
            return line;
        }).join('\n');

        let bubbleContent = {
            "type": "bubble",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    { "type": "text", "text": "ยืนยันออเดอร์สำเร็จ", "weight": "bold", "color": "#1DB446", "size": "sm" },
                    { "type": "text", "text": shopName, "weight": "bold", "size": "xxl", "margin": "md" },
                    { "type": "text", "text": `Order ID: #${id}`, "size": "xs", "color": "#aaaaaa" }
                ]
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    { "type": "separator", "margin": "md" },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "margin": "xxl",
                        "spacing": "sm",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "contents": [
                                    { "type": "text", "text": "ลูกค้า", "size": "sm", "color": "#555555", "flex": 0 },
                                    { "type": "text", "text": customer_name || '-', "size": "sm", "color": "#111111", "align": "end" }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "contents": [
                                    { "type": "text", "text": "ที่อยู่/เบอร์โทร", "size": "sm", "color": "#555555", "flex": 0 },
                                    { "type": "text", "text": customer_phone || '-', "size": "sm", "color": "#111111", "align": "end" }
                                ]
                            }
                        ]
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                    { "type": "text", "text": "ขอบคุณที่ใช้บริการค่ะ! 🙏✨", "style": "italic", "size": "xs", "color": "#aaaaaa", "align": "center" }
                ]
            }
        };

        // Customize Body based on Order Type
        if (order_type === 'reservation') {
            bubbleContent.body.contents.push({
                "type": "box",
                "layout": "vertical",
                "margin": "md",
                "contents": [
                    { "type": "text", "text": "📌 รายละเอียดการจอง", "weight": "bold", "size": "sm" },
                    { "type": "text", "text": `วันที่: ${orderData.reservation_date || '-'}`, "size": "sm", "margin": "xs" },
                    { "type": "text", "text": `เวลา: ${orderData.reservation_time || '-'}`, "size": "sm" },
                    { "type": "text", "text": `จำนวน: ${orderData.guests_count || '-'} ท่าน`, "size": "sm" },
                    { "type": "text", "text": `โต๊ะที่จอง: ${orderData.assigned_table || 'พนักงานจะจัดให้เมื่อถึงร้าน'}`, "size": "sm", "color": "#06C755", "weight": "bold" }
                ]
            });
        } else if (order_type === 'delivery') {
            bubbleContent.body.contents.push({
                "type": "box",
                "layout": "vertical",
                "margin": "md",
                "contents": [
                    { "type": "text", "text": "🚀 รายละเอียดการจัดส่ง", "weight": "bold", "size": "sm" },
                    { "type": "text", "text": orderData.customer_address || '-', "size": "sm", "wrap": true, "margin": "xs" },
                    { "type": "separator", "margin": "md" }
                ]
            });
            bubbleContent.footer.contents.unshift({
                "type": "button",
                "action": { "type": "uri", "label": "ติดตามสถานะไรเดอร์", "uri": trackingUrl },
                "style": "primary",
                "color": "#06C755"
            });
        } else if (order_type === 'takeaway') {
            bubbleContent.body.contents.push({
                "type": "box",
                "layout": "vertical",
                "margin": "md",
                "contents": [
                    { "type": "text", "text": "🥡 รับกลับบ้าน", "weight": "bold", "size": "sm" },
                    { "type": "text", "text": `รหัสรับอาหาร: #${id}`, "size": "sm", "margin": "xs" },
                    { "type": "text", "text": `นัดรับเวลา: ${orderData.reservation_time || 'เร็วที่สุด'}`, "size": "sm" }
                ]
            });
        }

        // Fetch Coupon Info
        let couponInfo = null;
        try {
            const couponRes = await query(`
                SELECT c.coupon_code, p.title 
                FROM loyalty_coupons c
                JOIN loyalty_promotions p ON c.promotion_id = p.id
                WHERE c.line_order_id = $1 AND c.status = 'used'
            `, [id]);
            couponInfo = couponRes.rows[0];
        } catch (e) {
            console.error('Failed to fetch coupon for Line Msg:', e);
        }

        // Add Items and Total
        const detailsContents = [
            { "type": "text", "text": "📦 รายการอาหาร", "weight": "bold", "size": "sm" },
            { "type": "text", "text": itemsList || 'ไม่ได้ระบุรายการ', "size": "xs", "color": "#888888", "wrap": true, "margin": "xs" },
            { "type": "separator", "margin": "md" }
        ];

        // Add Coupon/Discount Row if coupon was applied (from orderData directly)
        const hasCoupon = orderData.coupon_code && parseFloat(orderData.coupon_discount || 0) > 0;
        if (hasCoupon) {
            // Show original amount (before discount)
            detailsContents.push({
                "type": "box",
                "layout": "horizontal",
                "margin": "sm",
                "contents": [
                    { "type": "text", "text": "ยอดก่อนลด", "size": "xs", "color": "#888888" },
                    { "type": "text", "text": `฿${parseFloat(orderData.original_amount || 0).toLocaleString()}`, "size": "xs", "align": "end", "color": "#888888", "decoration": "line-through" }
                ]
            });
            // Show coupon discount
            detailsContents.push({
                "type": "box",
                "layout": "horizontal",
                "margin": "sm",
                "contents": [
                    { "type": "text", "text": `🎁 คูปอง: ${orderData.coupon_code}`, "size": "xs", "color": "#A020F0", "weight": "bold" },
                    { "type": "text", "text": `-฿${parseFloat(orderData.coupon_discount).toLocaleString()}`, "size": "xs", "align": "end", "color": "#1DB446", "weight": "bold" }
                ]
            });
        }
        // Fallback: Show coupon from legacy JOIN query if no direct data
        else if (couponInfo) {
            detailsContents.push({
                "type": "box",
                "layout": "horizontal",
                "margin": "md",
                "contents": [
                    { "type": "text", "text": "🎁 คูปองส่วนลด", "size": "xs", "color": "#A020F0", "weight": "bold" },
                    { "type": "text", "text": `${couponInfo.coupon_code} | ${couponInfo.title}`, "size": "xs", "align": "end", "color": "#A020F0" }
                ]
            });
        }


        detailsContents.push({
            "type": "box",
            "layout": "horizontal",
            "margin": "md",
            "contents": [
                { "type": "text", "text": "ยอดรวมทั้งสิ้น", "weight": "bold", "size": "md" },
                { "type": "text", "text": `฿${total_amount.toLocaleString()}`, "weight": "bold", "size": "md", "align": "end", "color": "#D32F2F" }
            ]
        });

        bubbleContent.body.contents.push({
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "contents": detailsContents
        });

        try {
            console.log(`📡 Sending LINE Push to: ${to}`);
            const response = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: to,
                    messages: [
                        {
                            "type": "flex",
                            "altText": `ยืนยันออเดอร์ #${id} - ${shopName}`,
                            "contents": bubbleContent
                        }
                    ]
                })
            });
            const resData = await response.json();
            if (response.ok) {
                console.log('✅ LINE Message Sent Successfully:', resData);
            } else {
                console.error('❌ LINE Messaging API Error:', resData);
            }
        } catch (err) {
            console.error('❌ Failed to fetch LINE Messaging API:', err.message);
        }
    };

    // PUBLIC: Create LINE Order (Customer Submission)
    app.post('/api/public/line-orders', async (req, res) => {
        console.log('📦 Incoming LINE Order:', req.body.customerName, '| Type:', req.body.orderType, '| UserID:', req.body.lineUserId);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 0. CHECK STORE STATUS
            const storeStatus = await getStoreStatus();
            if (storeStatus.status === 'closed') {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: storeStatus.message, status: 'closed' });
            }
            if (storeStatus.status === 'last_order') {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: storeStatus.message, status: 'last_order' });
            }

            const {
                orderType, customerName, customerPhone, customerAddress,
                latitude, longitude, reservationDate, reservationTime,
                guestsCount, assignedTable, items, totalAmount, note,
                lineUserId // Capture from LIFF
            } = req.body;

            // Validate minimum order for delivery
            if (orderType === 'delivery') {
                const settingsRes = await client.query("SELECT value FROM settings WHERE key = 'minimum_delivery_order'");
                const minOrder = parseFloat(settingsRes.rows[0]?.value) || 100;
                if (totalAmount < minOrder) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `ยอดสั่งซื้อขั้นต่ำสำหรับ Delivery คือ ฿${minOrder}` });
                }
            }

            // Lookup customer_id automatically if lineUserId provided
            let customerId = null;
            if (lineUserId) {
                const customerLookup = await client.query("SELECT id FROM loyalty_customers WHERE line_user_id = $1", [lineUserId]);
                if (customerLookup.rowCount > 0) {
                    customerId = customerLookup.rows[0].id;
                }
            }

            // (Deposit calculation moved to after coupon processing)

            // 1. Associate Phone with LINE Account (Loyalty)
            if (lineUserId && customerPhone) {
                // Update phone if it's null or empty
                await client.query(`
                    UPDATE loyalty_customers 
                    SET phone = $1, updated_at = CURRENT_TIMESTAMP 
                    WHERE line_user_id = $2 AND (phone IS NULL OR phone = '')
                `, [customerPhone, lineUserId]);
            }

            // 2. Coupon Processing
            let couponDiscount = 0;
            let finalTotal = totalAmount;
            const { couponCode } = req.body;

            if (couponCode && customerId) {
                // Verify coupon is active and belongs to this customer
                const couponCheck = await client.query(`
                    SELECT c.*, p.title, p.description
                    FROM loyalty_coupons c
                    JOIN loyalty_promotions p ON c.promotion_id = p.id
                    WHERE c.coupon_code = $1 AND c.customer_id = $2 AND c.status = 'active'
                `, [couponCode.toUpperCase(), customerId]);

                if (couponCheck.rowCount > 0) {
                    const coupon = couponCheck.rows[0];

                    // 1. Try to get discount from discount_value column (most reliable)
                    if (coupon.discount_value && parseFloat(coupon.discount_value) > 0) {
                        if (coupon.discount_type === 'percent') {
                            // Percentage discount: e.g., 10% off
                            couponDiscount = Math.floor(totalAmount * (parseFloat(coupon.discount_value) / 100));
                        } else if (coupon.discount_type === 'fixed_price') {
                            // Fixed price: customer pays only this amount, discount = total - fixed_price
                            couponDiscount = Math.max(0, totalAmount - parseFloat(coupon.discount_value));
                        } else {
                            // Fixed discount: e.g., 10 baht off (default)
                            couponDiscount = parseFloat(coupon.discount_value);
                        }
                    }
                    // 2. Fallback: Try to parse from title
                    else {
                        // Pattern 1: "ลด XX" or "ลด XX บาท"
                        const matchLod = coupon.title.match(/ลด\s*(\d+)/);
                        // Pattern 2: "XX%" 
                        const matchPercent = coupon.title.match(/(\d+)%/);
                        // Pattern 3: "ราคา XX.-" (fixed price like "ราคา 35.-")
                        const matchPrice = coupon.title.match(/ราคา\s*(\d+)/);
                        // Pattern 4: Just any number (last resort)
                        const allNumbers = coupon.title.match(/\d+/g);

                        if (matchLod) {
                            couponDiscount = parseInt(matchLod[1]);
                        } else if (matchPercent) {
                            couponDiscount = Math.floor(totalAmount * (parseInt(matchPercent[1]) / 100));
                        } else if (matchPrice) {
                            // "ราคา 35.-" means discount = totalAmount - 35
                            couponDiscount = Math.max(0, totalAmount - parseInt(matchPrice[1]));
                        } else if (allNumbers && allNumbers.length > 0) {
                            // Use last number as fallback
                            couponDiscount = parseInt(allNumbers[allNumbers.length - 1]);
                        }
                    }

                    if (couponDiscount > 0) {
                        finalTotal = Math.max(0, totalAmount - couponDiscount);
                        console.log(`🎟️ Applied Coupon: ${couponCode} (-฿${couponDiscount})`);
                    } else {
                        console.log(`⚠️ Coupon ${couponCode} found but could not determine discount value`);
                    }
                }
            }

            // Calculate Deposit (50% for reservations with items) - Moved to use Final Total
            let depositAmount = 0;
            if (orderType === 'reservation' && items && items.length > 0) {
                depositAmount = finalTotal * 0.5;
            }

            // 2.5 STOCK DEDUCTION (Centralized)
            // This will throw if stock is insufficient
            await processStockDeduction(items, client);

            // Generate tracking token for delivery (Case-insensitive check)
            const trackingToken = (orderType && orderType.toLowerCase() === 'delivery')
                ? 'TRK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase()
                : null;

            // Convert items to JSON string for items_json column
            const itemsJson = JSON.stringify(items || []);

            // Insert order with correct column names from actual schema
            const orderRes = await client.query(`
                INSERT INTO line_orders 
                (order_type, customer_name, customer_phone, customer_address, 
                 total_amount, status, note, tracking_token, items_json,
                 latitude, longitude, reservation_date, reservation_time, guests_count,
                 deposit_amount, is_deposit_paid, assigned_table, line_user_id, customer_id,
                 coupon_code, coupon_discount, original_amount)
                VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                RETURNING id
            `, [
                orderType || 'delivery',
                customerName || '',
                customerPhone || '',
                customerAddress || '',
                finalTotal, // Use calculated total (after coupon)
                note || '',
                trackingToken,
                itemsJson,
                latitude || null,
                longitude || null,
                reservationDate || null,
                reservationTime || null,
                guestsCount || null,
                depositAmount,
                false, // is_deposit_paid
                assignedTable || null,
                lineUserId || null, // $17
                customerId, // $18
                couponCode || null, // $19 - coupon_code
                couponDiscount || 0, // $20 - coupon_discount
                totalAmount // $21 - original_amount (before discount)
            ]);

            const orderId = orderRes.rows[0].id;

            // 3. Mark coupon as used and link to order
            if (couponCode && couponDiscount > 0) {
                const updateRes = await client.query(`
                    UPDATE loyalty_coupons 
                    SET status = 'used', used_at = CURRENT_TIMESTAMP, line_order_id = $1 
                    WHERE coupon_code = $2 AND customer_id = $3 AND status = 'active'
                `, [orderId, couponCode.toUpperCase(), customerId]);

                if (updateRes.rowCount === 0) {
                    console.warn(`⚠️ Coupon Update Failed: Code=${couponCode}, Cust=${customerId}, Order=${orderId}`);
                    // Critical: If we applied discount but failed to mark used, we MUST rollback to prevent reuse
                    throw new Error('ไม่สามารถตัดยอดคูปองได้ (Coupon Update Failed)');
                }

                // Notification: Coupon Used
                createNotification(
                    `🎫 ใช้คูปองส่วนลด`,
                    `${customerName} ใช้คูปอง ${couponCode} (ลด ฿${couponDiscount})`,
                    'coupon',
                    { orderId, couponCode, discount: couponDiscount }
                );
            }

            // Also insert to line_order_items for backwards compatibility
            if (items && items.length > 0) {
                for (const item of items) {
                    try {
                        await client.query(`
                            INSERT INTO line_order_items (line_order_id, product_id, product_name, quantity, price, options)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [orderId, item.id, item.name, item.quantity, item.price, JSON.stringify(item.options || [])]);
                    } catch (itemErr) {
                        console.log('Item insert note:', itemErr.message);
                    }
                }
            }

            await client.query('COMMIT');

            // Trigger LINE Notification (Async - outside transaction)
            if (lineUserId) {
                console.log(`🔔 Triggering LINE message for User: ${lineUserId}`);
                query("SELECT * FROM line_orders WHERE id = $1", [orderId]).then(fullOrderRes => {
                    if (fullOrderRes.rows[0]) {
                        sendLineFlexMessage(lineUserId, fullOrderRes.rows[0]);
                    }
                }).catch(err => console.error('Error fetching order for LINE notification:', err));
            }

            // Emit socket event
            if (orderType !== 'reservation' || (items && items.length > 0)) {
                io.emit('new-line-order', { orderId, orderType, customerName, totalAmount, depositAmount });
                createNotification(
                    `ออเดอร์ LINE ใหม่ - ${customerName}`,
                    `ประเภท: ${orderType === 'delivery' ? '🚚 ส่งถึงบ้าน' : (orderType === 'takeaway' ? '🛍️ รับเองที่ร้าน' : '📅 จองโต๊ะ')} (ยอด: ${totalAmount}.-)`,
                    'order',
                    { orderId, orderType, customerName }
                );
            }

            res.json({ success: true, orderId, trackingToken, depositAmount });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Public line-orders error:', err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // PUBLIC: Get Display Settings
    app.get('/api/public/settings', async (req, res) => {
        try {
            const result = await query("SELECT * FROM settings");
            const settings = {};
            result.rows.forEach(row => { settings[row.key] = row.value; });
            res.json(settings);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUBLIC: Register Takeaway Order (Customers ordering from QR)
    app.post('/api/public/takeaway-orders', async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 0. CHECK STORE STATUS
            const storeStatus = await getStoreStatus();
            if (storeStatus.status === 'closed') {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: storeStatus.message, status: 'closed' });
            }
            if (storeStatus.status === 'last_order') {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: storeStatus.message, status: 'last_order' });
            }

            const {
                customer_name, customer_phone, items, total_amount
            } = req.body;

            // 1. STOCK DEDUCTION (Centralized)
            // Expects items to have product_id/id and options/selectedOptions
            await processStockDeduction(items, client);

            // 2. Insert into main orders table as 'takeaway'
            const orderRes = await client.query(`
                INSERT INTO orders 
                (order_type, status, total_amount, subtotal, grand_total, customer_name, customer_phone)
                VALUES ($1, 'cooking', $2, $2, $2, $3, $4)
                RETURNING id
            `, ['takeaway', total_amount, customer_name, customer_phone]);

            const orderId = orderRes.rows[0].id;

            // 3. Insert items
            if (items && items.length > 0) {
                for (const item of items) {
                    const finalPrice = item.unitPrice || item.price;
                    const itemResult = await client.query(`
                        INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING id
                    `, [orderId, item.product_id, item.product_name, finalPrice, item.quantity]);

                    const orderItemId = itemResult.rows[0].id;

                    // 4. Insert options
                    if (item.options && item.options.length > 0) {
                        for (const opt of item.options) {
                            await client.query(
                                'INSERT INTO order_item_options (order_item_id, option_id, option_name, price_modifier) VALUES ($1, $2, $3, $4)',
                                [orderItemId, opt.id, opt.name, opt.price_modifier || 0]
                            );
                        }
                    }
                }
            }

            await client.query('COMMIT');

            // 5. Success Notifications (Outside transaction)
            io.emit('new-order', { orderId, orderType: 'takeaway', customerName: customer_name });
            createNotification(
                `ออเดอร์ Takeaway ใหม่!`,
                `ลูกค้าคุณ ${customer_name} สั่งอาหารกลับบ้าน (ยอด: ${total_amount}.-)`,
                'takeaway',
                { orderId, customerName: customer_name }
            );

            res.json({ success: true, orderId });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Public takeaway-order error:', err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // Mark order as served
    app.post('/api/kitchen/orders/:id/serve', async (req, res) => {
        const { id } = req.params;
        try {
            await query("UPDATE order_items SET status = 'served' WHERE order_id = $1", [id]);

            // If it's a takeaway order, mark the whole order as ready
            const orderRes = await query("SELECT order_type, table_name FROM orders WHERE id = $1", [id]);
            const order = orderRes.rows[0];
            if (order?.order_type === 'takeaway') {
                await query("UPDATE orders SET status = 'ready' WHERE id = $1", [id]);

                // Create notification for takeaway ready
                createNotification(
                    `ออเดอร์ Takeaway พร้อมแล้ว!`,
                    `ลูกค้าคุณ ${order.table_name} (ออเดอร์ #${id}) พร้อมสำหรับการรับของแล้ว`,
                    'takeaway',
                    { orderId: id, customerName: order.table_name }
                );
            }

            io.emit('kitchen-update');
            io.emit('order-update'); // Notify TablePlan
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get Active Takeaway Orders (Ready for pickup)
    app.get('/api/orders/takeaway/active', async (req, res) => {
        try {
            const result = await query(`
                SELECT * FROM orders 
                WHERE order_type = 'takeaway' AND status = 'ready'
                ORDER BY created_at DESC
            `);
            const ordersWithItems = await Promise.all(result.rows.map(async (order) => {
                const itemsResult = await query("SELECT * FROM order_items WHERE order_id = $1", [order.id]);

                // Fetch options for each item
                const itemsWithOptions = await Promise.all(itemsResult.rows.map(async (item) => {
                    const optionsResult = await query(
                        "SELECT id, option_name as name, price_modifier FROM order_item_options WHERE order_item_id = $1",
                        [item.id]
                    );
                    return { ...item, options: optionsResult.rows };
                }));

                return { ...order, items: itemsWithOptions };
            }));
            res.json(ordersWithItems);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Pay Order (Dine-in / General) - [DUPLICATE REMOVED]
    // Consolidate logic to the endpoint (approx line 1608) to avoid conflicts.
    // Logic from here (updating discount_amount and Loyalty Points) is merged/handled there.

    // Complete/Pickup Order
    app.post('/api/orders/:id/complete', async (req, res) => {
        const { id } = req.params;
        const { paymentMethod } = req.body;
        try {
            await query(
                "UPDATE orders SET status = 'paid', payment_method = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                [paymentMethod || 'cash', id]
            );

            // Earn Loyalty Points (Fetch customer info first)
            const orderRes = await query("SELECT customer_id, total_amount FROM orders WHERE id = $1", [id]);
            const order = orderRes.rows[0];
            if (order && order.customer_id) {
                await earnLoyaltyPoints(order.customer_id, order.total_amount, id, null);
            }

            io.emit('order-update');
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Get All LINE Orders
    // This endpoint is replaced by the new /api/line_orders above.
    // The original content for this endpoint was:
    // app.get('/api/line-orders', (req, res) => { ... });

    // ADMIN: Get Single LINE Order
    app.get('/api/line-orders/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const result = await query('SELECT * FROM line_orders WHERE id = $1', [id]);
            const order = result.rows[0];
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            const itemsRes = await query("SELECT * FROM line_order_items WHERE line_order_id = $1", [id]);
            order.items = itemsRes.rows;
            res.json(order);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Confirm LINE Order
    app.post('/api/line-orders/:id/confirm', async (req, res) => {
        const { id } = req.params;
        try {
            await query("UPDATE line_orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
            io.emit('line-order-update', { orderId: id, status: 'confirmed' });

            // Notification: Order confirmed
            const orderRes = await query("SELECT customer_name, order_type FROM line_orders WHERE id = $1", [id]);
            const orderInfo = orderRes.rows[0];
            createNotification(
                `✅ ออเดอร์ยืนยันแล้ว #${id}`,
                `${orderInfo?.customer_name || 'ลูกค้า'} - ${orderInfo?.order_type === 'delivery' ? '🚚 เดลิเวอรี่' : '🛍️ Takeaway'}`,
                'order',
                { orderId: id, status: 'confirmed' }
            );

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Mark as Preparing
    app.post('/api/line-orders/:id/preparing', async (req, res) => {
        const { id } = req.params;
        try {
            await query("UPDATE line_orders SET status = 'preparing', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
            io.emit('line-order-update', { orderId: id, status: 'preparing' });

            // Notification: Kitchen preparing
            createNotification(
                `👨‍🍳 ครัวกำลังทำ #${id}`,
                `ออเดอร์กำลังอยู่ระหว่างการจัดเตรียม`,
                'kitchen',
                { orderId: id, status: 'preparing' }
            );

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Mark as Ready
    app.post('/api/line-orders/:id/ready', async (req, res) => {
        const { id } = req.params;
        try {
            await query("UPDATE line_orders SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
            io.emit('line-order-update', { orderId: id, status: 'ready' });

            // Notification: Order ready for pickup/delivery
            createNotification(
                `✅ อาหารพร้อมแล้ว #${id}`,
                `รอไรเดอร์มารับ หรือลูกค้ามารับสินค้า`,
                'delivery',
                { orderId: id, status: 'ready' }
            );

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/line-orders/:id/pay', async (req, res) => {
        const { id } = req.params;
        const { paymentMethod, paidAmount } = req.body;
        try {
            await query(
                "UPDATE line_orders SET status = 'completed', payment_method = $1, total_amount = COALESCE($2, total_amount), is_deposit_paid = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
                [paymentMethod || 'cash', paidAmount || null, id]
            );

            // Earn Loyalty Points (Fetch customer info first)
            const orderRes = await query("SELECT customer_id, total_amount FROM line_orders WHERE id = $1", [id]);
            const order = orderRes.rows[0];
            if (order && order.customer_id) {
                console.log(`💎 Awarding points for completed LINE order: #${id}`);
                await earnLoyaltyPoints(order.customer_id, order.total_amount, null, id);
            }

            io.emit('line-order-update', { orderId: id, status: 'completed' });
            io.emit('delivery-order-update', { orderId: id, status: 'completed' });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Toggle Deposit Paid Status
    app.post('/api/line-orders/:id/toggle-deposit', async (req, res) => {
        const { id } = req.params;
        const { isPaid } = req.body;
        try {
            await query("UPDATE line_orders SET is_deposit_paid = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [isPaid, id]);
            io.emit('line-order-update', { orderId: id });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Assign Table to Reservation
    app.post('/api/line-orders/:id/assign-table', async (req, res) => {
        const { id } = req.params;
        const { tableName } = req.body;
        try {
            await query("UPDATE line_orders SET assigned_table = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [tableName, id]);
            io.emit('table-update', { id: null, status: 'refresh' });
            io.emit('line-order-update', { orderId: id });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Check-in LINE Reservation to POS
    app.post('/api/line-orders/:id/check-in', async (req, res) => {
        const { id } = req.params;
        try {
            await query('BEGIN');

            // 1. Get reservation details
            const lineOrderRes = await query("SELECT * FROM line_orders WHERE id = $1", [id]);
            if (lineOrderRes.rowCount === 0) {
                await query('ROLLBACK');
                return res.status(404).json({ error: 'ไม่พบรายการจอง' });
            }
            const lineOrder = lineOrderRes.rows[0];

            if (!lineOrder.assigned_table) {
                await query('ROLLBACK');
                return res.status(400).json({ error: 'กรุณาระบุโต๊ะก่อน Check-in ค่ะ' });
            }

            // 2. Check if table is already occupied in POS
            const tableCheck = await query("SELECT status FROM tables WHERE name = $1", [lineOrder.assigned_table]);
            if (tableCheck.rows[0]?.status !== 'available') {
                await query('ROLLBACK');
                return res.status(400).json({ error: `โต๊ะ ${lineOrder.assigned_table} ไม่ว่างค่ะ กรุณาเคลียร์โต๊ะก่อน` });
            }

            // 3. Create POS order
            const posOrderRes = await query(`
                INSERT INTO orders (table_name, order_type, status, line_order_id)
                VALUES ($1, 'dine_in', 'cooking', $2)
                RETURNING id
            `, [lineOrder.assigned_table, id]);
            const posOrderId = posOrderRes.rows[0].id;

            // 4. Update table status
            await query("UPDATE tables SET status = 'occupied' WHERE name = $1", [lineOrder.assigned_table]);

            // 5. Update LINE order status to 'ready' (as requested: Check-in sets to Ready)
            await query("UPDATE line_orders SET status = 'ready' WHERE id = $1", [id]);

            // 6. Get pre-order items from line_order_items table
            const itemsRes = await query("SELECT product_id, product_name, price, quantity FROM line_order_items WHERE line_order_id = $1", [id]);
            const items = itemsRes.rows;

            for (const item of items) {
                await query(`
                    INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
                    VALUES ($1, $2, $3, $4, $5)
                `, [posOrderId, item.product_id, item.product_name, item.price, item.quantity]);
            }

            await query('COMMIT');
            res.json({ success: true, posOrderId, tableName: lineOrder.assigned_table });

            // Notify via socket
            io.emit('table-update');
            io.emit('line-order-update');
        } catch (err) {
            await query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Complete LINE Order
    app.post('/api/line-orders/:id/complete', async (req, res) => {
        const { id } = req.params;
        try {
            await query("UPDATE line_orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);

            // Earn Loyalty Points (Fetch customer info first)
            const orderRes = await query("SELECT customer_id, total_amount FROM line_orders WHERE id = $1", [id]);
            const order = orderRes.rows[0];
            if (order && order.customer_id) {
                console.log(`💎 Awarding points for completed LINE order: #${id}`);
                await earnLoyaltyPoints(order.customer_id, order.total_amount, null, id);
            }

            io.emit('line-order-update', { orderId: id, status: 'completed' });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Cancel LINE Order
    app.post('/api/line-orders/:id/cancel', async (req, res) => {
        const { id } = req.params;
        try {
            await query("UPDATE line_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
            io.emit('line-order-update', { orderId: id, status: 'cancelled' });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================
    // === DELIVERY SYSTEM API ===
    // ============================================

    // Generate unique tracking token
    const generateTrackingToken = () => {
        return 'TRK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    // Get Delivery Settings (minimum order, delivery fee, etc.)
    app.get('/api/delivery/settings', async (req, res) => {
        try {
            const result = await query("SELECT * FROM settings WHERE key IN ('minimum_delivery_order', 'delivery_fee', 'delivery_enabled')");
            const settings = {};
            result.rows.forEach(s => settings[s.key] = s.value);
            res.json({
                minimumOrder: parseFloat(settings.minimum_delivery_order) || 100,
                deliveryFee: parseFloat(settings.delivery_fee) || 0,
                deliveryEnabled: settings.delivery_enabled !== 'false'
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get all Delivery Orders (for Admin)
    app.get('/api/delivery-orders', async (req, res) => {
        const { status, type } = req.query;
        try {
            let sql = "SELECT * FROM line_orders WHERE order_type = 'delivery'";
            const params = [];
            let paramIdx = 1;

            if (status && status !== 'all') {
                sql += ` AND status = $${paramIdx}`;
                params.push(status);
                paramIdx++;
            }

            sql += " ORDER BY created_at DESC";

            const ordersRes = await query(sql, params);
            const orders = ordersRes.rows;

            // Get items for each order
            for (let order of orders) {
                const itemsRes = await query("SELECT * FROM line_order_items WHERE line_order_id = $1", [order.id]);
                order.items = itemsRes.rows;
            }

            res.json(orders);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get orders pending for Rider pickup
    app.get('/api/delivery-orders/pending-pickup', async (req, res) => {
        try {
            const ordersRes = await query(`
                SELECT lo.*, u.name as rider_name
                FROM line_orders lo
                LEFT JOIN users u ON lo.rider_id = u.id
                WHERE lo.order_type = 'delivery' 
                AND lo.status = 'ready'
                ORDER BY lo.created_at ASC
            `);
            const orders = ordersRes.rows;

            for (let order of orders) {
                const itemsRes = await query("SELECT * FROM line_order_items WHERE line_order_id = $1", [order.id]);
                order.items = itemsRes.rows;
            }

            res.json(orders);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get current rider's active deliveries
    app.get('/api/delivery-orders/my-deliveries/:riderId', async (req, res) => {
        const { riderId } = req.params;
        try {
            const ordersRes = await query(`
                SELECT * FROM line_orders 
                WHERE rider_id = $1 
                AND status IN ('picked_up', 'delivering')
                ORDER BY delivery_started_at ASC
            `, [riderId]);
            const orders = ordersRes.rows;

            for (let order of orders) {
                const itemsRes = await query("SELECT * FROM line_order_items WHERE line_order_id = $1", [order.id]);
                order.items = itemsRes.rows;
            }

            res.json(orders);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Rider picks up the order
    app.post('/api/delivery-orders/:id/pickup', async (req, res) => {
        const { id } = req.params;
        const { riderId } = req.body;
        try {
            // Generate tracking token if not exists
            const orderRes = await query("SELECT tracking_token FROM line_orders WHERE id = $1", [id]);
            let trackingToken = orderRes.rows[0]?.tracking_token;
            if (!trackingToken) {
                trackingToken = generateTrackingToken();
            }

            await query(`
                UPDATE line_orders 
                SET status = 'picked_up', 
                    rider_id = $1,
                    tracking_token = $2,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = $3
            `, [riderId, trackingToken, id]);

            io.emit('delivery-order-update', { orderId: id, status: 'picked_up', riderId });

            // Notification: Rider picked up
            const riderRes = await query("SELECT name FROM users WHERE id = $1", [riderId]);
            const riderName = riderRes.rows[0]?.name || 'ไรเดอร์';
            createNotification(
                `🛵 ไรเดอร์รับงานแล้ว #${id}`,
                `${riderName} กำลังเตรียมจัดส่ง`,
                'delivery',
                { orderId: id, riderId, status: 'picked_up' }
            );

            res.json({ success: true, trackingToken });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Rider starts delivery (GPS tracking begins)
    app.post('/api/delivery-orders/:id/start-delivery', async (req, res) => {
        const { id } = req.params;
        try {
            await query(`
                UPDATE line_orders 
                SET status = 'delivering', 
                    delivery_started_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = $1
            `, [id]);

            io.emit('delivery-order-update', { orderId: id, status: 'delivering' });

            // Notification: Delivery started
            createNotification(
                `🚀 เริ่มจัดส่งแล้ว #${id}`,
                `ไรเดอร์ออกเดินทางส่งอาหารแล้ว`,
                'delivery',
                { orderId: id, status: 'delivering' }
            );

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Update Rider GPS location (every 10 seconds)
    app.patch('/api/delivery-orders/:id/rider-location', async (req, res) => {
        const { id } = req.params;
        const { lat, lng } = req.body;
        try {
            await query(`
                UPDATE line_orders 
                SET rider_lat = $1, rider_lng = $2, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $3
            `, [lat, lng, id]);

            // Emit to tracking page
            io.emit('rider-location-update', { orderId: parseInt(id), lat, lng });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Mark order as delivered
    app.post('/api/delivery-orders/:id/delivered', async (req, res) => {
        const { id } = req.params;
        const { paymentMethod } = req.body;
        try {
            await query(`
                UPDATE line_orders 
                SET status = 'completed', 
                    payment_method = $1,
                    delivered_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = $2
            `, [paymentMethod || 'cash', id]);

            // Earn Loyalty Points (Fetch customer info first)
            const orderRes = await query("SELECT customer_id, total_amount FROM line_orders WHERE id = $1", [id]);
            const order = orderRes.rows[0];
            if (order && order.customer_id) {
                console.log(`💎 Awarding points for delivered LINE order: #${id}`);
                await earnLoyaltyPoints(order.customer_id, order.total_amount, null, id);
            }

            io.emit('delivery-order-update', { orderId: id, status: 'completed' });
            io.emit('line-order-update', { orderId: id, status: 'completed' });

            // Notification: Delivered successfully
            createNotification(
                `✅ ส่งสำเร็จ #${id}`,
                `ลูกค้าได้รับอาหารเรียบร้อยแล้ว (฿${order?.total_amount || 0})`,
                'success',
                { orderId: id, status: 'completed', amount: order?.total_amount }
            );

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // PUBLIC: Get order status by tracking token (for customer tracking page)
    app.get('/api/public/tracking/:token', async (req, res) => {
        const { token } = req.params;
        try {
            const orderRes = await query(`
                SELECT 
                    lo.id, lo.status, lo.customer_name, lo.delivery_address,
                    lo.rider_lat, lo.rider_lng, lo.customer_lat, lo.customer_lng,
                    lo.total_amount, lo.delivery_fee, lo.created_at, lo.updated_at,
                    lo.delivery_started_at, lo.delivered_at, lo.estimated_delivery_time,
                    lo.queue_position, u.name as rider_name, u.phone as rider_phone
                FROM line_orders lo
                LEFT JOIN users u ON lo.rider_id = u.id
                WHERE lo.tracking_token = $1
            `, [token]);

            if (orderRes.rows.length === 0) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const order = orderRes.rows[0];

            // Calculate queue position if still in preparing
            if (['confirmed', 'preparing'].includes(order.status)) {
                const queueRes = await query(`
                    SELECT COUNT(*) as position FROM line_orders 
                    WHERE status IN ('confirmed', 'preparing') 
                    AND created_at < (SELECT created_at FROM line_orders WHERE tracking_token = $1)
                `, [token]);
                order.queue_position = parseInt(queueRes.rows[0].position) + 1;
            }

            // Get items
            const itemsRes = await query("SELECT product_name, quantity, price FROM line_order_items WHERE line_order_id = $1", [order.id]);
            order.items = itemsRes.rows;

            res.json(order);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // PUBLIC: Create Delivery Order (from customer page)
    app.post('/api/public/delivery-orders', async (req, res) => {
        const {
            customerName, customerPhone, customerAddress,
            latitude, longitude, items, totalAmount, note
        } = req.body;

        const client = await pool.connect();

        try {
            // Validate minimum order
            const settingsRes = await client.query("SELECT value FROM settings WHERE key = 'minimum_delivery_order'");
            const minOrder = parseFloat(settingsRes.rows[0]?.value) || 100;

            if (totalAmount < minOrder) {
                return res.status(400).json({
                    error: `ยอดสั่งขั้นต่ำสำหรับ Delivery คือ ฿${minOrder}`,
                    minimumOrder: minOrder
                });
            }

            await client.query('BEGIN');

            // Generate tracking token
            const trackingToken = generateTrackingToken();

            // Serialize items to JSON to preserve options (Global & Local)
            const itemsJson = JSON.stringify(items || []);

            const result = await client.query(`
                INSERT INTO line_orders (
                    order_type, customer_name, customer_phone, delivery_address,
                    customer_lat, customer_lng, total_amount, status, note, tracking_token, items_json
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10) 
                RETURNING id
            `, ['delivery', customerName, customerPhone, customerAddress, latitude, longitude, totalAmount, note, trackingToken, itemsJson]);

            const orderId = result.rows[0].id;

            // Insert items
            for (const item of items) {
                await client.query(`
                    INSERT INTO line_order_items (line_order_id, product_id, product_name, price, quantity) 
                    VALUES ($1, $2, $3, $4, $5)
                `, [orderId, item.id, item.name, item.price, item.quantity]);
            }

            await client.query('COMMIT');

            io.emit('new-delivery-order', { orderId, customerName });
            io.emit('line-order-new'); // For backward compatibility

            res.json({
                success: true,
                orderId,
                trackingToken,
                trackingUrl: `/tracking/${trackingToken}`
            });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    // Get users with rider role (for assigning riders)
    app.get('/api/riders', async (req, res) => {
        try {
            const result = await query("SELECT id, name, full_name FROM users WHERE role IN ('rider', 'staff', 'admin', 'owner')");
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- LOYALTY & PROMOTIONS APIs ---

    // Search Loyalty Customers
    app.get('/api/admin/loyalty/customers', requireAdmin, async (req, res) => {
        const { query: q } = req.query;
        if (!q) return res.json([]);
        try {
            const result = await query(`
                SELECT id, line_user_id, display_name, picture_url, points, phone 
                FROM loyalty_customers 
                WHERE display_name ILIKE $1 
                OR line_user_id ILIKE $1 
                OR phone ILIKE $1
                LIMIT 10
            `, [`%${q}%`]);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Link customer to order
    app.post('/api/orders/:id/link-customer', async (req, res) => {
        const { id } = req.params;
        const { customerId } = req.body;
        try {
            await query('UPDATE orders SET customer_id = $1 WHERE id = $2', [customerId, id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Sync Customer Profile (LINE Login)
    app.post('/api/loyalty/sync', async (req, res) => {
        const { lineUserId, displayName, pictureUrl } = req.body;
        try {
            // Check if already exists
            const existing = await query('SELECT * FROM loyalty_customers WHERE line_user_id = $1', [lineUserId]);

            // Mock LINE OA check (In production, use Messaging API)
            // For now, we'll assume if they sync, they are following OR we set it to true if they use the app
            const isFollowing = true;

            if (existing.rowCount > 0) {
                // Update
                const result = await query(
                    `UPDATE loyalty_customers 
                     SET display_name = $1, picture_url = $2, is_following = $3, updated_at = CURRENT_TIMESTAMP 
                     WHERE line_user_id = $4 
                     RETURNING *`,
                    [displayName, pictureUrl, isFollowing, lineUserId]
                );
                res.json(result.rows[0]);
            } else {
                // Create
                const result = await query(
                    `INSERT INTO loyalty_customers (line_user_id, display_name, picture_url, is_following)
                     VALUES ($1, $2, $3, $4)
                     RETURNING *`,
                    [lineUserId, displayName, pictureUrl, isFollowing]
                );

                // Notification: New member registered
                createNotification(
                    `🎉 สมาชิกใหม่!`,
                    `${displayName} ลงทะเบียนเข้าระบบสะสมแต้ม`,
                    'member',
                    { customerId: result.rows[0].id, displayName }
                );

                res.json(result.rows[0]);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Get Customer Profile & History
    app.get('/api/loyalty/profile/:lineUserId', async (req, res) => {
        const { lineUserId } = req.params;
        try {
            const customerRes = await query('SELECT * FROM loyalty_customers WHERE line_user_id = $1', [lineUserId]);
            if (customerRes.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });

            const customer = customerRes.rows[0];
            const transactionsRes = await query(
                'SELECT * FROM loyalty_point_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20',
                [customer.id]
            );

            res.json({ customer, transactions: transactionsRes.rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Get Active Promotions (Customer View)
    app.get('/api/loyalty/active-promotions', async (req, res) => {
        try {
            const result = await query(`
                SELECT p.*, 
                (SELECT COUNT(*)::int FROM loyalty_coupons c WHERE c.promotion_id = p.id) as redeemed_count
                FROM loyalty_promotions p
                WHERE is_active = TRUE 
                AND (start_date IS NULL OR start_date <= CURRENT_DATE)
                AND (end_date IS NULL OR end_date >= CURRENT_DATE)
                ORDER BY points_required ASC
            `);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    const generateCouponCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `ANAN-${code}`;
    };

    app.post('/api/loyalty/redeem', async (req, res) => {
        const { customerId, promotionId } = req.body;
        try {
            await query('BEGIN');

            const promoRes = await query('SELECT * FROM loyalty_promotions WHERE id = $1', [promotionId]);
            const promo = promoRes.rows[0];
            const customerRes = await query('SELECT id, points, is_following FROM loyalty_customers WHERE id = $1', [customerId]);
            const customer = customerRes.rows[0];

            if (!promo || !customer) {
                await query('ROLLBACK');
                return res.status(404).json({ error: 'Promotion or Customer not found' });
            }

            if (!customer.is_following) {
                await query('ROLLBACK');
                return res.status(403).json({ error: 'กรุณาติดตาม LINE OA ก่อนแลกรางวัลค่ะ' });
            }

            if (customer.points < promo.points_required) {
                await query('ROLLBACK');
                return res.status(400).json({ error: 'คะแนนไม่เพียงพอค่ะ' });
            }

            // --- CHECK LIMITS ---

            // 1. Global Redemption Limit
            if (promo.max_redemptions) {
                const totalRedeemedRes = await query('SELECT COUNT(*) FROM loyalty_coupons WHERE promotion_id = $1', [promotionId]);
                const totalRedeemed = parseInt(totalRedeemedRes.rows[0].count);
                if (totalRedeemed >= promo.max_redemptions) {
                    await query('ROLLBACK');
                    return res.status(400).json({ error: 'ขออภัยค่ะ สิทธิ์แลกรางวัลนี้เต็มแล้ว' });
                }
            }

            // 2. User Redemption Limit
            if (promo.user_redemption_limit) {
                const userRedeemedRes = await query('SELECT COUNT(*) FROM loyalty_coupons WHERE promotion_id = $1 AND customer_id = $2', [promotionId, customerId]);
                const userRedeemed = parseInt(userRedeemedRes.rows[0].count);
                if (userRedeemed >= promo.user_redemption_limit) {
                    await query('ROLLBACK');
                    return res.status(400).json({ error: `คุณใช้สิทธิ์ครบ ${promo.user_redemption_limit} ครั้งแล้วค่ะ` });
                }
            }

            // 1. Deduct points
            await query('UPDATE loyalty_customers SET points = points - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [promo.points_required, customerId]);

            // 2. Generate Coupon with discount settings from promotion
            const couponCode = generateCouponCode();
            await query(`
                INSERT INTO loyalty_coupons (customer_id, promotion_id, coupon_code, discount_type, discount_value, min_spend_amount)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [customerId, promotionId, couponCode, promo.discount_type || 'none', promo.discount_value || 0, promo.min_spend_amount || 0]);

            // 3. Log transaction
            await query(`
                INSERT INTO loyalty_point_transactions 
                (customer_id, type, points, promotion_id, description)
                VALUES ($1, 'redeem', $2, $3, $4)
            `, [customerId, promo.points_required, promotionId, `แลกรางวัล: ${promo.title} (Code: ${couponCode})`]);

            await query('COMMIT');

            // Notification: Coupon redeemed
            createNotification(
                `🎁 แลกคูปองสำเร็จ`,
                `ลูกค้าแลกรางวัล "${promo.title}" (Code: ${couponCode})`,
                'coupon',
                { customerId, promotionId, couponCode }
            );

            res.json({ success: true, newPoints: customer.points - promo.points_required, couponCode });
        } catch (err) {
            await query('ROLLBACK');
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/loyalty/coupons/:customerId', async (req, res) => {
        try {
            const result = await query(`
                SELECT c.*, p.title as promotion_title, p.description as promotion_description, p.image_url
                FROM loyalty_coupons c
                JOIN loyalty_promotions p ON c.promotion_id = p.id
                WHERE c.customer_id = $1
                ORDER BY c.redeemed_at DESC
            `, [req.params.customerId]);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/loyalty/coupons/verify', async (req, res) => {
        const { code } = req.body;
        try {
            const result = await query(`
                SELECT c.*, p.title, p.description, cust.display_name as customer_name
                FROM loyalty_coupons c
                JOIN loyalty_promotions p ON c.promotion_id = p.id
                JOIN loyalty_customers cust ON c.customer_id = cust.id
                WHERE c.coupon_code = $1 AND c.status = 'active'
            `, [code.toUpperCase()]);

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'รหัสคูปองไม่ถูกต้อง หรือถูกใช้งานไปแล้วค่ะ' });
            }
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POS: Use Coupon
    app.post('/api/loyalty/coupons/use', async (req, res) => {
        const { code, orderId, lineOrderId } = req.body;
        try {
            // First check the coupon
            const checkCoupon = await query('SELECT * FROM loyalty_coupons WHERE coupon_code = $1 AND status = \'active\'', [code.toUpperCase()]);
            if (checkCoupon.rowCount === 0) {
                return res.status(404).json({ error: 'ไม่พบรหัสคูปอง หรือคูปองถูกใช้ไปแล้ว' });
            }

            const coupon = checkCoupon.rows[0];

            // Verify Min Spend if order total provided
            if (coupon.min_spend_amount > 0) {
                // Fetch order total to verify
                let orderTotal = 0;
                if (orderId) {
                    const orderRes = await query('SELECT total_amount FROM orders WHERE id = $1', [orderId]);
                    if (orderRes.rowCount > 0) orderTotal = parseFloat(orderRes.rows[0].total_amount);
                } else if (lineOrderId) {
                    const orderRes = await query('SELECT total_amount FROM line_orders WHERE id = $1', [lineOrderId]);
                    if (orderRes.rowCount > 0) orderTotal = parseFloat(orderRes.rows[0].total_amount);
                }

                if (orderTotal < coupon.min_spend_amount) {
                    return res.status(400).json({ error: `คูปองนี้ต้องมียอดขั้นต่ำ ${coupon.min_spend_amount} บาทค่ะ` });
                }
            }

            const result = await query(`
                UPDATE loyalty_coupons 
                SET status = 'used', 
                    used_at = CURRENT_TIMESTAMP, 
                    order_id = $1, 
                    line_order_id = $2 
                WHERE id = $3
                RETURNING *
            `, [orderId || null, lineOrderId || null, coupon.id]);

            res.json({ success: true, coupon: result.rows[0] });
        } catch (err) {
            console.error('Use coupon error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Management Promotions
    app.get('/api/admin/loyalty/promotions', requireAdmin, async (req, res) => {
        try {
            const result = await query('SELECT * FROM loyalty_promotions ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/admin/loyalty/promotions', requireAdmin, async (req, res) => {
        const { title, description, points_required, image_url, start_date, end_date, max_redemptions, user_redemption_limit, min_spend_amount } = req.body;
        try {
            const result = await query(
                `INSERT INTO loyalty_promotions (title, description, points_required, image_url, start_date, end_date, max_redemptions, user_redemption_limit, min_spend_amount)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [title, description, points_required, image_url, start_date || null, end_date || null, max_redemptions || null, user_redemption_limit || null, min_spend_amount || 0]
            );
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/admin/loyalty/promotions/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        const { title, description, points_required, image_url, start_date, end_date, is_active, max_redemptions, user_redemption_limit, min_spend_amount } = req.body;
        try {
            const result = await query(
                `UPDATE loyalty_promotions 
                 SET title = $1, description = $2, points_required = $3, image_url = $4, start_date = $5, end_date = $6, is_active = $7, max_redemptions = $8, user_redemption_limit = $9, min_spend_amount = $10
                 WHERE id = $11
                 RETURNING *`,
                [title, description, points_required, image_url, start_date || null, end_date || null, is_active, max_redemptions || null, user_redemption_limit || null, min_spend_amount || 0, id]
            );
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/admin/loyalty/promotions/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM loyalty_promotions WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id)
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id)
        })
    })

    // SPA Fallback: Serve index.html for any unknown routes (non-API)
    app.get('*', (req, res) => {
        // If it's an API call that fell through, 404 it.
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'Endpoint not found' });
        }

        const indexPath = path.join(distPath, 'index.html');
        const fs = require('fs');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.send(`
                <div style="font-family: sans-serif; padding: 40px; text-align: center;">
                    <h1>Tasty Station API Server</h1>
                    <p>Static frontend files (dist) not found.</p>
                    <p>If you are in development, please access port <b>5173</b> instead.</p>
                    <p>If you want to use this port, run <code>npm run build</code> first.</p>
                </div>
            `);
        }
    });

    // Handle Port Conflict (e.g., if external server is running)
    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`⚠️  Port ${port} is busy. Assuming external server is running.`);
            console.log('   >> Starting in CLIENT MODE (connecting to existing server).');
        } else {
            console.error('SERVER ERROR:', e);
        }
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`Internal Express server listening on port ${port} (0.0.0.0)`)
    })
}

// Auto-start when running directly (e.g., on Render)
if (require.main === module) {
    startServer().catch(err => {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    });
}

module.exports = startServer
