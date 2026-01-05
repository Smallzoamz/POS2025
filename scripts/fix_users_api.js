const API_URL = 'http://localhost:3000/api/users';

const targetUsers = [
    { name: 'Owner', role: 'owner', pin: '9999' },
    { name: 'Admin', role: 'admin', pin: '1111' },
    { name: 'Chef', role: 'kitchen', pin: '2222' },
    { name: 'Staff', role: 'staff', pin: '0000' }
];

async function fixUsers() {
    try {
        console.log('Fetching current users...');
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
        const currentUsers = await res.json();
        console.log('Current Users:', currentUsers);

        for (const target of targetUsers) {
            const existing = currentUsers.find(u => u.name === target.name);

            if (existing) {
                // Update
                if (existing.role !== target.role || existing.pin !== target.pin) {
                    console.log(`Updating ${target.name}...`);
                    const updateRes = await fetch(`${API_URL}/${existing.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(target)
                    });
                    if (!updateRes.ok) console.error(`Failed to update ${target.name}`);
                    else console.log(`✅ Updated ${target.name}`);
                } else {
                    console.log(`✅ ${target.name} is already correct.`);
                }
            } else {
                // Create
                console.log(`Creating ${target.name}...`);
                const createRes = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(target)
                });
                if (!createRes.ok) console.error(`Failed to create ${target.name}`);
                else console.log(`✅ Created ${target.name}`);
            }
        }

        console.log('🎉 Fix Complete!');
    } catch (error) {
        console.error('Error:', error);
    }
}

fixUsers();
