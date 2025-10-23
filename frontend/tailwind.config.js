/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        bounce: 'bounce 1s infinite',
      },
      colors: {
        trendpup: {
          primary: '#2563eb',      // Blue
          secondary: '#64748b',    // Slate
          accent: '#0ea5e9',       // Sky blue
          neutral: '#f8fafc',      // Light gray
          dark: '#0f172a',         // Dark slate
          light: '#ffffff',        // White
          success: '#10b981',      // Green
          warning: '#f59e0b',      // Amber
          error: '#ef4444',        // Red
        },
      },
    },
  },
  plugins: [],
} 