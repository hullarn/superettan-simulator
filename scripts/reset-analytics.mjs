import { resetAnalyticsFile } from '../lib/analytics-store.ts';

const filePath = process.env.ANALYTICS_FILE_PATH;

if (!filePath || !filePath.startsWith('/')) {
  throw new Error(
    'ANALYTICS_FILE_PATH måste vara en absolut sökväg till statistikfilen.',
  );
}

await resetAnalyticsFile(filePath);
console.log('Statistiken är nollställd.');
