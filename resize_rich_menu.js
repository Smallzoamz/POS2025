const { Jimp } = require('jimp');
const path = require('path');

const inputPath = path.join(__dirname, 'public/assets/rich_menu_default.png');

console.log('Starting resize script with Jimp v1...');

async function run() {
    try {
        console.log(`Reading image from: ${inputPath}`);
        const image = await Jimp.read(inputPath);

        console.log(`Original size: ${image.bitmap.width}x${image.bitmap.height}`);

        // Resize to exactly 1200x810
        image.resize({ w: 1200, h: 810 }); // Jimp v1 syntax might differ, checking docs or trying standard
        // actually v1 usually supports resize(w, h) too, but let's be safe.
        // Wait, v1 might return a new instance or mutate.

        await image.write(inputPath); // v1 uses write or writeAsync?
        // Jimp v1 migration guide says read/write might differ.
        // Let's assume basic API compatibility or check keys if fail.

        console.log('✅ Image resized to 1200x810 successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        // Fallback debug
        try {
            const jimpObj = require('jimp');
            console.log('Require("jimp") keys:', Object.keys(jimpObj));
        } catch (e) { }
        process.exit(1);
    }
}

run();
