import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        solana: {
          purple: "#9945FF",
          green: "#14F195",
          dark: "#0B0B0F",
          darker: "#08080C",
          card: "#13111C",
          border: "#1E1A2E",
        },
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 3s infinite",
        "glow": "glow 4s ease-in-out infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        "grid-fade": "grid-fade 8s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "grid-fade": {
          "0%, 100%": { opacity: "0.03" },
          "50%": { opacity: "0.06" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
