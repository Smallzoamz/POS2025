const { Pool } = require('pg');
require('dotenv').config();

const isDev = process.env.NODE_ENV === 'development';

// Support both DATABASE_URL (Render/Cloud) and individual settings (local)
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Required for Render
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'pos2025',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

const pool = new Pool(poolConfig);

pool.on('connect', (client) => {
    client.query("SET TIME ZONE 'Asia/Bangkok'");
});

const query = (text, params) => pool.query(text, params);

const initDatabasePG = async () => {
    // Skip database creation if using DATABASE_URL (cloud deployment)
    // Cloud providers like Render create the database for us
    if (!process.env.DATABASE_URL) {
        // 1. Create a temporary client to connect to 'postgres' system database (LOCAL ONLY)
        const tempPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            database: 'postgres', // Connect to default system DB
        });

        try {
            const dbName = process.env.DB_NAME || 'pos2025';
            const res = await tempPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);

            if (res.rowCount === 0) {
                console.log(`📡 Database "${dbName}" not found. Creating it now...`);
                await tempPool.query(`CREATE DATABASE "${dbName}"`);
                console.log(`✨ Database "${dbName}" created successfully!`);
            }
        } catch (err) {
            console.error("❌ Failed to check/create database:", err.message);
            console.error("DEBUG INFO:", {
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                msg: err.message,
                code: err.code
            });
        } finally {
            await tempPool.end();
        }
    } else {
        console.log("☁️ Using DATABASE_URL - skipping database creation (cloud mode)");
    }

    // 2. Now proceed with the main initialization
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0. Zones
        await client.query(`
            CREATE TABLE IF NOT EXISTS zones (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL
            )
        `);

        // 1. Tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS tables (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                zone TEXT NOT NULL,
                status TEXT DEFAULT 'available',
                seats INTEGER DEFAULT 4,
                x INTEGER DEFAULT 100,
                y INTEGER DEFAULT 100,
                w INTEGER DEFAULT 80,
                h INTEGER DEFAULT 80,
                rotation INTEGER DEFAULT 0,
                shape TEXT DEFAULT 'rectangle' -- 'rectangle', 'circle', 'hut'
            )
        `);

        // 1.1 Map Objects (Decorations & Areas)
        await client.query(`
            CREATE TABLE IF NOT EXISTS map_objects (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL, -- 'kitchen', 'water_station', 'restroom', 'fence', 'tree', 'garden', 'walkway', 'hut'
                x INTEGER DEFAULT 0,
                y INTEGER DEFAULT 0,
                w INTEGER DEFAULT 100,
                h INTEGER DEFAULT 100,
                rotation INTEGER DEFAULT 0,
                zone TEXT NOT NULL
            )
        `);

        // Tables - Add layout columns if they don't exist (Migration)
        try {
            await client.query(`
                ALTER TABLE tables 
                ADD COLUMN IF NOT EXISTS x INTEGER DEFAULT 100,
                ADD COLUMN IF NOT EXISTS y INTEGER DEFAULT 100,
                ADD COLUMN IF NOT EXISTS w INTEGER DEFAULT 80,
                ADD COLUMN IF NOT EXISTS h INTEGER DEFAULT 80,
                ADD COLUMN IF NOT EXISTS rotation INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS shape TEXT DEFAULT 'rectangle'
            `);
            console.log('✅ Tables layout columns migration completed');
        } catch (err) {
            console.log('Tables migration note:', err.message);
        }

        // 2. Categories
        await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT,
                sort_order INTEGER DEFAULT 0
            )
        `);

        // 3. Products
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                category_id TEXT REFERENCES categories(id),
                name TEXT NOT NULL,
                price DECIMAL(12,2) NOT NULL,
                image TEXT,
                is_available BOOLEAN DEFAULT TRUE,
                stock_quantity INTEGER DEFAULT 0,
                track_stock BOOLEAN DEFAULT FALSE
            )
        `);

        // 4. Orders
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                table_name TEXT,
                order_type TEXT DEFAULT 'dine_in',
                status TEXT DEFAULT 'cooking',
                total_amount DECIMAL(12,2) DEFAULT 0,
                subtotal DECIMAL(12,2) DEFAULT 0,
                discount_amount DECIMAL(12,2) DEFAULT 0,
                tax_amount DECIMAL(12,2) DEFAULT 0,
                grand_total DECIMAL(12,2) DEFAULT 0,
                payment_method TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                line_order_id INTEGER -- Link to LINE reservation
            )
        `);

        // 5. Order Items
        await client.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id),
                product_id INTEGER REFERENCES products(id),
                product_name TEXT,
                price DECIMAL(12,2),
                quantity INTEGER DEFAULT 1,
                status TEXT DEFAULT 'pending'
            )
        `);

        // 6. Ingredients
        await client.query(`
            CREATE TABLE IF NOT EXISTS ingredients (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                total_quantity DECIMAL(12,2) DEFAULT 0,
                unit TEXT DEFAULT 'units'
            )
        `);

        // 7. Product Ingredients
        await client.query(`
            CREATE TABLE IF NOT EXISTS product_ingredients (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id),
                ingredient_id INTEGER REFERENCES ingredients(id),
                quantity_used DECIMAL(12,2) NOT NULL
            )
        `);

        // 8. Settings
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // 9. Users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                full_name TEXT,
                phone TEXT,
                pin TEXT NOT NULL,
                role TEXT DEFAULT 'staff',
                hourly_rate DECIMAL(12,2) DEFAULT 0,
                off_day INTEGER DEFAULT 7,
                off_day2 INTEGER DEFAULT 7,
                can_deliver BOOLEAN DEFAULT FALSE
            )
        `);

        // 10. Attendance Logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS attendance_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                clock_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                clock_out TIMESTAMP,
                status TEXT DEFAULT 'present'
            )
        `);

        // 11. Transactions
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,
                category TEXT,
                amount DECIMAL(12,2) NOT NULL,
                description TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES users(id)
            )
        `);

        // 12. Payroll Adjustments
        await client.query(`
            CREATE TABLE IF NOT EXISTS payroll_adjustments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                type TEXT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                reason TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES users(id)
            )
        `);

        // 13. LINE Orders / Delivery Orders
        await client.query(`
            CREATE TABLE IF NOT EXISTS line_orders (
                id SERIAL PRIMARY KEY,
                order_type TEXT NOT NULL DEFAULT 'delivery',
                customer_name TEXT NOT NULL,
                customer_phone TEXT,
                customer_address TEXT,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                reservation_date DATE,
                reservation_time TEXT,
                guests_count INTEGER,
                assigned_table TEXT,
                items_json TEXT NOT NULL DEFAULT '[]',
                total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                status TEXT DEFAULT 'pending',
                payment_method TEXT,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                -- Delivery-specific columns
                rider_id INTEGER REFERENCES users(id),
                rider_lat DECIMAL(10, 8),
                rider_lng DECIMAL(11, 8),
                delivery_started_at TIMESTAMP,
                delivered_at TIMESTAMP,
                estimated_delivery_time INTEGER,
                delivery_fee DECIMAL(12,2) DEFAULT 0,
                tracking_token TEXT,
                queue_position INTEGER,
                deposit_amount DECIMAL(12,2) DEFAULT 0,
                is_deposit_paid BOOLEAN DEFAULT FALSE
            )
        `);

        // 13.5 External Riders (สำหรับอนาคต - จ้างคนนอก)
        await client.query(`
            CREATE TABLE IF NOT EXISTS external_riders (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                vehicle_type TEXT DEFAULT 'motorcycle',
                license_plate TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                current_lat DECIMAL(10, 8),
                current_lng DECIMAL(11, 8),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 14. LINE Order Items
        await client.query(`
            CREATE TABLE IF NOT EXISTS line_order_items (
                id SERIAL PRIMARY KEY,
                line_order_id INTEGER REFERENCES line_orders(id),
                product_id INTEGER REFERENCES products(id),
                product_name TEXT,
                price DECIMAL(12,2),
                quantity INTEGER DEFAULT 1,
                options JSONB DEFAULT '[]'
            )
        `);

        // 15. Notifications HISTORY
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                message TEXT,
                type TEXT DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                meta JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query('COMMIT');
        console.log("✅ PostgreSQL Database Initialized Successfully");

        // --- SEEDING LOGIC ---
        const zoneRes = await client.query("SELECT COUNT(*) FROM zones");
        if (zoneRes.rows[0].count == 0) {
            console.log('Seeding Zones...');
            await client.query("INSERT INTO zones (name) VALUES ($1), ($2), ($3)", ['Indoor', 'Outdoor', 'VIP']);
        }

        const tableRes = await client.query("SELECT COUNT(*) FROM tables");
        if (tableRes.rows[0].count == 0) {
            console.log('Seeding Tables...');
            const tables = [
                ['T-01', 'Indoor', 4], ['T-02', 'Indoor', 4], ['T-03', 'Indoor', 2], ['T-04', 'Indoor', 6],
                ['T-05', 'Outdoor', 4], ['T-06', 'Outdoor', 8], ['T-07', 'Outdoor', 4], ['VIP-01', 'VIP', 10]
            ];
            for (const t of tables) {
                await client.query('INSERT INTO tables (name, zone, seats) VALUES ($1, $2, $3)', t);
            }
        }

        const catRes = await client.query("SELECT COUNT(*) FROM categories");
        if (catRes.rows[0].count == 0) {
            console.log('Seeding Menu Categories & Products...');
            await client.query("INSERT INTO categories (id, name, icon, sort_order) VALUES ($1, $2, $3, $4)", ['REC', 'แนะนำ', '🔥', 1]);
            await client.query("INSERT INTO categories (id, name, icon, sort_order) VALUES ($1, $2, $3, $4)", ['FOOD', 'อาหารจานเดียว', '🍛', 2]);
            await client.query("INSERT INTO categories (id, name, icon, sort_order) VALUES ($1, $2, $3, $4)", ['APP', 'ทานเล่น', '🍟', 3]);
            await client.query("INSERT INTO categories (id, name, icon, sort_order) VALUES ($1, $2, $3, $4)", ['DRINK', 'เครื่องดื่ม', '🥤', 4]);

            await client.query('INSERT INTO products (category_id, name, price, image) VALUES ($1, $2, $3, $4)',
                ['REC', 'กะเพราหมูสับไข่ดาว', 65, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=300']);
            await client.query('INSERT INTO products (category_id, name, price) VALUES ($1, $2, $3)', ['REC', 'ต้มยำกุ้งน้ำข้น', 180]);
        }

        const userRes = await client.query("SELECT COUNT(*) FROM users");
        if (userRes.rows[0].count == 0) {
            console.log("Seeding Default Users...");
            await client.query("INSERT INTO users (name, full_name, pin, role, hourly_rate) VALUES ($1, $2, $3, $4, $5)", ["Owner", "Master Owner", "9999", "owner", 0]);
            await client.query("INSERT INTO users (name, full_name, pin, role, hourly_rate) VALUES ($1, $2, $3, $4, $5)", ["Admin", "Manager B", "1111", "admin", 50]);
            await client.query("INSERT INTO users (name, full_name, pin, role, hourly_rate) VALUES ($1, $2, $3, $4, $5)", ["Staff", "Staff D", "0000", "staff", 40]);
        }

        const settingRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['work_start_time']);
        if (settingRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['work_start_time', '09:00']);
        }

        const publicUrlRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['public_url']);
        if (publicUrlRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['public_url', 'https://pos-backend-8cud.onrender.com']);
        }

        const printerRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['enable_receipt_printer']);
        if (printerRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['enable_receipt_printer', 'true']);
        }

        // Delivery Settings Defaults
        const deliveryMinRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['minimum_delivery_order']);
        if (deliveryMinRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['minimum_delivery_order', '100']);
            console.log('Added minimum_delivery_order setting');
        }
        const deliveryFeeRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['delivery_fee']);
        if (deliveryFeeRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['delivery_fee', '0']);
            console.log('Added delivery_fee setting');
        }

        // Loyalty Settings Defaults
        const pointsRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['loyalty_points_per_unit']);
        if (pointsRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['loyalty_points_per_unit', '35']);
            console.log('Added loyalty_points_per_unit setting');
        }

        // Business Hours Settings Defaults
        const openTimeRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['store_open_time']);
        if (openTimeRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['store_open_time', '09:00']);
            console.log('Added store_open_time setting');
        }
        const closeTimeRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['store_close_time']);
        if (closeTimeRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['store_close_time', '21:00']);
            console.log('Added store_close_time setting');
        }
        const lastOrderRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['last_order_offset_minutes']);
        if (lastOrderRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['last_order_offset_minutes', '30']);
            console.log('Added last_order_offset_minutes setting');
        }


        // --- MIGRATION: Add new columns to line_orders if they don't exist ---
        try {
            await client.query(`
                ALTER TABLE line_orders 
                ADD COLUMN IF NOT EXISTS rider_id INTEGER REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS rider_lat DECIMAL(10, 8),
                ADD COLUMN IF NOT EXISTS rider_lng DECIMAL(11, 8),
                ADD COLUMN IF NOT EXISTS customer_lat DECIMAL(10, 8),
                ADD COLUMN IF NOT EXISTS customer_lng DECIMAL(11, 8),
                ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS estimated_delivery_time INTEGER,
                ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12,2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS tracking_token TEXT,
                ADD COLUMN IF NOT EXISTS queue_position INTEGER
            `);
            console.log('✅ Delivery columns migration completed');
        } catch (migrationErr) {
            // Columns might already exist, that's okay
            console.log('Migration note:', migrationErr.message);
        }

        // --- MIGRATION: Add base columns to line_orders if they don't exist ---
        try {
            // Run each column addition separately to avoid partial failure
            const baseColumns = [
                "ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery'",
                "ADD COLUMN IF NOT EXISTS customer_name TEXT",
                "ADD COLUMN IF NOT EXISTS customer_phone TEXT",
                "ADD COLUMN IF NOT EXISTS customer_address TEXT",
                "ADD COLUMN IF NOT EXISTS delivery_location TEXT",
                "ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2)",
                "ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'",
                "ADD COLUMN IF NOT EXISTS payment_method TEXT",
                "ADD COLUMN IF NOT EXISTS note TEXT",
                "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "ADD COLUMN IF NOT EXISTS assigned_table TEXT",
                "ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12,2) DEFAULT 0",
                "ADD COLUMN IF NOT EXISTS is_deposit_paid BOOLEAN DEFAULT FALSE"
            ];

            for (const col of baseColumns) {
                try {
                    await client.query(`ALTER TABLE line_orders ${col}`);
                } catch (colErr) {
                    // Column might already exist, ignore
                }
            }
            console.log('✅ Base LINE order columns migration completed');
        } catch (migrationErr2) {
            console.log('Base columns migration note:', migrationErr2.message);
        }

        // Migration 3: Add base columns to users table
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`);
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_deliver BOOLEAN DEFAULT FALSE`);
            console.log('✅ Users migration (phone, can_deliver) completed');
        } catch (migrationErr3) {
            console.log('Users migration note:', migrationErr3.message);
        }

        // Migration 4: Convert TIMESTAMP columns to TIMESTAMPTZ for correct timezone handling
        try {
            const tableColumns = [
                { table: 'orders', columns: ['created_at', 'updated_at'] },
                { table: 'line_orders', columns: ['created_at', 'updated_at', 'delivery_started_at', 'delivered_at'] },
                { table: 'attendance_logs', columns: ['clock_in', 'clock_out'] },
                { table: 'transactions', columns: ['date'] },
                { table: 'payroll_adjustments', columns: ['date'] }
            ];

            for (const item of tableColumns) {
                for (const col of item.columns) {
                    try {
                        await client.query(`ALTER TABLE ${item.table} ALTER COLUMN ${col} TYPE TIMESTAMPTZ`);
                    } catch (colErr) {
                        // Ignore if column doesn't exist or already converted
                    }
                }
            }
            console.log('✅ TIMESTAMPTZ migrations completed');
        } catch (migrationErr4) {
            console.log('TIMESTAMPTZ migration note:', migrationErr4.message);
        }

        // Migration 5: Add line_order_id to orders table
        try {
            await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS line_order_id INTEGER`);
            console.log('✅ Orders line_order_id migration completed');
        } catch (migrationErr5) {
            console.log('line_order_id migration note:', migrationErr5.message);
        }

        // Migration 6: Add customer info to orders for takeaway support
        try {
            await client.query(`
                ALTER TABLE orders 
                ADD COLUMN IF NOT EXISTS customer_name TEXT,
                ADD COLUMN IF NOT EXISTS customer_phone TEXT
            `);
            console.log('✅ Orders takeaway columns migration completed');
        } catch (migrationErr6) {
            console.error('Takeaway migration note:', migrationErr6.message);
        }

        // Migration 7: Ensure notifications table
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    message TEXT,
                    type TEXT DEFAULT 'info',
                    is_read BOOLEAN DEFAULT FALSE,
                    meta JSONB,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Notifications table migration completed');
        } catch (migrationErr7) {
            console.error('Notifications migration note:', migrationErr7.message);
        }

        // Migration 8: Loyalty System
        try {
            // customers table (linked to LINE)
            await client.query(`
                CREATE TABLE IF NOT EXISTS loyalty_customers (
                    id SERIAL PRIMARY KEY,
                    line_user_id TEXT UNIQUE,
                    display_name TEXT,
                    picture_url TEXT,
                    points INTEGER DEFAULT 0,
                    is_following BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Promotions / Rewards table
            await client.query(`
                CREATE TABLE IF NOT EXISTS loyalty_promotions (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    points_required INTEGER NOT NULL,
                    image_url TEXT,
                    start_date DATE,
                    end_date DATE,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Point transactions log
            await client.query(`
                CREATE TABLE IF NOT EXISTS loyalty_point_transactions (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES loyalty_customers(id),
                    type TEXT NOT NULL, -- 'earn', 'redeem'
                    points INTEGER NOT NULL,
                    order_id INTEGER, -- Optional link to in-store order
                    line_order_id INTEGER, -- Optional link to line order
                    promotion_id INTEGER REFERENCES loyalty_promotions(id),
                    description TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add customer_id to orders and line_orders
            await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES loyalty_customers(id)`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES loyalty_customers(id)`);

            console.log('✅ Loyalty System migration completed');
        } catch (migrationErr8) {
            console.error('Loyalty migration error:', migrationErr8.message);
        }

        // --- MIGRATION 9: Add missing line_orders columns ---
        try {
            console.log('📦 Running Migration 9: line_orders columns...');
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS customer_phone TEXT`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS customer_address TEXT`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8)`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8)`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS reservation_date DATE`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS reservation_time TEXT`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS guests_count INTEGER`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS items_json TEXT DEFAULT '[]'`);
            await client.query(`ALTER TABLE line_orders ADD COLUMN IF NOT EXISTS line_user_id TEXT`);
            console.log('✅ Migration 9: line_orders columns completed');
        } catch (migrationErr9) {
            console.error('Migration 9 error:', migrationErr9.message);
        }

        // --- MIGRATION 10: Loyalty Coupons ---
        try {
            console.log('📦 Running Migration 10: loyalty_coupons...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS loyalty_coupons (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES loyalty_customers(id),
                    promotion_id INTEGER REFERENCES loyalty_promotions(id),
                    coupon_code TEXT UNIQUE NOT NULL,
                    status TEXT DEFAULT 'active', -- 'active', 'used', 'expired'
                    redeemed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    used_at TIMESTAMPTZ,
                    order_id INTEGER, -- Link to in-store order when used
                    line_order_id INTEGER -- Link to line order when used
                )
            `);
            console.log('✅ Migration 10: loyalty_coupons completed');
        } catch (migrationErr10) {
            console.error('Migration 10 error:', migrationErr10.message);
        }

        // --- MIGRATION 11: Loyalty Customer Phone ---
        try {
            console.log('📦 Running Migration 11: loyalty_customers phone...');
            await client.query(`ALTER TABLE loyalty_customers ADD COLUMN IF NOT EXISTS phone TEXT`);
            console.log('✅ Migration 11: loyalty_customers phone completed');
        } catch (migrationErr11) {
            console.error('Migration 11 error:', migrationErr11.message);
        }

        // --- MIGRATION 20: Customer Profile (Nickname & Birthdate) ---
        try {
            console.log('📦 Running Migration 20: loyalty_customers profile fields...');
            await client.query(`ALTER TABLE loyalty_customers ADD COLUMN IF NOT EXISTS nickname TEXT`);
            await client.query(`ALTER TABLE loyalty_customers ADD COLUMN IF NOT EXISTS birthdate DATE`);
            await client.query(`ALTER TABLE loyalty_customers ADD COLUMN IF NOT EXISTS is_profile_completed BOOLEAN DEFAULT FALSE`);
            console.log('✅ Migration 20: loyalty_customers profile fields completed');
        } catch (migrationErr20) {
            console.error('Migration 20 error:', migrationErr20.message);
        }

        // --- MIGRATION 12: Product Options (Add-ons & Size Variants) ---
        try {
            console.log('📦 Running Migration 12: product_options...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS product_options (
                    id SERIAL PRIMARY KEY,
                    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    price_modifier DECIMAL(12,2) DEFAULT 0,
                    is_size_option BOOLEAN DEFAULT FALSE,
                    stock_quantity INTEGER DEFAULT 0,
                    is_available BOOLEAN DEFAULT TRUE,
                    sort_order INTEGER DEFAULT 0,
                    recipe_multiplier DECIMAL(5,2) DEFAULT 1.00
                )
            `);
            // Also ensure column exists if table was already created
            await client.query(`ALTER TABLE product_options ADD COLUMN IF NOT EXISTS recipe_multiplier DECIMAL(5,2) DEFAULT 1.00`);
            console.log('✅ Migration 12: product_options completed');
        } catch (migrationErr12) {
            console.error('Migration 12 error:', migrationErr12.message);
        }

        // --- MIGRATION 13: Order Item Options ---
        try {
            console.log('📦 Running Migration 13: order_item_options...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS order_item_options (
                    id SERIAL PRIMARY KEY,
                    order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
                    option_id INTEGER REFERENCES product_options(id),
                    option_name TEXT,
                    price_modifier DECIMAL(12,2) DEFAULT 0
                )
            `);
            console.log('✅ Migration 13: order_item_options completed');
        } catch (migrationErr13) {
            console.error('Migration 13 error:', migrationErr13.message);
        }

        // --- MIGRATION 14: Option Recipes (Ingredient deduction for options) ---
        try {
            console.log('📦 Running Migration 14: option_recipes...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS option_recipes (
                    id SERIAL PRIMARY KEY,
                    option_id INTEGER REFERENCES product_options(id) ON DELETE CASCADE,
                    ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
                    quantity_used DECIMAL(12,3) NOT NULL,
                    UNIQUE(option_id, ingredient_id)
                )
            `);
            console.log('✅ Migration 14: option_recipes completed');
        } catch (migrationErr14) {
            console.error('Migration 14 error:', migrationErr14.message);
        }

        // --- MIGRATION 15: Global Options (Category-level options) ---
        try {
            console.log('📦 Running Migration 15: global_options...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS global_options (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    price_modifier DECIMAL(12,2) DEFAULT 0,
                    is_size_option BOOLEAN DEFAULT FALSE,
                    stock_quantity INTEGER DEFAULT 0,
                    recipe_multiplier DECIMAL(5,2) DEFAULT 1.00,
                    is_active BOOLEAN DEFAULT TRUE,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Migration 15: global_options completed');
        } catch (migrationErr15) {
            console.error('Migration 15 error:', migrationErr15.message);
        }

        // --- MIGRATION 16: Global Option Categories Junction ---
        try {
            console.log('📦 Running Migration 16: global_option_categories...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS global_option_categories (
                    id SERIAL PRIMARY KEY,
                    option_id INTEGER REFERENCES global_options(id) ON DELETE CASCADE,
                    category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
                    UNIQUE(option_id, category_id)
                )
            `);
            console.log('✅ Migration 16: global_option_categories completed');
        } catch (migrationErr16) {
            console.error('Migration 16 error:', migrationErr16.message);
        }

        // --- MIGRATION 17: Global Option Recipes (Ingredient deduction for global options) ---
        try {
            console.log('📦 Running Migration 17: global_option_recipes...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS global_option_recipes (
                    id SERIAL PRIMARY KEY,
                    global_option_id INTEGER REFERENCES global_options(id) ON DELETE CASCADE,
                    ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
                    quantity_used DECIMAL(12,3) NOT NULL DEFAULT 0,
                    unit TEXT
                )
            `);
            console.log('✅ Migration 17: global_option_recipes completed');
        } catch (migrationErr17) {
            console.error('Migration 17 error:', migrationErr17.message);
        }

        // --- MIGRATION 18: Add is_recommended to products ---
        try {
            console.log('📦 Running Migration 18: Add is_recommended to products...');
            await client.query(`
                ALTER TABLE products 
                ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Migration 18: is_recommended column added');
        } catch (migrationErr18) {
            console.error('Migration 18 error:', migrationErr18.message);
        }

        // --- MIGRATION 19: Support Global Options in Order Items ---
        try {
            console.log('📦 Running Migration 19: Add global_option_id to order_item_options...');
            // Migration: Add 'is_recommended' to products if missing (redundant with MIGRATION 18, but kept for robustness)
            // And add 'options' column to line_order_items
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_recommended') THEN 
                        ALTER TABLE products ADD COLUMN is_recommended BOOLEAN DEFAULT FALSE; 
                    END IF;
                    -- Fix: Add options column to line_order_items
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='line_order_items' AND column_name='options') THEN
                        ALTER TABLE line_order_items ADD COLUMN options JSONB DEFAULT '[]';
                    END IF;
                END $$;
            `);
            await client.query(`
                ALTER TABLE order_item_options 
                ADD COLUMN IF NOT EXISTS global_option_id INTEGER REFERENCES global_options(id),
                ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE,
                ALTER COLUMN option_id DROP NOT NULL
            `);
            console.log('✅ Migration 19: global_option_id added & option_id constraint relaxed');
        } catch (migrationErr19) {
            console.error('Migration 19 error:', migrationErr19.message);
        }

        // --- MIGRATION 21: Birthday Reward System ---
        try {
            console.log('📦 Running Migration 21: Birthday Reward System...');
            // Add birthday_reward_sent_year to track annual reward sending
            await client.query(`
                ALTER TABLE loyalty_customers 
                ADD COLUMN IF NOT EXISTS birthday_reward_sent_year INTEGER
            `);
            // Add coupon_type to categorize coupons
            await client.query(`
                ALTER TABLE loyalty_coupons 
                ADD COLUMN IF NOT EXISTS coupon_type TEXT DEFAULT 'manual'
            `);
            // Add discount_type and discount_value for flexible coupon values
            await client.query(`
                ALTER TABLE loyalty_coupons 
                ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percent',
                ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(12,2) DEFAULT 0
            `);
            console.log('✅ Migration 21: Birthday Reward System columns added');
        } catch (migrationErr21) {
            console.error('Migration 21 error:', migrationErr21.message);
        }

        // --- MIGRATION 22: Win-Back System ---
        try {
            console.log('📦 Running Migration 22: Win-Back System...');
            // Add last_order_at to track customer's last purchase
            await client.query(`
                ALTER TABLE loyalty_customers 
                ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ
            `);
            // Add winback_sent_at to prevent sending too frequently
            await client.query(`
                ALTER TABLE loyalty_customers 
                ADD COLUMN IF NOT EXISTS winback_sent_at TIMESTAMPTZ
            `);
            console.log('✅ Migration 22: Win-Back System columns added');
        } catch (migrationErr22) {
            console.error('Migration 22 error:', migrationErr22.message);
        }

        // Win-Back Settings Defaults
        const winbackInactiveDaysRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['winback_inactive_days']);
        if (winbackInactiveDaysRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['winback_inactive_days', '45']);
            console.log('Added winback_inactive_days setting');
        }
        const winbackDiscountRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['winback_discount_percent']);
        if (winbackDiscountRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['winback_discount_percent', '10']);
            console.log('Added winback_discount_percent setting');
        }
        const winbackCooldownRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['winback_cooldown_days']);
        if (winbackCooldownRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['winback_cooldown_days', '90']);
            console.log('Added winback_cooldown_days setting');
        }
        const winbackValidRes = await client.query("SELECT COUNT(*) FROM settings WHERE key = $1", ['winback_coupon_valid_days']);
        if (winbackValidRes.rows[0].count == 0) {
            await client.query("INSERT INTO settings (key, value) VALUES ($1, $2)", ['winback_coupon_valid_days', '30']);
            console.log('Added winback_coupon_valid_days setting');
        }

        // --- MIGRATION 24: Drop FK Constraint on order_item_options for Global Option Support ---
        try {
            console.log('📦 Running Migration 24: Drop order_item_options FK constraint...');
            // Drop the FK constraint (Postgres naming convention: table_column_fkey)
            await client.query(`
                ALTER TABLE order_item_options 
                DROP CONSTRAINT IF EXISTS order_item_options_option_id_fkey
            `);
            // Add global_option_id column if it doesn't exist (for distinguishing source)
            await client.query(`
                ALTER TABLE order_item_options 
                ADD COLUMN IF NOT EXISTS global_option_id INTEGER REFERENCES global_options(id)
            `);
            console.log('✅ Migration 24: FK constraint dropped, global_option_id added');
        } catch (migrationErr24) {
            console.log('Migration 24 note:', migrationErr24.message);
        }

        // --- MIGRATION 25: Add coupon_code and coupon_details to orders ---
        try {
            console.log('📦 Running Migration 25: Add coupon columns to orders...');
            await client.query(`
                ALTER TABLE orders 
                ADD COLUMN IF NOT EXISTS coupon_code TEXT,
                ADD COLUMN IF NOT EXISTS coupon_details JSONB
            `);
            console.log('✅ Migration 25: coupon_code and coupon_details added to orders');
        } catch (migrationErr25) {
            console.log('Migration 25 note:', migrationErr25.message);
        }

        // --- MIGRATION 26: Add coupon columns to line_orders ---
        try {
            console.log('📦 Running Migration 26: Add coupon columns to line_orders...');
            await client.query(`
                ALTER TABLE line_orders 
                ADD COLUMN IF NOT EXISTS coupon_code TEXT,
                ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(12,2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS original_amount DECIMAL(12,2)
            `);
            console.log('✅ Migration 26: coupon columns added to line_orders');
        } catch (migrationErr26) {
            console.log('Migration 26 note:', migrationErr26.message);
        }

        // Final Commit for all migrations and seeds
        // await client.query('COMMIT'); // Removed to avoid double commit if line 329 already committed
    } catch (e) {
        // Only rollback if we are actually in a transaction
        try {
            await client.query('ROLLBACK');
        } catch (rbErr) {
            // Silently fail rollback if no transaction
        }
        console.error("❌ PostgreSQL Initialization Error:", e);
        throw e;
    } finally {
        client.release();
    }
};

const updateCustomerProfile = async (lineUserId, { nickname, birthdate, phoneNumber }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check current status
        const currentRes = await client.query('SELECT is_profile_completed FROM loyalty_customers WHERE line_user_id = $1', [lineUserId]);
        if (currentRes.rows.length === 0) throw new Error('Customer not found');

        const wasCompleted = currentRes.rows[0].is_profile_completed;
        const isFirstCompletion = !wasCompleted;

        // Update
        const updateRes = await client.query(`
            UPDATE loyalty_customers 
            SET nickname = $1, birthdate = $2, phone = $3, is_profile_completed = TRUE
            WHERE line_user_id = $4
            RETURNING *
        `, [nickname, birthdate, phoneNumber, lineUserId]);

        await client.query('COMMIT');
        return { customer: updateRes.rows[0], isFirstCompletion };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    initDatabasePG,
    updateCustomerProfile
};


