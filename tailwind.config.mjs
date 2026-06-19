/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 暗黑科技风配色
        bg: {
          DEFAULT: '#0a0e14',
          soft: '#0f1620',
          card: '#121a26',
        },
        accent: {
          DEFAULT: '#22d3ee', // 霓虹青
          green: '#4ade80',
          glow: '#06b6d4',
        },
        ink: {
          DEFAULT: '#e2e8f0',
          dim: '#94a3b8',
          faint: '#64748b',
        },
        line: '#1e293b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(34, 211, 238, 0.35)',
        'glow-sm': '0 0 12px -2px rgba(34, 211, 238, 0.25)',
      },
    },
  },
  plugins: [],
};
