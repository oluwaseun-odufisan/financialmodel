/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: '#312783', 50:'#EEEBF5', 100:'#D4CCE8', 900:'#1F185A' },
        accent:   { DEFAULT: '#36a9e1', 50:'#E9F6FC', 100:'#C8E9F7', 900:'#1F6A8E' },
        offwhite: '#f8f9fa',
        ink:      '#111827',
        muted:    '#6b7280',
        border:   '#E5E7EB',
      },
      fontFamily: {
        sans: ['Aptos', 'Segoe UI', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        xs:  ['0.75rem',  '1rem'],
        sm:  ['0.875rem', '1.25rem'],
        base:['0.9375rem','1.4rem'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(17,24,39,0.05)',
      },
    },
  },
  plugins: [],
};
