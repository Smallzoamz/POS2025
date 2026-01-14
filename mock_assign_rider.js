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
        console.log("🛠️ Assigning Rider ID 1 (Somchai) to latest order...");

        // 1. Ensure Rider ID 1 exists
        // Check if ID 1 exists primarily in 'riders' table
        const riderCheck = await pool.query("SELECT * FROM riders WHERE id = 1");
        if (riderCheck.rowCount === 0) {
            console.log("⚠️ Rider ID 1 not found. Creating...");
            await pool.query(`
                INSERT INTO riders (id, username, password_hash, name, phone, vehicle_type, vehicle_plate, is_active, status)
                VALUES (1, 'rider1', 'hash', 'พี่สมชาย สายซิ่ง', '0899999999', 'motorcycle', 'กข 1234', true, 'online')
                ON CONFLICT (id) DO NOTHING
            `);
        } else {
            console.log(`✅ Rider found: ${riderCheck.rows[0].name}`);
        }

        // 2. Get latest pending/confirmed order
        const orderRes = await pool.query("SELECT id FROM line_orders ORDER BY created_at DESC LIMIT 1");
        if (orderRes.rowCount === 0) {
            console.log("❌ No orders found.");
            return;
        }
        const orderId = orderRes.rows[0].id;

        // 3. Assign
        await pool.query("UPDATE line_orders SET rider_id = 1, status = 'picked_up' WHERE id = $1", [orderId]);
        console.log(`✅ Assigned Rider ID 1 to Order #${orderId}`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

run();
