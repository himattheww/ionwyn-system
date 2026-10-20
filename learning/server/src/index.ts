import { createApp } from './app.js'
import { env } from './env.js'

createApp().listen(env.PORT, '127.0.0.1', () => console.log(`API jalan di http://localhost:${env.PORT}`))
