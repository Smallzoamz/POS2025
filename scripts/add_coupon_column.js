const { Pool } = require('pg');
require('dotenv').config({ path: 'f:\\POS2025\\.env' });

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 10000,
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'pos2025',
    };

const pool = new Pool(poolConfig);

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('📦 Starting Migration: Adding coupon columns to orders table...');

        await client.query('BEGIN');

        // Check if columns exist
        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='coupon_code';
        `);

        if (checkRes.rowCount === 0) {
            await client.query(`
                ALTER TABLE orders 
                ADD COLUMN coupon_code VARCHAR(50),
                ADD COLUMN coupon_details JSONB;
            `);
            console.log('✅ Added coupon_code and coupon_details columns.');
        } else {
            console.log('Re-checking columns... seems they might already exist or partial migration.');
            // Ensure coupon_details exists too
            await client.query(`
                ALTER TABLE orders 
                ADD COLUMN IF NOT EXISTS coupon_details JSONB;
            `);
        }

        await client.query('COMMIT');
        console.log('🎉 Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
