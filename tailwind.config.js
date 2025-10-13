/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#4FD1C5",
          accent: "#F46036",
          dark: "#2D3748",
          light: "#F8F9FA"
        }
      },
      boxShadow: {
        card: "0 8px 24px rgba(0,0,0,0.06)",
        cardHover: "0 12px 28px rgba(0,0,0,0.12)"
      },
      borderRadius: {
        xl: "1rem"
      }
    },
    fontFamily: {
      sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
    }
  },
  plugins: [
    require("@tailwindcss/forms")
  ],
};
