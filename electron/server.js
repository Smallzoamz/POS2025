const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')
const os = require('os')
// const localtunnel = require('localtunnel')

// const { db, initDatabase } = require('./db') // Legacy SQLite
const { pool, query, initDatabasePG } = require('./db_pg')

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

    // Log all requests for debugging
    app.use((req, res, next) => {
        console.log(`[REQ] ${req.method} ${req.url}`);
        next();
    });

    app.use(cors())
    app.use(express.json())

    let tunnel = null;
    let cloudUrl = null;
    let isLaunchingCloud = false;

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

            // 1. Update customer points
            await query("UPDATE loyalty_customers SET points = points + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [pointsToEarn, customerId]);

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

    // DEBUG: Get schema info for troubleshooting
    app.get('/api/debug/schema/:table', async (req, res) => {
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

    // Get All Products (Menu)
    app.get('/api/products', async (req, res) => {
        try {
            const productsRes = await query('SELECT * FROM products');
            const categoriesRes = await query('SELECT * FROM categories ORDER BY sort_order');
            res.json({ products: productsRes.rows, categories: categoriesRes.rows });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add Product
    app.post('/api/products', async (req, res) => {
        const { name, price, category_id, image, track_stock, stock_quantity } = req.body;
        try {
            const result = await query(
                'INSERT INTO products (name, price, category_id, image, is_available, track_stock, stock_quantity) VALUES ($1, $2, $3, $4, TRUE, $5, $6) RETURNING id',
                [name, price, category_id, image, track_stock || false, stock_quantity || 0]
            );
            res.json({ success: true, id: result.rows[0].id });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Update Product
    app.put('/api/products/:id', async (req, res) => {
        const { name, price, category_id, image, is_available, track_stock, stock_quantity } = req.body;
        const { id } = req.params;
        try {
            await query(
                'UPDATE products SET name = $1, price = $2, category_id = $3, image = $4, is_available = $5, track_stock = $6, stock_quantity = $7 WHERE id = $8',
                [name, price, category_id, image, is_available, track_stock || false, stock_quantity || 0, id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Product
    app.delete('/api/products/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM products WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add Category
    app.post('/api/categories', async (req, res) => {
        const { id, name, icon, sort_order } = req.body;
        try {
            await query('INSERT INTO categories (id, name, icon, sort_order) VALUES ($1, $2, $3, $4)', [id, name, icon, sort_order || 0]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Category
    app.delete('/api/categories/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await query('DELETE FROM categories WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Create New Order (or Append to Existing)
    app.post('/api/orders', async (req, res) => {
        const { tableName, items, total, orderType } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

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

            // 1.5 CHECK STOCK and DECREMENT (INGREDIENTS)
            const ingredientsNeeded = new Map(); // ingredient_id -> total_needed

            for (const item of items) {
                const recipeRes = await client.query(
                    "SELECT ingredient_id, quantity_used FROM product_ingredients WHERE product_id = $1",
                    [item.id]
                );
                const recipe = recipeRes.rows;

                if (recipe.length > 0) {
                    const orderQty = item.quantity || 1;
                    for (const r of recipe) {
                        const totalForThisItem = parseFloat(r.quantity_used) * orderQty;
                        const current = ingredientsNeeded.get(r.ingredient_id) || 0;
                        ingredientsNeeded.set(r.ingredient_id, current + totalForThisItem);
                    }
                }
            }

            // Verify stock availability
            for (const [ingId, needed] of ingredientsNeeded.entries()) {
                const ingRes = await client.query("SELECT name, total_quantity, unit FROM ingredients WHERE id = $1", [ingId]);
                const ing = ingRes.rows[0];

                if (!ing) throw new Error(`Ingredient ID ${ingId} not found`);

                if (parseFloat(ing.total_quantity) < needed) {
                    throw new Error(`วัตถุดิบ '${ing.name}' ไม่พอ (ขาด ${needed - parseFloat(ing.total_quantity)} ${ing.unit || 'units'})`);
                }
            }

            // Deduct stock
            for (const [ingId, needed] of ingredientsNeeded.entries()) {
                await client.query("UPDATE ingredients SET total_quantity = total_quantity - $1 WHERE id = $2", [needed, ingId]);
            }

            // 2. Insert Items
            for (const item of items) {
                await client.query(
                    'INSERT INTO order_items (order_id, product_id, product_name, price, quantity, status) VALUES ($1, $2, $3, $4, $5, $6)',
                    [orderId, item.id, item.name, item.price, item.quantity || 1, 'cooking']
                );
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
                    items: itemsRes.rows
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
        const { paymentMethod } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Mark order as paid
            await client.query(
                "UPDATE orders SET status = 'paid', payment_method = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                [paymentMethod || 'cash', id]
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
    app.get('/api/orders/history', async (req, res) => {
        const { startDate, endDate } = req.query;
        console.log(`[History API] Fetching history for range: ${startDate} to ${endDate}`);
        try {
            // Base SQL for In-store
            let sql = `SELECT * FROM orders WHERE status = 'paid'`;
            const params = [];

            if (startDate && endDate) {
                sql += " AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date >= $1::date AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date <= $2::date";
                params.push(startDate, endDate);
            }

            sql += " ORDER BY updated_at DESC";

            if (!startDate) {
                sql += " LIMIT 50";
            }

            const ordersRes = await query(sql, params);
            console.log(`[History API] Fetched ${ordersRes.rows.length} in-store orders`);

            // Base SQL for LINE orders
            let lineSql = `SELECT id, customer_name as table_name, status, total_amount, updated_at, order_type, payment_method FROM line_orders WHERE status = 'completed'`;
            const lineParams = [];
            if (startDate && endDate) {
                lineSql += " AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date >= $1::date AND (updated_at AT TIME ZONE 'Asia/Bangkok')::date <= $2::date";
                lineParams.push(startDate, endDate);
            }
            lineSql += " ORDER BY updated_at DESC";
            if (!startDate) lineSql += " LIMIT 50";

            const lineOrdersRes = await query(lineSql, lineParams);
            console.log(`[History API] Found ${lineOrdersRes.rows.length} LINE orders`);

            // Combine and sort
            const combined = [
                ...ordersRes.rows.map(o => ({ ...o, source: 'instore' })),
                ...lineOrdersRes.rows.map(o => ({ ...o, source: 'line' }))
            ].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

            console.log(`[History API] Total combined records: ${combined.length}`);
            res.json(combined);
        } catch (err) {
            console.error('[History API Error]', err);
            res.status(500).json({ error: err.message });
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
                fullOrders.push({ ...order, items: itemsRes.rows });
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
                const itemsRes = await query("SELECT * FROM line_order_items WHERE line_order_id = $1", [order.id]);
                order.items = itemsRes.rows;
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
    app.post('/api/tables', (req, res) => {
        const { name, zone, seats } = req.body;
        try {
            const result = db.prepare("INSERT INTO tables (name, zone, seats, status) VALUES (?, ?, ?, 'available')")
                .run(name, zone, seats || 4);

            io.emit('table-update', { id: null, status: 'refresh' });
            res.json({ success: true, id: result.lastInsertRowid });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Delete Table
    app.delete('/api/tables/:id', (req, res) => {
        const { id } = req.params;
        try {
            db.prepare("DELETE FROM tables WHERE id = ?").run(id);
            io.emit('table-update', { id: null, status: 'refresh' });
            res.json({ success: true });
        } catch (err) {
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

    // PUBLIC: Get Menu for LINE Order Page
    app.get('/api/public/menu', async (req, res) => {
        try {
            const categoriesRes = await query("SELECT * FROM categories ORDER BY id");
            const productsRes = await query("SELECT * FROM products ORDER BY category_id, name");
            res.json({
                categories: categoriesRes.rows,
                products: productsRes.rows
            });
        } catch (err) {
            console.error('Public menu error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- LINE Messaging API Helper ---
    const sendLineFlexMessage = async (to, orderData) => {
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!token || !to) {
            console.log('⚠️ Skipping LINE Message: No token or lineUserId' + (!token ? ' (LINE_CHANNEL_ACCESS_TOKEN missing in .env)' : ''));
            return;
        }

        const { order_type, id, customer_name, customer_phone, total_amount, items_json } = orderData;
        const trackingUrl = `https://pos-backend-8cud.onrender.com/tracking/${orderData.tracking_token}`;

        // Fetch Shop Name
        const shopNameRes = await query("SELECT value FROM settings WHERE key = 'shop_name'");
        const shopName = shopNameRes.rows[0]?.value || 'Tasty Station';

        let items = [];
        try { items = JSON.parse(items_json || '[]'); } catch (e) { items = []; }

        // Build Item List String
        const itemsList = items.map(item => `- ${item.name} x${item.quantity}`).join('\n');

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

        // Add Items and Total
        bubbleContent.body.contents.push({
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "contents": [
                { "type": "text", "text": "📦 รายการอาหาร", "weight": "bold", "size": "sm" },
                { "type": "text", "text": itemsList || 'ไม่ได้ระบุรายการ', "size": "xs", "color": "#888888", "wrap": true, "margin": "xs" },
                { "type": "separator", "margin": "md" },
                {
                    "type": "box",
                    "layout": "horizontal",
                    "margin": "md",
                    "contents": [
                        { "type": "text", "text": "ยอดรวมทั้งสิ้น", "weight": "bold", "size": "md" },
                        { "type": "text", "text": `฿${total_amount}`, "weight": "bold", "size": "md", "align": "end", "color": "#D32F2F" }
                    ]
                }
            ]
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
        try {
            const {
                orderType, customerName, customerPhone, customerAddress,
                latitude, longitude, reservationDate, reservationTime,
                guestsCount, assignedTable, items, totalAmount, note,
                lineUserId // Capture from LIFF
            } = req.body;

            // Validate minimum order for delivery
            if (orderType === 'delivery') {
                const settingsRes = await query("SELECT value FROM settings WHERE key = 'minimum_delivery_order'");
                const minOrder = parseFloat(settingsRes.rows[0]?.value) || 100;
                if (totalAmount < minOrder) {
                    return res.status(400).json({ error: `ยอดสั่งซื้อขั้นต่ำสำหรับ Delivery คือ ฿${minOrder}` });
                }
            }

            // Lookup customer_id automatically if lineUserId provided
            let customerId = null;
            if (lineUserId) {
                const customerLookup = await query("SELECT id FROM loyalty_customers WHERE line_user_id = $1", [lineUserId]);
                if (customerLookup.rowCount > 0) {
                    customerId = customerLookup.rows[0].id;
                }
            }

            // Calculate Deposit (50% for reservations with items)
            let depositAmount = 0;
            if (orderType === 'reservation' && items && items.length > 0) {
                depositAmount = totalAmount * 0.5;
            }

            // 1. Associate Phone with LINE Account (Loyalty)
            if (lineUserId && customerPhone) {
                try {
                    // Update phone if it's null or empty
                    await query(`
                        UPDATE loyalty_customers 
                        SET phone = $1, updated_at = CURRENT_TIMESTAMP 
                        WHERE line_user_id = $2 AND (phone IS NULL OR phone = '')
                    `, [customerPhone, lineUserId]);
                } catch (phoneErr) {
                    console.error('Error associating phone with LINE user:', phoneErr);
                }
            }

            // 2. Coupon Processing
            let couponDiscount = 0;
            let finalTotal = totalAmount;
            const { couponCode } = req.body;

            if (couponCode && customerId) {
                try {
                    // Verify coupon is active and belongs to this customer
                    const couponCheck = await query(`
                        SELECT c.*, p.title, p.description
                        FROM loyalty_coupons c
                        JOIN loyalty_promotions p ON c.promotion_id = p.id
                        WHERE c.coupon_code = $1 AND c.customer_id = $2 AND c.status = 'active'
                    `, [couponCode.toUpperCase(), customerId]);

                    if (couponCheck.rowCount > 0) {
                        const coupon = couponCheck.rows[0];
                        // Apply discount logic here (for now we assume fixed value or percentage based on promo title/desc)
                        // In a real system, you'd have a 'discount_value' column. 
                        // Let's check for "ลด X บาท" in title
                        const match = coupon.title.match(/ลด\s*(\d+)/);
                        if (match) {
                            couponDiscount = parseInt(match[1]);
                        } else if (coupon.title.includes('%')) {
                            const pctMatch = coupon.title.match(/(\d+)%/);
                            if (pctMatch) {
                                couponDiscount = Math.floor(totalAmount * (parseInt(pctMatch[1]) / 100));
                            }
                        }

                        if (couponDiscount > 0) {
                            finalTotal = Math.max(0, totalAmount - couponDiscount);
                            console.log(`🎟️ Applied Coupon: ${couponCode} (-฿${couponDiscount})`);
                        }

                        // Mark coupon as used (will be updated further after order is inserted)
                    }
                } catch (couponErr) {
                    console.error('Coupon verification error:', couponErr);
                }
            }

            // Generate tracking token for delivery (Case-insensitive check)
            const trackingToken = (orderType && orderType.toLowerCase() === 'delivery')
                ? 'TRK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase()
                : null;

            // Convert items to JSON string for items_json column
            const itemsJson = JSON.stringify(items || []);

            // Insert order with correct column names from actual schema
            const orderRes = await query(`
                INSERT INTO line_orders 
                (order_type, customer_name, customer_phone, customer_address, 
                 total_amount, status, note, tracking_token, items_json,
                 latitude, longitude, reservation_date, reservation_time, guests_count,
                 deposit_amount, is_deposit_paid, assigned_table, line_user_id, customer_id)
                VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING id
            `, [
                orderType || 'delivery',
                customerName || '',
                customerPhone || '',
                customerAddress || '',
                finalTotal, // Use calculated total
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
                customerId // $18
            ]);

            const orderId = orderRes.rows[0].id;

            // 3. Mark coupon as used and link to order
            if (couponCode && couponDiscount > 0) {
                await query(`
                    UPDATE loyalty_coupons 
                    SET status = 'used', used_at = CURRENT_TIMESTAMP, line_order_id = $1 
                    WHERE coupon_code = $2 AND customer_id = $3
                `, [orderId, couponCode.toUpperCase(), customerId]);
            }

            // Trigger LINE Notification (Async)
            if (lineUserId) {
                console.log(`🔔 Triggering LINE message for User: ${lineUserId}`);
                query("SELECT * FROM line_orders WHERE id = $1", [orderId]).then(fullOrderRes => {
                    if (fullOrderRes.rows[0]) {
                        sendLineFlexMessage(lineUserId, fullOrderRes.rows[0]);
                    } else {
                        console.error('❌ Could not find order for notification:', orderId);
                    }
                }).catch(err => console.error('Error fetching order for LINE notification:', err));
            } else {
                console.log('⚠️ No lineUserId found, skipping LINE notification');
            }

            // Also insert to line_order_items for backwards compatibility
            if (items && items.length > 0) {
                for (const item of items) {
                    try {
                        await query(`
                            INSERT INTO line_order_items (line_order_id, product_id, product_name, quantity, price)
                            VALUES ($1, $2, $3, $4, $5)
                        `, [orderId, item.id, item.name, item.quantity, item.price]);
                    } catch (itemErr) {
                        console.log('Item insert note:', itemErr.message);
                    }
                }
            }

            // Emit socket event
            // Excludes reservations without items from the kitchen display.
            if (orderType !== 'reservation' || (items && items.length > 0)) {
                io.emit('new-line-order', { orderId, orderType, customerName, totalAmount, depositAmount });

                // Create persistent notification for LINE orders
                createNotification(
                    `ออเดอร์ LINE ใหม่ - ${customerName}`,
                    `ประเภท: ${orderType === 'delivery' ? '🚚 ส่งถึงบ้าน' : (orderType === 'takeaway' ? '🛍️ รับเองที่ร้าน' : '📅 จองโต๊ะ')} (ยอด: ${totalAmount}.-)`,
                    'order',
                    { orderId, orderType, customerName }
                );
            }

            res.json({ success: true, orderId, trackingToken, depositAmount });
        } catch (err) {
            console.error('Public line-orders error:', err);
            res.status(500).json({ error: err.message });
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
        try {
            const {
                customer_name, customer_phone, items, total_amount
            } = req.body;

            // Insert into main orders table as 'takeaway'
            const orderRes = await query(`
                INSERT INTO orders 
                (order_type, status, total_amount, subtotal, grand_total, customer_name, customer_phone)
                VALUES ($1, 'cooking', $2, $2, $2, $3, $4)
                RETURNING id
            `, ['takeaway', total_amount, customer_name, customer_phone]);

            const orderId = orderRes.rows[0].id;

            // Insert items
            if (items && items.length > 0) {
                for (const item of items) {
                    await query(`
                        INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [orderId, item.product_id, item.product_name, item.price, item.quantity]);
                }
            }

            // Emit socket event for kitchen
            io.emit('new-order', { orderId, orderType: 'takeaway', customerName: customer_name });

            // Create persistent notification
            createNotification(
                `ออเดอร์ Takeaway ใหม่!`,
                `ลูกค้าคุณ ${customer_name} สั่งอาหารกลับบ้าน (ยอด: ${total_amount}.-)`,
                'takeaway',
                { orderId, customerName: customer_name }
            );

            res.json({ success: true, orderId });
        } catch (err) {
            console.error('Public takeaway-order error:', err);
            res.status(500).json({ error: err.message });
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
                const items = await query("SELECT * FROM order_items WHERE order_id = $1", [order.id]);
                return { ...order, items: items.rows };
            }));
            res.json(ordersWithItems);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // Complete/Pickup Order
    app.post('/api/orders/:id/complete', async (req, res) => {
        const { id } = req.params;
        const { paymentMethod } = req.body;
        try {
            await query(
                "UPDATE orders SET status = 'completed', payment_method = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
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
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Pay LINE Order
    app.post('/api/line-orders/:id/pay', async (req, res) => {
        const { id } = req.params;
        const { paymentMethod } = req.body;
        try {
            await query(
                "UPDATE line_orders SET status = 'completed', payment_method = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                [paymentMethod || 'cash', id]
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

            const result = await client.query(`
                INSERT INTO line_orders (
                    order_type, customer_name, customer_phone, delivery_address,
                    customer_lat, customer_lng, total_amount, status, note, tracking_token
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9) 
                RETURNING id
            `, ['delivery', customerName, customerPhone, customerAddress, latitude, longitude, totalAmount, note, trackingToken]);

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
    app.get('/api/admin/loyalty/customers', async (req, res) => {
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
                SELECT * FROM loyalty_promotions 
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

            // 1. Deduct points
            await query('UPDATE loyalty_customers SET points = points - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [promo.points_required, customerId]);

            // 2. Generate Coupon
            const couponCode = generateCouponCode();
            await query(`
                INSERT INTO loyalty_coupons (customer_id, promotion_id, coupon_code)
                VALUES ($1, $2, $3)
            `, [customerId, promotionId, couponCode]);

            // 3. Log transaction
            await query(`
                INSERT INTO loyalty_point_transactions 
                (customer_id, type, points, promotion_id, description)
                VALUES ($1, 'redeem', $2, $3, $4)
            `, [customerId, promo.points_required, promotionId, `แลกรางวัล: ${promo.title} (Code: ${couponCode})`]);

            await query('COMMIT');
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
            const result = await query(`
                UPDATE loyalty_coupons 
                SET status = 'used', 
                    used_at = CURRENT_TIMESTAMP, 
                    order_id = $1, 
                    line_order_id = $2 
                WHERE coupon_code = $3 AND status = 'active'
                RETURNING *
            `, [orderId || null, lineOrderId || null, code.toUpperCase()]);

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'ไม่พบรหัสคูปอง หรือคูปองถูกใช้ไปแล้ว' });
            }

            res.json({ success: true, coupon: result.rows[0] });
        } catch (err) {
            console.error('Use coupon error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ADMIN: Management Promotions
    app.get('/api/admin/loyalty/promotions', async (req, res) => {
        try {
            const result = await query('SELECT * FROM loyalty_promotions ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/admin/loyalty/promotions', async (req, res) => {
        const { title, description, pointsRequired, imageUrl, startDate, endDate } = req.body;
        // Convert empty strings to null for DATE columns
        const finalStartDate = startDate === '' ? null : startDate;
        const finalEndDate = endDate === '' ? null : endDate;

        try {
            const result = await query(`
                INSERT INTO loyalty_promotions (title, description, points_required, image_url, start_date, end_date)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [title, description, pointsRequired, imageUrl, finalStartDate, finalEndDate]);
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/admin/loyalty/promotions/:id', async (req, res) => {
        const { id } = req.params;
        const { title, description, pointsRequired, imageUrl, startDate, endDate, isActive } = req.body;
        // Convert empty strings to null for DATE columns
        const finalStartDate = startDate === '' ? null : startDate;
        const finalEndDate = endDate === '' ? null : endDate;

        try {
            await query(`
                UPDATE loyalty_promotions 
                SET title = $1, description = $2, points_required = $3, image_url = $4, 
                    start_date = $5, end_date = $6, is_active = $7
                WHERE id = $8
            `, [title, description, pointsRequired, imageUrl, finalStartDate, finalEndDate, isActive, id]);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/admin/loyalty/promotions/:id', async (req, res) => {
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
