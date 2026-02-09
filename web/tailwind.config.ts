import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        protein: '#f97316',
        dairy: '#38bdf8',
        produce: '#22c55e',
        pantry: '#facc15',
        other: '#a78bfa'
      },
      boxShadow: {
        bubble: '0 6px 14px rgba(15, 23, 42, 0.14)'
      }
    }
  },
  plugins: []
};

export default config;
