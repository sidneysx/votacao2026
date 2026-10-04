import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import handler from "./api/tse.js";

// Em desenvolvimento, /api/tse usa o mesmo código do proxy da Vercel.
const tseDevProxy = {
  name: "tse-dev-proxy",
  configureServer(server) {
    server.middlewares.use("/api/tse", (req, res) => {
      const u = new URL(req.url, "http://localhost");
      req.query = { path: u.pathname.slice(1), env: u.searchParams.get("env") };
      handler(req, res);
    });
  },
};

export default defineConfig({ plugins: [react(), tailwindcss(), tseDevProxy] });
