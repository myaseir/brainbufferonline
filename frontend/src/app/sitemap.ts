import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.brainbufferofficial.com';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'always', // Tells Google this page is dynamic and high-priority
      priority: 1.0,           // Absolute highest priority
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,           // Lower priority so it doesn't compete with Home
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,           // Lower priority
    },
  ];
}