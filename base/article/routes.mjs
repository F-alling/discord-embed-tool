import { parseArticles, parseArticle } from './util.mjs'
import { uploadMedia, uploadFile, deleteFile } from '../media/upload.mjs'
import { mediaToDatabase } from '../media/util.mjs'

export default class ArticleRoutes {
  constructor(opts = {}) {
    Object.assign(this, {
      uploadMedia: uploadMedia,
      uploadFile: uploadFile,
      deleteFile: deleteFile,
      requireAuth: opts.requireAuth,
    })
  }

  register(server) {
    if (!this.requireAuth) {
      server.flaska.get('/api/articles/:path', this.getArticle.bind(this))
    }
    server.flaska.get('/api/auth/articles', server.authenticate(), this.auth_getAllArticles.bind(this))
    server.flaska.get('/api/auth/articles/:id', server.authenticate(), this.auth_getSingleArticle.bind(this))
    server.flaska.put('/api/auth/articles/:id', [
      server.authenticate(),
      server.formidable({ maxFileSize: 20 * 1024 * 1024, }),
    ], this.auth_updateCreateSingleArticle.bind(this))
    server.flaska.delete('/api/auth/articles/:id', server.authenticate(), this.auth_removeSingleArticle.bind(this))
  }

  /** GET: /api/articles/[path] */
  async getArticle(ctx, onlyReturn = false) {
    let res = await ctx.db.safeCallProc('article_get_single', [ctx.params.path])
    
    if (onlyReturn) {
      return this.getArticle_resOutput(res)
    }

    ctx.body = this.getArticle_resOutput(res)
  }

  getArticle_resOutput(res) {
    return {
      article: parseArticle(res.results[0][0]),
    }
  }

  /** GET: /api/auth/articles */
  async auth_getAllArticles(ctx) {
    let res = await ctx.db.safeCallProc('article_auth_get_all', [
      ctx.state.auth_token,
      Math.max(ctx.query.get('page') || 1, 1),
      Math.min(ctx.query.get('per_page') || 20, 100)
    ])

    let out = {
      articles: parseArticles(res.results[0]),
      total_articles: res.results[1][0].total_articles,
    }
    
    ctx.body = out
  }

  async private_getUpdateArticle(ctx, body = null, banner = null, media = null) {
    let params = [
      ctx.state.auth_token,
      ctx.params.id === '0' ? null : ctx.params.id
    ]
    if (body) {
      params = params.concat([
        body.name,
        body.page_id === 'null' ? null : Number(body.page_id),
        body.path,
        body.content,
        new Date(body.publish_at),
        Number(body.admin_id),
        body.is_featured === 'true' ? 1 : 0,
        0,
      ])
      params = params.concat(mediaToDatabase(banner, body.remove_banner === 'true'))
      params = params.concat(mediaToDatabase(media, body.remove_media === 'true'))
    }

    let res = await ctx.db.safeCallProc('article_auth_get_update_create', params)

    ctx.body = this.private_getUpdateArticle_resOutput(res)
  }

  private_getUpdateArticle_resOutput(res) {
    return {
      article: parseArticle(res.results[0][0] || {}),
      staff: res.results[1],
    }
  }

  /** GET: /api/auth/articles/:id */
  auth_getSingleArticle(ctx) {
    return this.private_getUpdateArticle(ctx)
  }

  /** PUT: /api/auth/articles/:id */
  async auth_updateCreateSingleArticle(ctx) {
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

    if (ctx.req.body.media && ctx.req.body.media.filename && ctx.req.body.media.type && ctx.req.body.media.path && ctx.req.body.media.size) {
      newMedia = ctx.req.body.media
    }

    await Promise.all(promises)

    return this.private_getUpdateArticle(ctx, ctx.req.body, newBanner, newMedia)
  }

  /** DELETE: /api/auth/articles/:id */
  async auth_removeSingleArticle(ctx) {
    let params = [
      ctx.state.auth_token,
      ctx.params.id,
      // Article data
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      1,
    ]
    params = params.concat(mediaToDatabase(null, true))
    params = params.concat(mediaToDatabase(null, true))

    await ctx.db.safeCallProc('article_auth_get_update_create', params)

    ctx.status = 204
  }
}
