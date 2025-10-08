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
          primaryHover: "#6DD9CF",
          accent: "#F46036",
          dark: "#2D3748",
          light: "#F8F9FA",
          muted: "#A0AEC0",
          surface: "#f5f7fa"
        },
        status: {
          error: "#d32f2f",
          errorBg: "#ffe6e6",
          success: "#2e7d32",
          successBg: "#e8f5e8",
          info: "#1976d2",
          infoBg: "#e3f2fd"
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
