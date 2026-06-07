import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Premium Dark Palette – Vibrant Gradients
        dark: {
          bg: '#0f0f23',
          bgAlt: '#1a1a2e',
          surface: '#16213e',
          surfaceLight: '#0f3460',
        },
        accent: {
          pink: '#ff1493',
          purple: '#9c27b0',
          orange: '#ff8c00',
          coral: '#ff6b6b',
          cyan: '#00d9ff',
          teal: '#00e5cc',
        },
        // Legacy oceanic palette (kept for compatibility)
        mint: {
          100: '#A4F4C9',
          200: '#7EEDB0',
          300: '#5CE89B',
        },
        teal: {
          400: '#6EB498',
          600: '#3A8A7A',
          700: '#1A5A63',
          800: '#0F3D47',
        },
        navy: {
          900: '#0D3B66',
          950: '#082848',
        },
        // Semantic shortcuts mapped to CSS vars
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        border: 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'brand-gradient': 'linear-gradient(135deg, #ff1493 0%, #9c27b0 100%)',
        'gradient-orange': 'linear-gradient(135deg, #ff8c00 0%, #ff6b6b 100%)',
        'gradient-cyan': 'linear-gradient(135deg, #00d9ff 0%, #00e5cc 100%)',
        'bg-premium': 'radial-gradient(circle at 50% 50%, #0f3460 0%, #0f0f23 100%)',
      },
      boxShadow: {
        'glow-pink': '0 0 20px rgba(255, 20, 147, 0.4)',
        'glow-pink-lg': '0 0 40px rgba(255, 20, 147, 0.5)',
        'glow-purple': '0 0 20px rgba(156, 39, 176, 0.4)',
        'glow-orange': '0 0 20px rgba(255, 140, 0, 0.4)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 8s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
