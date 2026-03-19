/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Institutional accent — used only for primary actions, active nav, links
        accent: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Sidebar
        sidebar: {
          bg:     '#1E293B',
          hover:  '#293548',
          active: '#2563EB',
          text:   '#94A3B8',
          heading:'#F1F5F9',
        },
        // Surface
        surface: {
          page:   '#F8F9FA',
          card:   '#FFFFFF',
          border: '#E5E7EB',
        },
      },
      fontSize: {
        // Override base sizes to match design spec
        'page-title':    ['1.5rem',  { lineHeight: '1.3', fontWeight: '600' }],
        'section-title': ['1.125rem',{ lineHeight: '1.4', fontWeight: '600' }],
        'body':          ['0.9375rem',{ lineHeight: '1.6' }],
        'label':         ['0.8125rem',{ lineHeight: '1.5' }],
      },
      spacing: {
        // 8px grid
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}

