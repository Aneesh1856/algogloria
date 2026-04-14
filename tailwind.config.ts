import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        amity: {
          navy: "#002D62", // Primary Navy
          yellow: "#FFC300", // Accent Yellow
          yellowHover: "#e6b300",
          cardBg: "#ffffff",
          pageBg: "#e0e0e0",
          textDark: "#333333",
          danger: "#dc3545",
          success: "#28a745",
          activeBg: "#d4edda",
          activeText: "#155724",
          inactiveBg: "#f8d7da",
          inactiveText: "#721c24",
          border: "#e9ecef",
        },
      },
      boxShadow: {
        'amity': '0 4px 20px rgba(0,0,0,0.15)',
        'nav': '0 2px 5px rgba(0,0,0,0.2)',
      },
      borderRadius: {
        'none': '0px',
        'btn': '10px',
        'pill': '50px',
      },
      fontFamily: {
        montserrat: ['var(--font-montserrat)', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;



