import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',            // Allow everything starting from Home
      disallow: [
        '/api/',             // Don't crawl backend
        '/_next/',           // Don't crawl Next.js internal files
        '/static/',          // Don't crawl raw assets
      ],
    },
    sitemap: 'https://www.brainbufferofficial.com/sitemap.xml',
  };
}