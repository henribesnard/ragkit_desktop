/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: {
                    50: "#E7F4EF",
                    100: "#C7E8DC",
                    200: "#93D3BE",
                    300: "#58B89C",
                    400: "#239C7C",
                    500: "#0F7D63",
                    600: "#0B6450",
                    700: "#0A5142",
                    800: "#093F34",
                    900: "#093F34",
                },
                brand: {
                    50: "#E7F4EF",
                    100: "#C7E8DC",
                    200: "#93D3BE",
                    300: "#58B89C",
                    400: "#239C7C",
                    500: "#0F7D63",
                    600: "#0B6450",
                    700: "#0A5142",
                    800: "#093F34",
                },
            },
            fontFamily: {
                sans: ["Geist", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
                mono: ["Geist Mono", "ui-monospace", "SF Mono", "Cascadia Code", "Fira Code", "Consolas", "monospace"],
            },
        },
    },
    plugins: [],
};
