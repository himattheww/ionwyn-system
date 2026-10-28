import { spawn } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { config } from '../config.ts';
import { GARMIN_HOME } from './client.ts';

fs.mkdirSync(config.garminProfileDir, { recursive: true });

const browser = spawn(
  config.garminBrowserPath,
  [`--user-data-dir=${config.garminProfileDir}`, '--no-first-run', '--no-default-browser-check', '--new-window', GARMIN_HOME],
  { stdio: 'ignore' },
);
const closed = new Promise<void>((resolve) => browser.on('exit', () => resolve()));
browser.on('error', (error) => {
  console.error(`Browser tidak bisa dibuka (${config.garminBrowserPath}): ${error.message}`);
  process.exit(1);
});

console.log('Login ke Garmin Connect di jendela browser yang terbuka, termasuk MFA kalau diminta.');
console.log('Setelah dashboard Garmin tampil, tekan Enter di sini untuk menyimpan sesi dan menutup browser itu.');

const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
await Promise.race([prompt.question(''), closed]);
prompt.close();

if (browser.exitCode === null) {
  browser.kill('SIGTERM');
  await closed;
}
console.log('Sesi tersimpan. Tekan "Sinkron sekarang" di aplikasi.');
