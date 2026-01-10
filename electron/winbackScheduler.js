/**
 * Win-Back Scheduler Module
 * ระบบตามลูกค้าเก่าที่ Inactive อัตโนมัติ ผ่าน LINE Message + Win-Back Coupon
 * 
 * Configuration (from settings table):
 * - winback_inactive_days: Number of days to consider customer inactive (default: 45)
 * - winback_discount_percent: Discount percentage for win-back coupon (default: 10)
 * - winback_cooldown_days: Minimum days between win-back messages (default: 90)
 * - winback_coupon_valid_days: Days until coupon expires (default: 30)
 */

const cron = require('node-cron');

let pool = null;
let io = null;

// Generate unique coupon code
const generateCouponCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'WBCK-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// LINE Messaging API Helper for Win-Back
const sendWinbackMessage = async (customer, coupon, settings, shopName) => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token || !customer.line_user_id) {
        console.log('[WinBack] ⚠️ Skipping LINE Message: No token or lineUserId');
        return false;
    }

    // Calculate expiry date
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(settings.winback_coupon_valid_days || 30));
    const expiryDateStr = expiryDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

    const customerName = customer.nickname || customer.display_name || 'ลูกค้าคนพิเศษ';
    const discountPercent = settings.winback_discount_percent || 10;

    // Calculate days since last order
    const lastOrderDate = new Date(customer.last_order_at);
    const daysSinceOrder = Math.floor((new Date() - lastOrderDate) / (1000 * 60 * 60 * 24));

    // Win-Back Flex Message
    const winbackBubble = {
        "type": "bubble",
        "styles": {
            "header": { "backgroundColor": "#FFF8E1" },
            "body": { "backgroundColor": "#FFFDE7" }
        },
        "header": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                { "type": "text", "text": "🥺💕", "size": "3xl", "align": "center" },
                { "type": "text", "text": "คิดถึงจังค่ะ!", "weight": "bold", "size": "xl", "color": "#FF6F00", "align": "center", "margin": "md" }
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                { "type": "text", "text": `คุณ ${customerName}`, "weight": "bold", "size": "lg", "align": "center" },
                { "type": "text", "text": `ไม่ได้แวะมาเยี่ยมเราเลย ${daysSinceOrder} วันแล้วค่ะ`, "size": "sm", "color": "#555555", "wrap": true, "align": "center", "margin": "md" },
                { "type": "text", "text": `${shopName} อยากพบคุณอีกครั้งจัง!`, "size": "sm", "color": "#555555", "wrap": true, "align": "center", "margin": "sm" },
                { "type": "separator", "margin": "xl" },
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "xl",
                    "backgroundColor": "#FF6F0015",
                    "cornerRadius": "lg",
                    "paddingAll": "lg",
                    "contents": [
                        { "type": "text", "text": "🎁 ของขวัญต้อนรับกลับมา", "weight": "bold", "size": "md", "align": "center" },
                        { "type": "text", "text": `ส่วนลด ${discountPercent}%`, "weight": "bold", "size": "xxl", "color": "#FF6F00", "align": "center", "margin": "md" },
                        { "type": "text", "text": "สำหรับออเดอร์ถัดไป", "size": "sm", "color": "#555555", "align": "center" }
                    ]
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "xl",
                    "contents": [
                        { "type": "text", "text": "รหัสคูปอง", "size": "xs", "color": "#888888", "align": "center" },
                        { "type": "text", "text": coupon.coupon_code, "weight": "bold", "size": "lg", "color": "#FF6F00", "align": "center", "margin": "sm" },
                        { "type": "text", "text": `ใช้ได้ถึง: ${expiryDateStr}`, "size": "xs", "color": "#888888", "align": "center", "margin": "md" }
                    ]
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                { "type": "text", "text": "แสดงรหัสนี้ที่ร้านเพื่อรับส่วนลดค่ะ 🧡", "size": "xs", "color": "#888888", "align": "center", "wrap": true }
            ]
        }
    };

    try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                to: customer.line_user_id,
                messages: [{
                    type: 'flex',
                    altText: `🥺 คิดถึงจัง! รับส่วนลด ${discountPercent}% จาก ${shopName}`,
                    contents: winbackBubble
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[WinBack] LINE API Error:', errorText);
            return false;
        }

        console.log(`[WinBack] ✅ Sent win-back message to ${customerName} (${customer.line_user_id})`);
        return true;
    } catch (err) {
        console.error('[WinBack] Error sending LINE message:', err);
        return false;
    }
};

