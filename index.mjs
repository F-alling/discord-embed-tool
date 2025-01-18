import fs from 'fs'
import { pathToFileURL } from 'url'
import config from './base/config.mjs'

export function start(http, port, ctx) {
  config.sources[1].store = ctx.config

  return import('./api/server.mjs')
  .then(function(module) {
    let server = new module.default(http, port, ctx)
    return server.run()
  })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  import('service-core').then(core => {
    const port = 4120

    var core = new core.ServiceCore('nfp_moe', import.meta.url, port, '')

    let config = {
      frontend: {
        url: 'http://localhost:' + port
      }
    }

    try {
      config = JSON.parse(fs.readFileSync('./config.json'))
    } catch {}

    config.port = port

    core.setConfig(config)
    core.init({ start }).then(function() {
      return core.run()
    })
  })
}
