/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 👈 Set to false to prevent double-rendering bugs
  output: 'export',       // Keep this for Capacitor
  images: {
    unoptimized: true,    // Keep this for static export
  },
}

export default nextConfig;