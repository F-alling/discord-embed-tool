import { uploadMedia, deleteFile } from '../base/media/upload.mjs'
import config from '../base/config.mjs'
import AlphabeticID from './id.mjs'

const ImageRegex = /\.(jpg|png|gif)(\?|$)/

export default class IndexPost {
  constructor(opts = {}) {
    Object.assign(this, {
      frontend: opts.frontend,
      uploadMedia: uploadMedia,
      deleteFile: deleteFile,
    })
  }

  register(server) {
    this.serve = server.routes.serve
    server.flaska.post('/', [
      server.formidable({ maxFileSize: 8 * 1024 * 1024, }),
    ], this.createNewLink.bind(this))
  }

  hasErrors(ctx, hasMedia) {
    if (!ctx.req.body.video) {
      return 'Missing video link'
    }

    if (!ctx.req.body.video.startsWith('http')) {
      return 'Video link has to be a valid full url'
    }

    if (ImageRegex.exec(ctx.req.body.video)) {
      return 'Image links are not gonna work, that is not how embedding video works. What are you even doing mate?'
    }

    if (ctx.req.body.width) {
      let n = Number(ctx.req.body.width)
      if (isNaN(n) || n < 10 || n > 5000) {
        return 'The video width does not look right'
      }
    }

    if (ctx.req.body.height) {
      let n = Number(ctx.req.body.height)
      if (isNaN(n) || n < 10 || n > 3000) {
        return 'The video height does not look right'
      }
    }
    
    if (ctx.req.body.image) {
      if (!ctx.req.body.image.startsWith('http')) {
        return 'Image link has to be a valid full url'
      }
    }
  }

  async getLink(ctx) {
    
    return this.serve.serveIndex(ctx)
  }

  /** POST: / */
  async createNewLink(ctx) {
    ctx.state.video = ctx.req.body.video
    ctx.state.image = ctx.req.body.image || 'https://cdn.nfp.is/av1/empty.png'
    ctx.state.width = ctx.req.body.width || null
    ctx.state.height = ctx.req.body.height || null

    let rateLimited = false
    let redisKey = 'ratelimit_' + ctx.req.ip.replace(/:/g, '-')

    try {
      let val = (await ctx.redis.get(redisKey))
      val = val && Number(val) || 0
      if (val > 3) {
        rateLimited = true
      } else if (val > 2) {
        await ctx.redis.setex(redisKey, 60 * 15, val + 1)
        rateLimited = true
      } else {
        await ctx.redis.setex(redisKey, 15, val + 1)
      }
    } catch (err) {
      ctx.log.error(err, 'Error checking rate limit for ' + redisKey)
    }

    if (rateLimited) {
      ctx.state.error = 'You have reached rate limit. Please wait at least 15 minutes.'
      return this.serve.serveIndex(ctx)
    }

    let hasMedia = ctx.req.files.media && ctx.req.files.media.size
    let redirect = ''
    let error = this.hasErrors(ctx, hasMedia)

    if (!error && hasMedia) {
      try {
        let temp = await this.uploadMedia(ctx.req.files.media)
        ctx.state.image = ctx.req.body.image = 'https://cdn.nfp.is' + temp.sizes.small.jpeg.path

        await this.deleteFile(temp.filename).catch(err => {
          ctx.log.error(err, 'Error removing ' + temp.filename)
        })
      }
      catch (err) {
        ctx.log.error(err)
        error = 'Unable to upload file: ' + err.message
      }
    }
    if (!error) {
      redirect = `${this.frontend}/?v=${ctx.state.video}&i=${ctx.state.image}`
    }

    if (!error) {
      try {
        let params = [
          ctx.state.video,
          ctx.state.image,
          ctx.req.ip,
          ctx.state.width,
          ctx.state.height,
        ]
        let res = await ctx.db.safeCallProc('discord_embed.link_add', params)
        let id = AlphabeticID.encode(res.first[0].id + 3843)
        redirect = `${this.frontend}/${id}`
      }
      catch (err) {
        ctx.log.error(err)
        error = 'Error while generating shortened link.'
      }
    }

    if (redirect && !error) {
      ctx.status = 302
      ctx.headers['Location'] = redirect
      ctx.type = 'text/html; charset=utf-8'
      ctx.body = `
Redirecting
<a href="${redirect}">Click here if it doesn't redirect</a>
`
    }
    ctx.state.error = error
    return this.serve.serveIndex(ctx)
  }
}
// https://litter.catbox.moe/cnl6hy.mp4