import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '../..');
const fromRoot = (p: string) => path.resolve(rootDir, p);

const DEFAULT_CHROME: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
};

export const config = {
  rootDir,
  port: Number(process.env.PORT ?? 3000),
  host: process.env.ALLOW_LAN === 'true' ? '0.0.0.0' : '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL ?? '',
  garminSyncEnabled: process.env.GARMIN_SYNC !== 'false' && !process.env.VERCEL,
  garminProfileDir: fromRoot(process.env.GARMIN_PROFILE_DIR ?? '.garmin-profile'),
  garminHeadless: process.env.GARMIN_HEADLESS !== 'false',
  garminBrowserPath: process.env.GARMIN_BROWSER_PATH || DEFAULT_CHROME[process.platform] || 'google-chrome',
  targetLongRunKm: Number(process.env.TARGET_LONG_RUN_KM ?? 21),
  webDist: path.join(rootDir, 'web/dist'),
};
