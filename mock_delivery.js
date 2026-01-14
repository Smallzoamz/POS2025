const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'pos2025',
});

async function run() {
    try {
        console.log("Creating Mock Delivery Order...");

        // Mock Data: ~5.5km away from Default Store (13.7563, 100.5018)
        // Lat: +0.05, Lng: +0.05
        const mockOrder = {
            customer_name: "พี่ทดสอบ ระบบดี",
            customer_phone: "0812345678",
            delivery_address: "วัดตาเหล็ง ตำบล หนองปล่อง อำเภอ ชำนิ บุรีรัมย์ 31110",
            latitude: 14.76826031532009,
            longitude: 102.8380815212859,
            total_amount: 550.00,
            items_json: JSON.stringify([
                { name: "ข้าวผัดปูใหญ่", quantity: 1, price: 150 },
                { name: "ต้มยำกุ้งน้ำข้น", quantity: 2, price: 200 }
            ]),
            status: 'confirmed' // Confirmed (Ready for rider pickup)
        };

        const res = await pool.query(`
            INSERT INTO line_orders 
            (order_type, customer_name, customer_phone, customer_address, latitude, longitude, total_amount, items_json, status, created_at, customer_lat, customer_lng)
            VALUES 
            ('delivery', $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $4, $5)
            RETURNING id
        `, [
            mockOrder.customer_name,
            mockOrder.customer_phone,
            mockOrder.delivery_address,
            mockOrder.latitude,
            mockOrder.longitude,
            mockOrder.total_amount,
            mockOrder.items_json,
            mockOrder.status
        ]);

        console.log(`✅ Created Mock Order ID: #${res.rows[0].id}`);

        // Also ensure settings exist (just in case server didn't run migration 21 fully yet, though it should have)
        await pool.query("INSERT INTO settings (key, value) VALUES ('rider_base_fare', '20') ON CONFLICT (key) DO NOTHING");
        await pool.query("INSERT INTO settings (key, value) VALUES ('rider_per_km_rate', '5') ON CONFLICT (key) DO NOTHING");
        await pool.query("INSERT INTO settings (key, value) VALUES ('store_lat', '13.7563') ON CONFLICT (key) DO NOTHING");
        await pool.query("INSERT INTO settings (key, value) VALUES ('store_lng', '100.5018') ON CONFLICT (key) DO NOTHING");

        console.log("✅ Verified Settings");

    } catch (err) {
        console.error("Error creating mock order:", err);
    } finally {
        await pool.end();
    }
}

run();
