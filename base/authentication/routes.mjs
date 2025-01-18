import crypto from 'crypto'
import * as util from '../util.mjs'
import config from '../config.mjs'

export default class AuthenticationRoutes {
  constructor(opts = {}) {
    Object.assign(this, {
      secret: config.get('jwtsecret'),
      crypto: crypto,
      util: util,
    })
  }

  register(server) {
    server.flaska.post('/api/authentication/login', server.jsonHandler(), this.login.bind(this))
  }

  /** GET: /api/authentication/login */
  async login(ctx) {
    let res = await ctx.db.safeCallProc('auth_login', [
      ctx.req.body.email || '',
      ctx.req.body.password || '',
    ])

    let out = res.results[0][0]

    const hmac = this.crypto.createHmac('sha256', this.secret)
    hmac.update(out.token)
    let apiSignature = this.util.encode(hmac.digest())
    out.token = out.token + '.' + apiSignature

    ctx.body = out
  }
}
