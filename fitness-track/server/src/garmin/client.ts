import fs from 'node:fs';
import type { BrowserContext, Page } from 'playwright';
import { config } from '../config.ts';

export const GARMIN_HOME = 'https://connect.garmin.com/app/home';
export const LOGIN_MESSAGE = 'Perlu login ulang: jalankan npm run garmin:login';

export class NeedLoginError extends Error {
  constructor(detail?: string) {
    super(detail ? `${LOGIN_MESSAGE} (${detail})` : LOGIN_MESSAGE);
  }
}

const SKIPPED_HEADERS = new Set([
  'cookie', 'host', 'content-length', 'content-type', 'accept-encoding', 'connection',
  'user-agent', 'referer', 'origin', 'priority',
]);

async function openGarminContext() {
  const { chromium } = await import('playwright');
  return chromium.launchPersistentContext(config.garminProfileDir, {
    executablePath: config.garminBrowserPath,
    headless: config.garminHeadless,
    ignoreDefaultArgs: ['--enable-automation', '--use-mock-keychain', '--password-store=basic'],
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
    viewport: { width: 1280, height: 900 },
  });
}

async function openGarminPage(context: BrowserContext) {
  const page = await context.newPage();
  try {
    await page.goto(GARMIN_HOME, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    if (!String(error).includes('ERR_ABORTED')) throw error;
    await page.goto(GARMIN_HOME, { waitUntil: 'domcontentloaded' });
  }
  return page;
}

export class GarminSession {
  private context: BrowserContext;
  private page: Page;
  private headers: Record<string, string>;
  private apiBase: string;

  private constructor(context: BrowserContext, page: Page, apiBase: string, headers: Record<string, string>) {
    this.context = context;
    this.page = page;
    this.apiBase = apiBase;
    this.headers = headers;
  }

  static async open() {
    if (!fs.existsSync(config.garminProfileDir) || !fs.readdirSync(config.garminProfileDir).length) {
      throw new NeedLoginError('profil browser belum ada');
    }
    const context = await openGarminContext();
    try {
      const apiRequest = context.waitForEvent('request', {
        predicate: (r) => r.url().includes('/gc-api/'),
        timeout: 45_000,
      });
      const page = await openGarminPage(context);
      const request = await apiRequest.catch(() => null);
      if (!request || /sso\.garmin\.com|signin/i.test(page.url())) {
        throw new NeedLoginError('sesi Garmin tidak aktif');
      }
      const apiBase = request.url().slice(0, request.url().indexOf('/gc-api/') + '/gc-api'.length);
      const headers = Object.fromEntries(
        Object.entries(await request.allHeaders()).filter(
          ([key]) => !key.startsWith(':') && !key.startsWith('sec-') && !SKIPPED_HEADERS.has(key),
        ),
      );
      return new GarminSession(context, page, apiBase, headers);
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  async get(path: string): Promise<unknown> {
    const result = await this.page.evaluate(
      async ({ url, headers }) => {
        const res = await fetch(url, { headers, credentials: 'include' });
        return { status: res.status, body: await res.text() };
      },
      { url: this.apiBase + path, headers: this.headers },
    );
    if (result.status === 401 || result.status === 403) throw new NeedLoginError(`HTTP ${result.status}`);
    if (result.status === 204 || !result.body) return null;
    if (result.status >= 400) throw new Error(`Garmin ${path} HTTP ${result.status}`);
    return JSON.parse(result.body);
  }

  close() {
    return this.context.close();
  }
}
