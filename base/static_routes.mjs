import config from './config.mjs'

export default class StaticRoutes {
  constructor(opts = {}) {
    Object.assign(this, { })
  }

  register(server) {
    server.flaska.get('/api/health', this.health.bind(this))
  }

  health(ctx) {
    ctx.body = {
      environment: config.get('NODE_ENV'),
    }
  }
}
