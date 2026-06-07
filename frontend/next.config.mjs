/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use a separate build dir when NEXT_DIST_DIR is set (the green gate sets it to
  // .next-build), so a production `next build` never clobbers a running `next dev`
  // (.next) cache — which otherwise causes "Cannot find module './NNN.js'".
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
