import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ink: '#18181b',
        mist: '#f7f7f8',
        lagoon: '#b91c1c',
        fern: '#34c759',
        marigold: '#ff9f0a',
        rosewood: '#b91c1c'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.07)'
      }
    }
  },
  plugins: [forms]
};
