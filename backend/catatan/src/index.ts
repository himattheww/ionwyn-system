import { networkInterfaces } from 'node:os'
import { createApp } from './app.js'
import { config } from './config.js'
import { connect } from './db.js'

const app = createApp(connect(config.databaseUrl), config.webDist)

app.listen(config.port, config.host, () => {
  console.log(`Catatan Malam jalan di http://localhost:${config.port}`)
  if (config.host !== '0.0.0.0') return
  for (const net of Object.values(networkInterfaces()).flat()) {
    if (net && net.family === 'IPv4' && !net.internal) console.log(`Dari HP: http://${net.address}:${config.port}`)
  }
})
