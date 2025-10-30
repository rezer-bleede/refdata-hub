module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        midnight: '#0f172a',
        aurora: '#6366f1',
        neon: '#22d3ee',
        abyss: '#020617',
      },
      backgroundImage: {
        'cosmic-radial':
          'radial-gradient(circle at 15% 5%, rgba(99, 102, 241, 0.28), transparent 55%), radial-gradient(circle at 85% 0%, rgba(45, 212, 191, 0.22), transparent 45%), linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.78) 100%)',
        'nebula-panel': 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.72) 100%)',
        'sidebar-glow': 'linear-gradient(180deg, rgba(7, 11, 26, 0.98) 0%, rgba(11, 16, 35, 0.9) 100%)',
      },
      boxShadow: {
        'glow-sm': '0 12px 30px -16px rgba(99, 102, 241, 0.45)',
        'glow-md': '0 24px 60px -28px rgba(56, 189, 248, 0.38)',
        'inner-border': 'inset 0 0 0 1px rgba(148, 163, 184, 0.14)',
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
