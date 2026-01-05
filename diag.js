const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function check() {
    try {
        console.log("Checking Database Connection...");
        const timeRes = await pool.query("SELECT CURRENT_DATE, CURRENT_TIMESTAMP");
        console.log("DB Time Info:", timeRes.rows[0]);

        console.log("\n--- In-store Orders for Today ---");
        const orders = await pool.query("SELECT id, status, updated_at, total_amount FROM orders WHERE updated_at::date = CURRENT_DATE");
        console.table(orders.rows);

        console.log("\n--- LINE Orders for Today ---");
        const lineOrders = await pool.query("SELECT id, status, updated_at, total_amount FROM line_orders WHERE updated_at::date = CURRENT_DATE");
        console.table(lineOrders.rows);

        console.log("\n--- All Paid/Completed Orders (Overall) ---");
        const allLimit = await pool.query("SELECT id, status, updated_at, total_amount FROM orders WHERE status = 'paid' ORDER BY updated_at DESC LIMIT 5");
        console.table(allLimit.rows);

        const lineLimit = await pool.query("SELECT id, status, updated_at, total_amount FROM line_orders WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 5");
        console.table(lineLimit.rows);

    } catch (err) {
        console.error("Diagnostic Error:", err);
    } finally {
        await pool.end();
    }
}

check();
