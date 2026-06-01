/** @type {import('tailwindcss').Config} */

export default {

  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  theme: {

    extend: {

      colors: {

        primary: '#266b1c',

        background: '#F8FAF8',

        card: '#FFFFFF',

        foreground: '#020617',

        surface: '#e8f2e6',

        border: 'rgba(38, 107, 28, 0.24)',

        ink: '#020617',

        muted: '#475569',

        danger: '#266b1c',

        warning: '#2f7d24',

        success: '#2f7d24',

        info: '#266b1c',

        emerald: {
          50: '#e8f2e6',
          100: '#cfe5cb',
          200: '#b8d9b2',
          300: '#9acb92',
          400: '#76b86c',
          500: '#3a912d',
          600: '#2f7d24',
          700: '#266b1c',
          800: '#266b1c',
          900: '#1f5516',
          950: '#1a4712',
          primary: '#266b1c',
          fresh: '#2f7d24',
          mint: '#3a912d',
          sage: '#cfe5cb',
          surface: '#e8f2e6',
          dark: '#266b1c',
        },

        green: {
          50: '#e8f2e6',
          100: '#cfe5cb',
          200: '#b8d9b2',
          300: '#9acb92',
          400: '#76b86c',
          500: '#3a912d',
          600: '#2f7d24',
          700: '#266b1c',
          800: '#266b1c',
          900: '#1f5516',
          950: '#1a4712',
        },

        brand: {

          white: '#FFFFFF',

          soft: '#F8FAF8',

        },

      },

      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"San Francisco"', 'Segoe UI', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"San Francisco"', 'Segoe UI', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
        heading: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"San Francisco"', 'Segoe UI', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"San Francisco"', 'Segoe UI', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      boxShadow: {

        card: '0 1px 2px rgba(38, 107, 28, 0.04), 0 4px 16px -4px rgba(38, 107, 28, 0.08)',

        glass: '0 1px 2px rgba(38, 107, 28, 0.04), 0 8px 24px -8px rgba(38, 107, 28, 0.1)',

        'glass-lg': '0 8px 32px -8px rgba(38, 107, 28, 0.14), 0 2px 8px rgba(38, 107, 28, 0.04)',

        emerald: '0 4px 20px -4px rgba(38, 107, 28, 0.25)',

      },

      backgroundImage: {

        'emerald-gradient': 'linear-gradient(135deg, #266b1c 0%, #2f7d24 50%, #3a912d 100%)',

        'emerald-soft': 'linear-gradient(180deg, #FFFFFF 0%, #e8f2e6 100%)',

        'emerald-radial': 'radial-gradient(circle at top right, rgba(38, 107, 28, 0.15), transparent 55%)',

      },

      transitionDuration: {

        DEFAULT: '200ms',

      },

      transitionTimingFunction: {

        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',

      },

      keyframes: {

        fadeIn: {

          '0%': { opacity: '0' },

          '100%': { opacity: '1' },

        },

        emeraldPulse: {

          '0%, 100%': { boxShadow: '0 0 0 0 rgba(38, 107, 28, 0.2)' },

          '50%': { boxShadow: '0 0 0 6px rgba(168, 212, 160, 0.15)' },

        },

      },

      animation: {

        fadeIn: 'fadeIn 0.3s ease-in-out',

        'emerald-pulse': 'emeraldPulse 2.5s ease-in-out infinite',

      },

    },

  },

  plugins: [],

}

