import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/main.js",
  platform: "browser",
  target: "es2020",
  format: "cjs",
  sourcemap: true,
});
