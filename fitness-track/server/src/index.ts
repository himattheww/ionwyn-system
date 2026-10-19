import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { config } from './config.ts';
import { openDb } from './db.ts';
import { apiRouter } from './api.ts';
import { backupIfStale } from './backup.ts';
import { syncIfStale } from './garmin/sync.ts';

const db = openDb();
const app = express();

app.use(express.json());
app.use('/api', apiRouter(db));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

if (fs.existsSync(config.webDist)) {
  app.use(express.static(config.webDist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(config.webDist, 'index.html')));
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Input tidak valid', issues: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    return;
  }
  if (err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ error: 'Request tidak valid' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server' });
};
app.use(errorHandler);

const runBackup = () => backupIfStale(db).catch((e) => console.error('Backup gagal:', e));
await runBackup();
setInterval(runBackup, 60 * 60 * 1000);

app.listen(config.port, config.host, (error) => {
  if (error) {
    const inUse = (error as NodeJS.ErrnoException).code === 'EADDRINUSE';
    console.error(inUse ? `Port ${config.port} sudah dipakai. Server Fitness Track mungkin sudah jalan di tab terminal lain.` : error);
    process.exit(1);
  }
  console.log(`Fitness Track jalan di http://${config.host}:${config.port}`);
  syncIfStale(db);
});
