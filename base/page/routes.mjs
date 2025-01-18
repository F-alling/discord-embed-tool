import { parsePage, parsePages, parsePagesToTree } from './util.mjs'
import { uploadMedia, uploadFile } from '../media/upload.mjs'
import { parseArticle, parseArticles } from '../article/util.mjs'
import { mediaToDatabase } from '../media/util.mjs'


export default class PageRoutes {
  constructor(opts = {}) {
    Object.assign(this, {
      uploadMedia: uploadMedia,
      uploadFile: uploadFile,
    })
  }

  register(server) {
    server.flaska.get('/api/pagetree', this.getPageTree.bind(this))
    server.flaska.get('/api/frontpage', this.getPage.bind(this))
    server.flaska.get('/api/pages/:path', this.getPage.bind(this))
    server.flaska.get('/api/auth/pages', server.authenticate(), this.auth_getAllPages.bind(this))
    server.flaska.get('/api/auth/pages/:id', server.authenticate(), this.auth_getSinglePage.bind(this))
    server.flaska.put('/api/auth/pages/:id', [
      server.authenticate(),
      server.formidable({ maxFileSize: 20 * 1024 * 1024, }),
    ], this.auth_updateCreateSinglePage.bind(this))
    server.flaska.delete('/api/auth/pages/:id', server.authenticate(), this.auth_removeSinglePage.bind(this))
  }

  /** GET: /api/pagetree */
  async getPageTree(ctx, onlyReturn = false) {
    let res = await ctx.db.safeCallProc('pages_get_tree', [])

    if (onlyReturn) {
      return parsePagesToTree(res.first)
    }
    ctx.body = parsePagesToTree(res.first)
  }

  /** GET: /api/pages/[path] */
  async getPage(ctx, onlyReturn = false) {
    let res = await ctx.db.safeCallProc('pages_get_single', [
      ctx.params.path || null,
      Math.max(ctx.query.get('page') || 1, 1),
      Math.min(ctx.query.get('per_page') || 10, 25),
    ])

    if (onlyReturn) {
      return this.getPage_resOut(res)
    }

    ctx.body = this.getPage_resOut(res)
  }

  getPage_resOut(res) {
    return {
      page: parsePage(res.results[0][0]),
      articles: parseArticles(res.results[1]),
      total_articles: res.results[2][0].total_articles,
      featured: parseArticle(res.results[4][0]),
    }
  }

  /** GET: /api/auth/pages */
  async auth_getAllPages(ctx) {
    let res = await ctx.db.safeCallProc('pages_auth_get_all', [
      ctx.state.auth_token
    ])
    
    ctx.body = parsePagesToTree(parsePages(res.first))
  }

  async private_getUpdatePage(ctx, body = null, banner = null, media = null) {
    let params = [
      ctx.state.auth_token,
      ctx.params.id === '0' ? null : ctx.params.id
    ]
    if (body) {
      params = params.concat([
        body.name,
        body.parent_id === 'null' ? null : Number(body.parent_id),
        body.path,
        body.content,
        0,
      ])
      params = params.concat(mediaToDatabase(banner, body.remove_banner === 'true'))
      params = params.concat(mediaToDatabase(media, body.remove_media === 'true'))
    }
    let res = await ctx.db.safeCallProc('pages_auth_get_update_create', params)

    let out = {
      page: parsePage(res.results[0][0] || {}),
    }

    ctx.body = out
  }

  
  /** GET: /api/auth/pages/:id */
  auth_getSinglePage(ctx) {
    return this.private_getUpdatePage(ctx)
  }

  /** PUT: /api/auth/pages/:id */
  async auth_updateCreateSinglePage(ctx) {
    let newBanner = null
    let newMedia = null

    let promises = []

    if (ctx.req.files.banner) {
      promises.push(
        this.uploadMedia(ctx.req.files.banner)
          .then(res => { newBanner = res })
      )
    }
    if (ctx.req.files.media) {
      promises.push(
        this.uploadMedia(ctx.req.files.media)
          .then(res => { newMedia = res })
      )
    }

    await Promise.all(promises)

    return this.private_getUpdatePage(ctx, ctx.req.body, newBanner, newMedia)
  }

  /** DELETE: /api/auth/pages/:id */
  async auth_removeSinglePage(ctx) {
    let params = [
      ctx.state.auth_token,
      ctx.params.id,
      // Page data
      null,
      null,
      null,
      null,
      1,
    ]
    params = params.concat(mediaToDatabase(null, true))
    params = params.concat(mediaToDatabase(null, true))

    await ctx.db.safeCallProc('pages_auth_get_update_create', params)

    ctx.status = 204
  }
}
