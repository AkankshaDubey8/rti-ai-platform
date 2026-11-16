/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
const scale = (p) => Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, v(`${p}-${k}`)]));
export default {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: scale('navy'), // CSS-variable scale: flips automatically in dark mode
        brand: { 50: '#EEF4FF', 100: '#DCE8FF', 200: '#BCD2FF', 300: '#8CB0FF', 400: '#5A8AF5', 500: '#3A6BE8', 600: '#2754D1', 700: '#1F43A8', 800: '#1B3886', 900: '#172F6B' }, // royal blue (fixed)
        ink: '#0A1B38', surface: v('surface'), mist: v('mist'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'], display: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 1px 2px rgba(10,27,56,.05), 0 8px 24px -12px rgba(10,27,56,.14)' },
    },
  },
  plugins: [],
};
