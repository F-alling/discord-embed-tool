import path from 'path'
import { HttpError } from 'flaska'
import Parent from '../base/serve.mjs'
import fs from 'fs/promises'
import fsSync from 'fs'
import dot from 'dot'
import config from '../base/config.mjs'
import AlphabeticID from './id.mjs'

const ExpirationRegex = /ex=([0-9a-fA-F]{8})/

export default class ServeHandler extends Parent {
  loadTemplate(indexFile) {
    this.template = dot.template(indexFile.toString(), { argName: [
      'imageLink',
      'videoLink',
      'width',
      'height',
      'error',
      'siteUrl',
      'siteUrlBase',
      'version',
      'nonce',
      'in_debug',
      'inputVideo',
      'inputImage',
      'inputWidth',
      'inputHeight'
    ], strip: false })
  }

  async refreshUrl(link) {
    var res = await fetch('https://discord.com/api/v10/attachments/refresh-urls', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${config.get('discord_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ attachment_urls: [link] })
    })
    let output = await res.json()
    return output?.refreshed_urls?.[0].refreshed
  }

  register(server) {
    super.register(server)
    server.flaska.get('/video/:id', this.videoRedirect.bind(this))
    server.flaska.onerror(this.serveError.bind(this))
  }

  serveError(err, ctx) {
    ctx.log.error(err)

    if (err instanceof HttpError) {
      ctx.status = err.status
      ctx.state.error = err.message
    } else {
      ctx.status = 500
      ctx.state.error = 'Unknown error occured'
    }
    
    let videoLink = ctx.query.get('v') || ''
    let imageLink = ctx.query.get('i') || ''
    let width = ctx.query.get('w') || 1280
    let height = ctx.query.get('h') || 720

    ctx.body = this.template({
      videoLink: videoLink,
      imageLink: imageLink,
      width: width,
      height: height,
      error: ctx.state.error || '',
      inputVideo: ctx.state.video || videoLink || '',
      inputImage: ctx.state.image || imageLink || '',
      inputWidth: width,
      inputHeight: height,
      siteUrl: this.frontend + ctx.url,
      siteUrlBase: this.frontend + '/',
      version: this.version,
      nonce: ctx.state.nonce,
      in_debug: config.get('NODE_ENV') === 'development' && false,
    })
    ctx.type = 'text/html; charset=utf-8'
  }

  async videoRedirect(ctx) {
    try {
      let id = AlphabeticID.decode(ctx.params.id.slice(0,-5))
      let videoLink = null
      if (id) {
        let res = await ctx.db.safeCallProc('discord_embed.link_get', [id - 3843])
        if (res.first.length) {
          videoLink = res.first[0].video_link
        } else {
          ctx.status = 404
        }
      }

      if (videoLink) {
        ctx.status = 302
        ctx.headers['Location'] = videoLink
        ctx.type = 'text/html; charset=utf-8'
        ctx.body = `
Redirecting
<a href="${videoLink}">Click here if it doesn't redirect</a>
`
        return
      } else {
        ctx.status = 404
        ctx.state.error = 'Video not found.'
      }
    } catch (err) {
      ctx.log.error(err, 'Unable to fetch resource ' + ctx.url.slice(1))
      ctx.state.error = 'Unknown error while fetching link.'
    }
    return this.serveIndex(ctx)
  }

  async serveIndex(ctx) {
    if (config.get('NODE_ENV') === 'development') {
      let indexFile = await fs.readFile(path.join(this.root, 'index.html'))
      this.loadTemplate(indexFile)
    }

    let videoLink = ctx.query.get('v') || ''
    let imageLink = ctx.query.get('i') || (videoLink ? 'https://cdn.nfp.is/av1/empty.png' : '')
    let width = ctx.query.get('w') || 1280
    let height = ctx.query.get('h') || 720
    let id = null

    if (!ctx.state.error) {
      if (ctx.url.match(/^\/[a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9]+$/) && ctx.url.length < 7) {
        try {
          id = AlphabeticID.decode(ctx.url.slice(1))
          if (id) {
            let res = await ctx.db.safeCallProc('discord_embed.link_get', [id - 3843])
            if (res.first.length) {
              videoLink = ctx.state.video = res.first[0].video_link
              if (!ctx.state.video.startsWith('https://cdn.discordapp.com')
                  && !ctx.state.video.includes('catbox.')
                  && ctx.state.video.includes('?')) {
                videoLink = this.frontend + '/video/' + ctx.url.slice(1) + '.webm'
              }
              imageLink = res.first[0].image_link
              width = res.first[0].width || width
              height = res.first[0].height || height
            } else {
              ctx.status = 404
            }
          }
        } catch (err) {
          ctx.log.error(err, 'Unable to fetch resource ' + ctx.url.slice(1))
          ctx.state.error = 'Unknown error while fetching link.'
        }
      } else if (ctx.url !== '/') {
        ctx.status = 404
      }
    }

    if (videoLink.startsWith('https://cdn.discordapp.com')) {
      if (id) {
        let match = ExpirationRegex.exec(videoLink)
        if (match && match[1]) {
          try {
            let expiration = Number('0x' + match[1]) * 1000
            if (new Date() > new Date(expiration)) {
              let newLink = await this.refreshUrl(videoLink)
              if (newLink) {
                ctx.log.info({
                  old: videoLink,
                  new: newLink,
                }, 'Updating link')
                videoLink = ctx.state.video = newLink
                await ctx.db.safeCallProc('discord_embed.link_update', [id - 3843, videoLink])
              }
            }
          } catch (err) {
            ctx.log.error(err)
          }
        }
      }
      videoLink = videoLink.replace('https://cdn.discordapp.com', 'https://discordproxy.nfp.is')
    }

    let payload = {
      videoLink: videoLink,
      imageLink: imageLink,
      width: width,
      height: height,
      error: ctx.state.error || '',
      inputVideo: ctx.state.video || videoLink || '',
      inputImage: ctx.state.image || imageLink || '',
      inputWidth: width,
      inputHeight: height,
      siteUrl: this.frontend + ctx.url,
      siteUrlBase: this.frontend + '/',
      version: this.version,
      nonce: ctx.state.nonce,
      in_debug: config.get('NODE_ENV') === 'development' && false,
    }

    ctx.body = this.template(payload)
    ctx.type = 'text/html; charset=utf-8'
  }
}
