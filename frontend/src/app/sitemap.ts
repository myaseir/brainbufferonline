import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.brainbufferofficial.com';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily', // 🚀 Better for dynamic game apps
      priority: 1.0,
    },
    {
      url: `${baseUrl}/leaderboard`, // 🏆 Helps your top players get indexed
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: '2026-02-08', // 📅 Better to use the actual last edit date
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: '2026-02-08',
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}