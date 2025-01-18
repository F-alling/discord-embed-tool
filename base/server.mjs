import { Flaska, QueryHandler, JsonHandler, FormidableHandler, HttpError } from 'flaska'
import formidable from 'formidable'

import config from './config.mjs'
import PageRoutes from './page/routes.mjs'
import ArticleRoutes from './article/routes.mjs'
import AuthenticationRoutes from './authentication/routes.mjs'
import { authenticate } from './authentication/security.mjs'
import StaticRoutes from './static_routes.mjs'

export default class Server {
  constructor(http, port, core, opts = {}) {
    Object.assign(this, opts)
    this.http = http
    this.port = port
    this.core = core
    this.pool = null

    this.flaskaOptions = {
      appendHeaders: {
        'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src * data: blob:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'`,
      },
      log: this.core.log,
      nonce: ['script-src'],
      nonceCacheLength: 50,
    }
    this.authenticate = authenticate
    this.formidable = FormidableHandler.bind(this, formidable)
    this.jsonHandler = JsonHandler
    this.routes = {
      page: new PageRoutes(),
      article: new ArticleRoutes(),
      auth: new AuthenticationRoutes(),
      static: new StaticRoutes(),
    }

    this.init()
  }

  init() { }

  runCreateServer() {
    // Create our server
    this.flaska = new Flaska(this.flaskaOptions, this.http)

    // configure our server
    if (config.get('NODE_ENV') === 'development') {
      this.flaska.devMode()
    }

    this.flaska.onerror((err, ctx) => {
      if (err instanceof HttpError && err.status !== 500) {
        ctx.status = err.status
        ctx.log.warn(err.message)
      } else {
        ctx.log.error(err.inner || err)
        if (err.extra) {
          ctx.log.error({ extra: err.extra }, 'Database parameters')
        }
        ctx.status = 500
      }
      ctx.body = {
        status: ctx.status,
        message: err.message,
      }
    })

    this.flaska.before(function(ctx) {
      ctx.state.started = new Date().getTime()
      ctx.req.ip = ctx.req.headers['x-forwarded-for'] || ctx.req.connection.remoteAddress
      ctx.log = ctx.log.child({
        id: Math.random().toString(36).substring(2, 14),
      })
      ctx.db = this.pool
    }.bind(this))
    this.flaska.before(QueryHandler())
    
    let healthChecks = 0
    let healthCollectLimit = 60 * 60 * 12

    this.flaska.after(function(ctx) {
      if (ctx.aborted && ctx.status === 200) {
        ctx.status = 299
      }
      let ended = new Date().getTime()
      var requestTime = ended - ctx.state.started

      let status = ''
      let level = 'info'
      if (ctx.status >= 400) {
        status = ctx.status + ' '
        level = 'warn'
      }
      if (ctx.status >= 500) {
        level = 'error'
      }

      if (ctx.url === '/health' || ctx.url === '/api/health') {
        healthChecks++
        if (healthChecks >= healthCollectLimit) {
          ctx.log[level]({
            duration: Math.round(ended),
            status: ctx.status,
          }, `<-- ${status}${ctx.method} ${ctx.url} {has happened ${healthChecks} times}`)
          healthChecks = 0
        }
        return
      }

      ctx.log[level]({
        duration: requestTime,
        status: ctx.status,
        ip: ctx.req.ip,
      }, (ctx.aborted ? '[ABORT]' : '<--') + ` ${status}${ctx.method} ${ctx.url}`)
    })
  }

  runRegisterRoutes() {
    let keys = Object.keys(this.routes)
    for (let key of keys) {
      this.routes[key].register(this)
    }
  }

  runCreateDatabase() {
    return import('./db.mjs').then(db => {
      this.pool = db.initPool(this.core, config.get('mssql'))
    })
  }

  runStartListen() {
    return this.flaska.listenAsync(this.port).then(() => {
      this.core.log.info('Server is listening on port ' + this.port)
    })
  }

  run() {
    return Promise.all([
      this.runCreateServer(),
      this.runCreateDatabase(),
    ]).then(() => {
      return this.runRegisterRoutes()
    }).then(() => {
      return this.runStartListen()
    })
  }
}
