import path from 'path'
import dot from 'dot'
import { FileResponse, HttpError } from 'flaska'
import fs from 'fs/promises'
import fsSync from 'fs'
import { RankLevels, verifyValidToken } from './authentication/security.mjs'

export default class ServeHandler {
  constructor(opts = {}) {
    Object.assign(this, opts)
    if (!opts.fs) {
      this.fs = fs
    }
    if (!opts.fsSync) {
      this.fsSync = fsSync
    }
    if (!opts.frontend) {
      this.frontend = 'http://localhost:4000'
    }
    if (!opts.version) {
      this.version = 'version'
    }

    let indexFile = fsSync.readFileSync(path.join(this.root, 'index.html'))
    this.loadTemplate(indexFile)
  }

  loadTemplate(indexFile) {
    this.template = dot.template(indexFile.toString(), { argName: ['headerDescription', 'headerImage', 'headerTitle', 'headerUrl', 'payloadData', 'payloadTree', 'version', 'nonce', 'type', 'banner', 'media', 'in_debug'] })
  }

  register(server) {
    server.flaska.get('/::file', this.serve.bind(this))
  }

  /** GET: /::file */
  serve(ctx) {
    if (ctx.params.file.startsWith('api/')) {
      return this.serveIndex(ctx)
    }

    let file = path.resolve(path.join(this.root, ctx.params.file ? ctx.params.file : 'index.html'))

    if (!ctx.params.file
        || ctx.params.file === 'index.html'
        || ctx.params.file.startsWith('/page')
        || ctx.params.file.startsWith('/article')
        || ctx.params.file.startsWith('/admin')) {
      return this.serveIndex(ctx)
    }

    if (!file.startsWith(this.root)) {
      return this.serveIndex(ctx)
    }

    if (file.indexOf('admin') >= 0
        && (file.indexOf('.js') >= 0 || file.indexOf('.css') >= 0)) {
      verifyValidToken((ctx.query.get('token') || '').split('.'), RankLevels.Manager)
    }

    return this.fs.stat(file)
    .then(function(stat) {
      if (file.indexOf('admin') === -1) {
        ctx.headers['Cache-Control'] = 'max-age=2592000'
      } else {
        ctx.headers['Cache-Control'] = 'no-store'
      }
      ctx.body = new FileResponse(file, stat)
    })
    .catch((err) => {
      if (err.code === 'ENOENT') {
        return this.serveIndex(ctx)
      }
      return Promise.reject(err)
    })
  }
 
  async serveIndex(ctx) {
    ctx.body = this.template({})
    ctx.type = 'text/html; charset=utf-8'
  }

  serveErrorPage(ctx) { 

  }
}