// Check for inactive customers and send win-back messages
const checkInactiveCustomers = async () => {
    if (!pool) {
        console.error('[WinBack] Pool not initialized');
        return { sent: 0, errors: [] };
    }

    const client = await pool.connect();
    const results = { sent: 0, errors: [] };

    try {
        console.log('[WinBack] 🔍 Checking for inactive customers...');

        // Get settings
        const settingsRes = await client.query(`
            SELECT key, value FROM settings 
            WHERE key IN ('winback_inactive_days', 'winback_discount_percent', 'winback_cooldown_days', 'winback_coupon_valid_days', 'shop_name')
        `);
        const settings = {};
        for (const row of settingsRes.rows) {
            settings[row.key] = row.value;
        }

        const inactiveDays = parseInt(settings.winback_inactive_days) || 45;
        const cooldownDays = parseInt(settings.winback_cooldown_days) || 90;
        const discountPercent = parseInt(settings.winback_discount_percent) || 10;
        const shopName = settings.shop_name || 'Tasty Station';

        console.log(`[WinBack] Settings: inactive=${inactiveDays}d, cooldown=${cooldownDays}d, discount=${discountPercent}%`);

        // Find customers who:
        // 1. Have made at least one order (last_order_at is not null)
        // 2. Haven't ordered in X days
        // 3. Haven't received a win-back message recently (or never)
        // 4. Are following the LINE OA
        const customersRes = await client.query(`
            SELECT id, line_user_id, display_name, nickname, last_order_at
            FROM loyalty_customers
            WHERE last_order_at IS NOT NULL
            AND last_order_at < NOW() - INTERVAL '${inactiveDays} days'
            AND (winback_sent_at IS NULL OR winback_sent_at < NOW() - INTERVAL '${cooldownDays} days')
            AND is_following = TRUE
            AND line_user_id IS NOT NULL
        `);

        console.log(`[WinBack] Found ${customersRes.rows.length} inactive customers`);

        for (const customer of customersRes.rows) {
            try {
                await client.query('BEGIN');

                // 1. Generate unique coupon code
                let couponCode = generateCouponCode();
                let attempts = 0;
                while (attempts < 10) {
                    const exists = await client.query('SELECT id FROM loyalty_coupons WHERE coupon_code = $1', [couponCode]);
                    if (exists.rows.length === 0) break;
                    couponCode = generateCouponCode();
                    attempts++;
                }

                // 2. Create win-back coupon
                const couponRes = await client.query(`
                    INSERT INTO loyalty_coupons 
                    (customer_id, coupon_code, status, coupon_type, discount_type, discount_value, min_order_amount, redeemed_at)
                    VALUES ($1, $2, 'active', 'winback', 'percent', $3, 0, CURRENT_TIMESTAMP)
                    RETURNING *
                `, [customer.id, couponCode, discountPercent]);

                const coupon = couponRes.rows[0];

                // 3. Send LINE message
                const messageSent = await sendWinbackMessage(customer, coupon, settings, shopName);

                // 4. Update winback_sent_at
                await client.query(`
                    UPDATE loyalty_customers 
                    SET winback_sent_at = CURRENT_TIMESTAMP 
                    WHERE id = $1
                `, [customer.id]);

                await client.query('COMMIT');

                if (messageSent) {
                    results.sent++;
                    console.log(`[WinBack] 🎣 Sent win-back to customer #${customer.id} (${customer.nickname || customer.display_name})`);
                }

            } catch (customerErr) {
                await client.query('ROLLBACK');
                console.error(`[WinBack] Error processing customer #${customer.id}:`, customerErr.message);
                results.errors.push({ customerId: customer.id, error: customerErr.message });
            }
        }

        // Emit to admin dashboard
        if (io && results.sent > 0) {
            io.emit('winback-sent', { count: results.sent, date: new Date().toISOString() });
        }

        console.log(`[WinBack] ✅ Completed: ${results.sent} messages sent, ${results.errors.length} errors`);
        return results;

    } catch (err) {
        console.error('[WinBack] Fatal error in checkInactiveCustomers:', err);
        results.errors.push({ error: err.message });
        return results;
    } finally {
        client.release();
    }
};

// Initialize scheduler
const initWinbackScheduler = (dbPool, socketIo) => {
    pool = dbPool;
    io = socketIo;

    // Schedule: Run every day at 10:00 AM Bangkok time (1 hour after birthday check)
    cron.schedule('0 10 * * *', async () => {
        console.log('[WinBack] ⏰ Running scheduled inactive customer check...');
        await checkInactiveCustomers();
    }, {
        timezone: 'Asia/Bangkok'
    });

    console.log('[WinBack] 🎣 Win-Back Scheduler initialized - Running daily at 10:00 AM');
};

// Manual trigger for admin testing
const checkWinbackManually = async () => {
    console.log('[WinBack] 🔧 Manual win-back check triggered...');
    return await checkInactiveCustomers();
};

module.exports = {
    initWinbackScheduler,
    checkWinbackManually
};
