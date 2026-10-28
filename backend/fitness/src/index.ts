import { createApp } from './app.ts';
import { config } from './config.ts';
import { openDb } from './db.ts';
import { syncIfStale } from './garmin/sync.ts';

if (!config.databaseUrl) throw new Error('DATABASE_URL belum diisi. Isi di .env root ionwyn-system.');

const db = openDb();
const app = createApp(db, config.webDist);

app.listen(config.port, config.host, (error) => {
  if (error) {
    const inUse = (error as NodeJS.ErrnoException).code === 'EADDRINUSE';
    console.error(inUse ? `Port ${config.port} sudah dipakai. Server Fitness Track mungkin sudah jalan di tab terminal lain.` : error);
    process.exit(1);
  }
  console.log(`Fitness Track jalan di http://${config.host}:${config.port}`);
  if (config.garminSyncEnabled) syncIfStale(db).catch((e) => console.error('Sinkron gagal:', e));
});
