import { join } from 'node:path'
import { buildApp } from './app.mjs'
import { loadHome } from '../lib/home.mjs'

const home = loadHome()
const app = await buildApp({ dataDir: home.dataDir, token: home.token, webDist: join(home.engineDir, 'web/dist'), logger: true, config: home.config })
await app.listen({ host: '0.0.0.0', port: home.port })
