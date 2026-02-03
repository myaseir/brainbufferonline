/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // This tells Next.js that Cloudinary is a trusted source
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**', // This allows all images from your Cloudinary account
      },
    ],
  },
};

export default nextConfig;