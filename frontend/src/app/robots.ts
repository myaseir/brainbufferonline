import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'Googlebot-Image', // Explicitly allow image crawling
        allow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
         
        ],
      },
    ],
    sitemap: 'https://www.brainbufferofficial.com/sitemap.xml',
  };
}