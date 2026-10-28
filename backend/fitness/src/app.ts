import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Db } from './db.ts';
import { apiRouter } from './api.ts';

export function createApp(db: Db, webDist?: string) {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter(db));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

  if (webDist && fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
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
  return app;
}
