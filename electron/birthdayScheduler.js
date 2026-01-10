/**
 * Birthday Scheduler Module
 * ระบบส่งของขวัญวันเกิดอัตโนมัติ ผ่าน LINE Message + Birthday Coupon
 * 
 * Configuration:
 * - Discount: 15%
 * - Valid: Throughout birth month (1 use per year)
 * - Minimum Order: None
 */

const cron = require('node-cron');
const crypto = require('crypto');

let pool = null;
let io = null;

// LINE Messaging API Helper
const sendBirthdayMessage = async (customer, coupon, shopName) => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token || !customer.line_user_id) {
        console.log('[Birthday] ⚠️ Skipping LINE Message: No token or lineUserId');
        return false;
    }

    // Calculate expiry date (end of birth month)
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const expiryDate = endOfMonth.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

    const customerName = customer.nickname || customer.display_name || 'ลูกค้าคนพิเศษ';

    // Birthday Flex Message
    const birthdayBubble = {
        "type": "bubble",
        "styles": {
            "header": { "backgroundColor": "#FFF0F5" },
            "body": { "backgroundColor": "#FFFAFA" }
        },
        "header": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                { "type": "text", "text": "🎂🎉", "size": "3xl", "align": "center" },
                { "type": "text", "text": "สุขสันต์วันเกิด!", "weight": "bold", "size": "xl", "color": "#E91E63", "align": "center", "margin": "md" }
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                { "type": "text", "text": `คุณ ${customerName}`, "weight": "bold", "size": "lg", "align": "center" },
                { "type": "text", "text": `${shopName} ขอส่งความสุขและของขวัญพิเศษให้คุณค่ะ!`, "size": "sm", "color": "#555555", "wrap": true, "align": "center", "margin": "md" },
                { "type": "separator", "margin": "xl" },
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "xl",
                    "backgroundColor": "#E91E6315",
                    "cornerRadius": "lg",
                    "paddingAll": "lg",
                    "contents": [
                        { "type": "text", "text": "🎁 ของขวัญวันเกิด", "weight": "bold", "size": "md", "align": "center" },
                        { "type": "text", "text": "ส่วนลด 15%", "weight": "bold", "size": "xxl", "color": "#E91E63", "align": "center", "margin": "md" },
                        { "type": "text", "text": "สำหรับทุกเมนู", "size": "sm", "color": "#555555", "align": "center" }
                    ]
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "xl",
                    "contents": [
                        { "type": "text", "text": "รหัสคูปอง", "size": "xs", "color": "#888888", "align": "center" },
                        { "type": "text", "text": coupon.coupon_code, "weight": "bold", "size": "lg", "color": "#E91E63", "align": "center", "margin": "sm" },
                        { "type": "text", "text": `ใช้ได้ถึง: ${expiryDate}`, "size": "xs", "color": "#888888", "align": "center", "margin": "md" }
                    ]
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                { "type": "text", "text": "แสดงรหัสนี้ที่ร้านเพื่อรับส่วนลดค่ะ 💕", "size": "xs", "color": "#888888", "align": "center", "wrap": true }
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
                    altText: `🎂 สุขสันต์วันเกิด! รับส่วนลด 15% จาก ${shopName}`,
                    contents: birthdayBubble
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Birthday] LINE API Error:', errorText);
            return false;
        }

        console.log(`[Birthday] ✅ Sent birthday message to ${customerName} (${customer.line_user_id})`);
        return true;
    } catch (err) {
        console.error('[Birthday] Error sending LINE message:', err);
        return false;
    }
};

// Generate unique coupon code
const generateCouponCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0,O,1,I
    let code = 'BDAY-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Check for birthdays and send rewards
const checkBirthdays = async () => {
    if (!pool) {
        console.error('[Birthday] Pool not initialized');
        return { sent: 0, errors: [] };
    }

    const client = await pool.connect();
    const results = { sent: 0, errors: [] };

    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1; // 1-12

        console.log(`[Birthday] 🔍 Checking for birthdays in month ${currentMonth}...`);

        // Find customers with birthdays this month who haven't received reward this year
        const customersRes = await client.query(`
            SELECT id, line_user_id, display_name, nickname, birthdate
            FROM loyalty_customers
            WHERE EXTRACT(MONTH FROM birthdate) = $1
            AND (birthday_reward_sent_year IS NULL OR birthday_reward_sent_year != $2)
            AND is_following = TRUE
            AND line_user_id IS NOT NULL
        `, [currentMonth, currentYear]);

        console.log(`[Birthday] Found ${customersRes.rows.length} customers with birthdays this month`);

        // Get shop name for messages
        const shopNameRes = await client.query("SELECT value FROM settings WHERE key = 'shop_name'");
        const shopName = shopNameRes.rows[0]?.value || 'Tasty Station';

        // Calculate end of current month for coupon expiry
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

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

                // 2. Create birthday coupon
                const couponRes = await client.query(`
                    INSERT INTO loyalty_coupons 
                    (customer_id, coupon_code, status, coupon_type, discount_type, discount_value, min_order_amount, redeemed_at)
                    VALUES ($1, $2, 'active', 'birthday', 'percent', 15, 0, CURRENT_TIMESTAMP)
                    RETURNING *
                `, [customer.id, couponCode]);

                const coupon = couponRes.rows[0];

                // 3. Send LINE message
                const messageSent = await sendBirthdayMessage(customer, coupon, shopName);

                // 4. Update birthday_reward_sent_year
                await client.query(`
                    UPDATE loyalty_customers 
                    SET birthday_reward_sent_year = $1 
                    WHERE id = $2
                `, [currentYear, customer.id]);

                await client.query('COMMIT');

                if (messageSent) {
                    results.sent++;
                    console.log(`[Birthday] 🎂 Sent birthday reward to customer #${customer.id} (${customer.nickname || customer.display_name})`);
                }

            } catch (customerErr) {
                await client.query('ROLLBACK');
                console.error(`[Birthday] Error processing customer #${customer.id}:`, customerErr.message);
                results.errors.push({ customerId: customer.id, error: customerErr.message });
            }
        }

        // Emit to admin dashboard
        if (io && results.sent > 0) {
            io.emit('birthday-rewards-sent', { count: results.sent, date: new Date().toISOString() });
        }

        console.log(`[Birthday] ✅ Completed: ${results.sent} rewards sent, ${results.errors.length} errors`);
        return results;

    } catch (err) {
        console.error('[Birthday] Fatal error in checkBirthdays:', err);
        results.errors.push({ error: err.message });
        return results;
    } finally {
        client.release();
    }
};

// Initialize scheduler
const initBirthdayScheduler = (dbPool, socketIo) => {
    pool = dbPool;
    io = socketIo;

    // Schedule: Run every day at 9:00 AM Bangkok time
    // Cron format: minute hour day month weekday
    cron.schedule('0 9 * * *', async () => {
        console.log('[Birthday] ⏰ Running scheduled birthday check...');
        await checkBirthdays();
    }, {
        timezone: 'Asia/Bangkok'
    });

    console.log('[Birthday] 🎂 Birthday Scheduler initialized - Running daily at 09:00 AM');
};

// Manual trigger for admin testing
const checkBirthdaysManually = async () => {
    console.log('[Birthday] 🔧 Manual birthday check triggered...');
    return await checkBirthdays();
};

module.exports = {
    initBirthdayScheduler,
    checkBirthdaysManually
};
