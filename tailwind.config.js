/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,js,jsx}",
    ],
    theme: {
        extend: {
            colors: {
                'hdr-dark': '#0a0a0a', // HDR-friendly dark
                'hdr-accent': '#4f46e5', // HDR-friendly indigo
            },
        },
    },
    plugins: [],
}
