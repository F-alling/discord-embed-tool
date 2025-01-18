
import config from '../base/config.mjs'
import Parent from '../base/server.mjs'
import StaticRoutes from '../base/static_routes.mjs'
import IndexPost from './post.mjs'
import ServeHandler from './serve.mjs'

export default class Server extends Parent {
  init() {
    super.init()
    let localUtil = new this.core.sc.Util(import.meta.url)

    this.flaskaOptions.appendHeaders['Content-Security-Policy'] = `default-src 'self'; script-src 'self' 'nonce-0d1valZOnjp8ZpR6vBd4dg=='; style-src 'self' 'unsafe-inline'; img-src * data: blob:; media-src *; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'`
    this.flaskaOptions.appendHeaders['Cross-Origin-Embedder-Policy'] = 'unsafe-none'
  }
}
