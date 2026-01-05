const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function debug() {
    try {
        console.log("--- Timezone Check ---");
        await pool.query("SET TIME ZONE 'Asia/Bangkok'");
        const tzRes = await pool.query("SHOW TIME ZONE");
        console.log("Current Session Timezone:", tzRes.rows[0].TimeZone);

        const nowRes = await pool.query("SELECT CURRENT_DATE, CURRENT_TIMESTAMP, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') as utc_now");
        console.log("DB Time Info:", nowRes.rows[0]);

        console.log("\n--- Column Types Check ---");
        const colRes = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('orders', 'line_orders') AND column_name IN ('updated_at', 'created_at')
        `);
        console.table(colRes.rows);

        console.log("\n--- Recent Orders & Date Casting ---");
        // Check how Jan 5 (Thailand) is interpreted
        const orders = await pool.query(`
            SELECT id, status, updated_at, 
                   updated_at::date as direct_date,
                   (updated_at AT TIME ZONE 'Asia/Bangkok')::date as cast_local_date,
                   total_amount 
            FROM orders 
            ORDER BY updated_at DESC LIMIT 5
        `);
        console.table(orders.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debug();
