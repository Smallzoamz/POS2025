/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#F97316", // Modern Vibrant Orange
                secondary: "#1E293B", // Slate 800
                accent: "#10B981", // Emerald 500
                background: "#F8FAFC", // Slate 50
                surface: "#FFFFFF",
                danger: "#EF4444",
                success: "#22C55E",
                warning: "#F59E0B"
            },
            fontFamily: {
                sans: ['Kanit', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
