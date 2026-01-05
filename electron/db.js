const Database = require('better-sqlite3');
const path = require('path');

let app;
try {
    // Only require electron if we are inside Electron
    if (process.versions.electron) {
        app = require('electron').app;
    }
} catch (e) { }

// Store DB in User Data path so it updates don't wipe it
// In dev, we might want it in the project root for visibility
const isDev = process.env.NODE_ENV === 'development';
const dbPath = (isDev || !app)
    ? path.join(__dirname, '../pos.db')
    : path.join(app.getPath('userData'), 'pos.db');

const db = new Database(dbPath, { verbose: console.log });

function initDatabase() {
    // --- DATABASE INITIALIZATION ---

    // 0. Zones (Must be before tables if we want FK, but loose coupling is fine for now)
    db.exec(`
        CREATE TABLE IF NOT EXISTS zones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    `);

    // Seed Zones if empty
    const zoneCount = db.prepare("SELECT count(*) as count FROM zones").get().count;
    if (zoneCount === 0) {
        console.log('Seeding Zones...');
        const insertZone = db.prepare("INSERT INTO zones (name) VALUES (?)");
        insertZone.run('Indoor');
        insertZone.run('Outdoor');
        insertZone.run('VIP');
    }

    // 1. Tables (Stores physical tables in the restaurant)
    db.exec(`
        CREATE TABLE IF NOT EXISTS tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            zone TEXT NOT NULL,
            status TEXT DEFAULT 'available', -- available, occupied, bill
            seats INTEGER DEFAULT 4
        )
    `);

    // 2. Categories
    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            sort_order INTEGER DEFAULT 0
        )
    `);

    // 3. Products
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id TEXT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            image TEXT,
            is_available INTEGER DEFAULT 1,
            stock_quantity INTEGER DEFAULT 0,
            track_stock INTEGER DEFAULT 0,
            FOREIGN KEY(category_id) REFERENCES categories(id)
        )
    `);

    // Migration: Add columns if they don't exist (primitive migration)
    try {
        db.prepare('SELECT stock_quantity FROM products LIMIT 1').get();
    } catch (err) {
        if (err.message.includes('no such column')) {
            console.log('Migrating Database: Adding stock columns...');
            db.exec('ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0');
            db.exec('ALTER TABLE products ADD COLUMN track_stock INTEGER DEFAULT 0');
        }
    }

    // 4. Orders (Head)
    db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT,
            order_type TEXT DEFAULT 'dine_in', -- dine_in, takeaway
            status TEXT DEFAULT 'cooking', -- cooking, ready, served, paid
            total_amount REAL DEFAULT 0,
            payment_method TEXT, -- cash, transfer, khon_la_khrueng
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migration: Add payment_method if not exists (for existing DBs)
    try {
        db.prepare("ALTER TABLE orders ADD COLUMN payment_method TEXT").run();
    } catch (e) {
        // Ignore if column already exists
    }

    // Migration: Add order_type if not exists
    try {
        db.prepare("ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'").run();
    } catch (e) {
        // Ignore if column already exists
    }


    // 5. Order Items (Lines)
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_items(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        price REAL,
        quantity INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending', --pending, cooking, done
            FOREIGN KEY(order_id) REFERENCES orders(id)
    )
        `);

    // --- SEED INITIAL DATA (If empty) ---
    const tableCount = db.prepare('SELECT count(*) as count FROM tables').get();
    if (tableCount.count === 0) {
        console.log('Seeding Tables...');
        const insertTable = db.prepare('INSERT INTO tables (name, zone, seats) VALUES (?, ?, ?)');
        const tables = [
            ['T-01', 'Indoor', 4], ['T-02', 'Indoor', 4], ['T-03', 'Indoor', 2], ['T-04', 'Indoor', 6],
            ['T-05', 'Outdoor', 4], ['T-06', 'Outdoor', 8], ['T-07', 'Outdoor', 4], ['VIP-01', 'VIP', 10]
        ];
        tables.forEach(t => insertTable.run(...t));
    }

    const catCount = db.prepare('SELECT count(*) as count FROM categories').get();
    if (catCount.count === 0) {
        console.log('Seeding Menu...');
        const insertCat = db.prepare('INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)');
        insertCat.run('REC', 'แนะนำ', '🔥');
        insertCat.run('FOOD', 'อาหารจานเดียว', '🍛');
        insertCat.run('APP', 'ทานเล่น', '🍟');
        insertCat.run('DRINK', 'เครื่องดื่ม', '🥤');

        const insertProd = db.prepare('INSERT INTO products (category_id, name, price, image) VALUES (?, ?, ?, ?)');
        insertProd.run('REC', 'กะเพราหมูสับไข่ดาว', 65, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=300');
        insertProd.run('REC', 'ต้มยำกุ้งน้ำข้น', 180, null);
        insertProd.run('FOOD', 'ข้าวผัดปู', 80, null);
        insertProd.run('APP', 'เฟรนช์ฟรายส์', 59, null);
        insertProd.run('DRINK', 'โค้ก (กระป๋อง)', 25, null);
    }
    // 6. Ingredients (Inventory)
    db.exec(`
        CREATE TABLE IF NOT EXISTS ingredients(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            total_quantity REAL DEFAULT 0,
            unit TEXT DEFAULT 'units' -- kg, g, l, ml, pcs
        )
        `);

    // 7. Product Ingredients (Recipes)
    db.exec(`
        CREATE TABLE IF NOT EXISTS product_ingredients(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            ingredient_id INTEGER,
            quantity_used REAL NOT NULL,
            FOREIGN KEY(product_id) REFERENCES products(id),
            FOREIGN KEY(ingredient_id) REFERENCES ingredients(id)
        )
        `);

    // 8. Settings (Global Config)
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings(
            key TEXT PRIMARY KEY,
            value TEXT
        )
        `);

    // 9. Users (Staff Management)
    db.exec(`
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            full_name TEXT,
            pin TEXT NOT NULL,
            role TEXT DEFAULT 'staff' -- admin, staff
        )
        `);

    // 10. Attendance Logs
    db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_logs(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            clock_in DATETIME DEFAULT CURRENT_TIMESTAMP,
            clock_out DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // 6. Transactions (Finance)
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- income, expense
            category TEXT,
            amount REAL NOT NULL,
            description TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER, -- user_id
            FOREIGN KEY(created_by) REFERENCES users(id)
        )
    `);

    // 7. Payroll Adjustments (Bonuses/Deductions)
    db.exec(`
        CREATE TABLE IF NOT EXISTS payroll_adjustments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL, -- bonus, deduction
            amount REAL NOT NULL,
            reason TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER, -- user_id (who added this adjustment)
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(created_by) REFERENCES users(id)
        )
    `);

    // --- SEEDING (Default Data) ---
    // --- MIGRATIONS (Pre-Seed) ---
    // User Migration - Must be done before seeding users
    try {
        db.exec("ALTER TABLE users ADD COLUMN full_name TEXT");
    } catch (e) { /* Column likely exists */ }

    // Finance Migration: Hourly Rate
    try {
        db.exec("ALTER TABLE users ADD COLUMN hourly_rate REAL DEFAULT 0");
        console.log("✅ Migrated: Added hourly_rate to users");
    } catch (e) { /* Column likely exists */ }

    // --- SEEDING / FIXING (Default Data) ---
    const userCount = db.prepare("SELECT count(*) as count FROM users").get().count;
    if (userCount === 0) {
        console.log("Seeding Users...");
        const insertUser = db.prepare("INSERT INTO users (name, full_name, pin, role, hourly_rate) VALUES (?, ?, ?, ?, ?)");
        insertUser.run("Owner", "Master A", "9999", "owner", 0);
        insertUser.run("Admin", "Manager B", "1111", "admin", 50);
        insertUser.run("Chef", "Chef C", "2222", "kitchen", 45);
        insertUser.run("Staff", "Staff D", "0000", "staff", 40);
        console.log("✅ Default Users Created");
    } else {
        // Ensure Owner Exists and is Correct (Fix for corrupted seed)
        const owner = db.prepare("SELECT * FROM users WHERE role = 'owner' OR name = 'Owner'").get();
        if (owner) {
            // Update to ensure correct PIN/Role/FullName
            db.prepare("UPDATE users SET name = 'Owner', full_name = 'Master Owner', pin = '9999', role = 'owner' WHERE id = ?").run(owner.id);
            // We usually don't set hourly rate for owner, but let's keep it safe.
        } else {
            // Create if missing
            db.prepare("INSERT INTO users (name, full_name, pin, role, hourly_rate) VALUES (?, ?, ?, ?, ?)").run("Owner", "Master Owner", "9999", "owner", 0);
            console.log("✅ Owner Account Created (9999)");
        }
    }

    // --- MIGRATIONS (Other) ---
    try {
        db.exec("ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0");
    } catch (e) { /* Column likely exists */ }

    try {
        db.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0");
    } catch (e) { /* Column likely exists */ }

    try {
        db.exec("ALTER TABLE orders ADD COLUMN tax_amount REAL DEFAULT 0");
    } catch (e) { /* Column likely exists */ }

    try {
        db.exec("ALTER TABLE orders ADD COLUMN grand_total REAL DEFAULT 0");
    } catch (e) { /* Column likely exists */ }

    // Attendance Status Migration
    try {
        db.exec("ALTER TABLE attendance_logs ADD COLUMN status TEXT DEFAULT 'present'");
        // present, late, leave, absent
    } catch (e) { /* Column likely exists */ }

    // holiday migration
    try {
        db.exec("ALTER TABLE users ADD COLUMN off_day INTEGER DEFAULT 7");
    } catch (e) { /* Column likely exists */ }
    try {
        db.exec("ALTER TABLE users ADD COLUMN off_day2 INTEGER DEFAULT 7");
    } catch (e) { /* Column likely exists */ }

    // Settings Migration (Work Start Time)
    const workStart = db.prepare("SELECT value FROM settings WHERE key = 'work_start_time'").get();
    if (!workStart) {
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('work_start_time', '09:00');
    }

    // === LINE ORDERS TABLE ===
    // สำหรับรับออเดอร์จาก LINE Official Account
    db.exec(`
        CREATE TABLE IF NOT EXISTS line_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_type TEXT NOT NULL, -- reservation, delivery, pickup
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_address TEXT, -- สำหรับ Delivery
            latitude REAL, -- พิกัด Lat สำหรับ Delivery
            longitude REAL, -- พิกัด Lng สำหรับ Delivery
            reservation_date TEXT, -- สำหรับ Reservation (YYYY-MM-DD)
            reservation_time TEXT, -- สำหรับ Reservation (HH:MM)
            guests_count INTEGER, -- จำนวนคน (Reservation)
            items_json TEXT NOT NULL, -- JSON Array ของรายการอาหาร
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'pending', -- pending, confirmed, preparing, ready, completed, cancelled
            note TEXT, -- หมายเหตุ
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migration: Add lat/lng columns if not exist
    try { db.exec("ALTER TABLE line_orders ADD COLUMN latitude REAL"); } catch (e) { }
    try { db.exec("ALTER TABLE line_orders ADD COLUMN longitude REAL"); } catch (e) { }
    // Migration: Add payment_method column if not exist
    try { db.exec("ALTER TABLE line_orders ADD COLUMN payment_method TEXT"); } catch (e) { }
}

module.exports = {
    db,
    initDatabase
};
