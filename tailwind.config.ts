import type { Config } from "tailwindcss";
// Bảng màu lấy từ bộ 93 ảnh giao diện (Lo_01–Lo_10): nền ấm #F9F8F6, cam HULAKO #FA6803, chữ gần đen.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#FA6803", dark: "#D85500", soft: "#FFEEDF", tint: "#FFF6EE" },
        ink: { DEFAULT: "#111111", soft: "#3F3F3F", muted: "#6B6B6B" },
        paper: "#F9F8F6",
        line: "#E6E3DF",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      borderRadius: { card: "14px" },
      boxShadow: { card: "0 1px 2px rgba(17,17,17,.04), 0 2px 10px rgba(17,17,17,.04)" },
    },
  },
  plugins: [],
} satisfies Config;
