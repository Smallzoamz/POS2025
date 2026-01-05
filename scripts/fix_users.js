const Database = require('better-sqlite3');
const path = require('path');

// Adjust path to point to root pos.db
const dbPath = path.join(__dirname, '../pos.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('Using Database at:', dbPath);

const updates = [
    { name: 'Owner', role: 'owner', pin: '9999' },
    { name: 'Admin', role: 'admin', pin: '1111' },
    { name: 'Chef', role: 'kitchen', pin: '2222' },
    { name: 'Staff', role: 'staff', pin: '0000' }
];

updates.forEach(u => {
    // Check if user exists by name
    const user = db.prepare("SELECT * FROM users WHERE name = ?").get(u.name);

    if (user) {
        console.log(`Updating ${u.name}...`);
        db.prepare("UPDATE users SET role = ?, pin = ? WHERE name = ?").run(u.role, u.pin, u.name);
    } else {
        console.log(`Creating ${u.name}...`);
        db.prepare("INSERT INTO users (name, role, pin) VALUES (?, ?, ?)").run(u.name, u.role, u.pin);
    }
});

console.log('✅ Users Fixed!');
const allUsers = db.prepare("SELECT * FROM users").all();
console.table(allUsers);
