/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../public/**/*.html",
    "../public/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#4FD1C5',
          light: '#CEF2EF',
        },
        'dark-grey': '#2D3748',
        'light-grey': '#A0AEC0',
        orange: '#F46036',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'button': '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      spacing: {
        'block-width': '80px',
        'block-height': '30px',
        'world-height': '240px',
        'claw-height': '25px',
        'claw-width': '60px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
