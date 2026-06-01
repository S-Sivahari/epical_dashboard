/** @type {import('tailwindcss').Config} */

export default {

  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  theme: {

    extend: {

      colors: {

        primary: '#166534',

        background: '#F8FAF8',

        card: '#FFFFFF',

        foreground: '#020617',

        surface: '#DCFCE7',

        border: 'rgba(22, 163, 74, 0.24)',

        ink: '#020617',

        muted: '#475569',

        danger: '#166534',

        warning: '#15803D',

        success: '#15803D',

        info: '#166534',

        emerald: {

          primary: '#166534',

          fresh: '#15803D',

          mint: '#16A34A',

          sage: '#BBF7D0',

          surface: '#DCFCE7',

          dark: '#14532D',

        },

        brand: {

          white: '#FFFFFF',

          soft: '#F8FAF8',

        },

      },

      fontFamily: {

        display: ['"Inter"', '"DM Sans"', 'system-ui', 'sans-serif'],

        heading: ['"Inter"', '"DM Sans"', 'system-ui', 'sans-serif'],

        body: ['"DM Sans"', '"Inter"', 'system-ui', 'sans-serif'],

        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],

      },

      boxShadow: {

        card: '0 1px 2px rgba(22, 101, 52, 0.04), 0 4px 16px -4px rgba(22, 163, 74, 0.08)',

        glass: '0 1px 2px rgba(22, 163, 74, 0.04), 0 8px 24px -8px rgba(22, 163, 74, 0.1)',

        'glass-lg': '0 8px 32px -8px rgba(22, 163, 74, 0.14), 0 2px 8px rgba(22, 101, 52, 0.04)',

        emerald: '0 4px 20px -4px rgba(22, 163, 74, 0.25)',

      },

      backgroundImage: {

        'emerald-gradient': 'linear-gradient(135deg, #166534 0%, #15803D 50%, #16A34A 100%)',

        'emerald-soft': 'linear-gradient(180deg, #FFFFFF 0%, #DCFCE7 100%)',

        'emerald-radial': 'radial-gradient(circle at top right, rgba(22, 163, 74, 0.15), transparent 55%)',

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

          '0%, 100%': { boxShadow: '0 0 0 0 rgba(22, 163, 74, 0.2)' },

          '50%': { boxShadow: '0 0 0 6px rgba(134, 239, 172, 0.15)' },

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

