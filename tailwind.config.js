/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Avi's Food Corner brand — warm, appetising, restrained.
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        // Primary action / header red (tandoori)
        tandoori: {
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
        },
        // Green used ONLY as a vegetarian indicator / supporting accent.
        veg: {
          500: '#16a34a',
          600: '#15803d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      // Large, comfortable touch targets.
      minHeight: {
        touch: '3.5rem',
      },
    },
  },
  plugins: [],
};
