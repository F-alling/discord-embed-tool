import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import http from 'http'
import https from 'https'
import { URL } from 'url'
import { encode } from '../util.mjs'

export default class Client {
  constructor() {

  }

  customRequest(method = 'GET', path, body, options = {}) {
    if (path.slice(0, 4) !== 'http') {
      throw new Error('Http client path invalid')
    }
    let urlObj = new URL(path)
    let d1 = new Date()

    return new Promise((resolve, reject) => {
      const opts = {
        method: options.method || method,
        timeout: options.timeout || 60000,
        protocol: options.protocol || urlObj.protocol,
        username: options.username || urlObj.username,
        password: options.password || urlObj.password,
        host: options.host || urlObj.hostname,
        port: options.port || Number(urlObj.port),
        path: options.path || urlObj.pathname + urlObj.search,
        headers: options.headers || {},
      }

      if (options.agent) {
        opts.agent = options.agent
      }

      // opts.agent = agent

      let req
      if (path.startsWith('https')) {
        req = https.request(opts)
      } else {
        req = http.request(opts)
      }

      req.on('error', (err) => {
        reject(err)
      })
      req.on('timeout', function() {
        req.destroy()
        let d2 = new Date()
        reject(new Error(`Request ${method} ${path} timed out`))
      })
      req.on('response', res => {
        let output = ''
        res.setEncoding('utf8')

        res.on('data', function (chunk) {
          output += chunk.toString()
        })

        res.on('end', function () {
          if (options.getRaw) {
            output = {
              status: res.statusCode,
              data: output,
              headers: res.headers,
            }
          } else {
            if (!output) return resolve(null)
            try {
              output = JSON.parse(output)
            } catch (e) {
              return reject(new Error(`${e.message} while decoding: ${output}`))
            }
          }
          if (!options.getRaw && output.status && typeof(output.status) === 'number') {
            let err = new Error(`Request failed [${output.status}]: ${output.message}`)
            err.url = path
            err.body = output
            return reject(err)
          }
          resolve(output)
        })
      })

      if (opts.returnRequest) {
        return resolve(req)
      }
      
      if (body) {
        req.write(body)
      }
      req.end()
      return req
    })
  }

  createJwt(body, secret) {
    return Client.createJwt(body, secret)
  }

  static createJwt(body, secret) {
    let header = {
      typ: 'JWT',
      alg: 'HS256',
    }

    body.iat = Math.floor(Date.now() / 1000)
    body.exp = body.iat + 300

    // Base64 encode header and body
    let headerBase64 = encode(Buffer.from(JSON.stringify(header)))
    let bodyBase64 = encode(Buffer.from(JSON.stringify(body)))
    let headerBodyBase64 = headerBase64 + '.' + bodyBase64

    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(headerBodyBase64)
    let signatureBuffer = hmac.digest()

    // Construct final JWT
    let signatureBase64 = encode(signatureBuffer)
    return headerBodyBase64 + '.' + signatureBase64
  }

  random(length = 8) {
    // Declare all characters
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    // Pick characers randomly
    let str = '';
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  }

  get(url) {
    return this.customRequest('GET', url, null)
  }

  post(url, body) {
    let parsed = JSON.stringify(body)
    return this.customRequest('POST', url, parsed, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': parsed.length,
      },
    })
  }
  
  delete(url, body) {
    let parsed = JSON.stringify(body)
    return this.customRequest('DELETE', url, parsed, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': parsed.length,
      },
    })
  }

  upload(url, files, method = 'POST', body = {}) {
    const boundary = `---------${this.random(32)}`
    const crlf = '\r\n'
    let upload = files

    if (typeof(upload) === 'string') {
      upload = {
        file: files
      }
    }
    let keys = Object.keys(upload)
    let uploadBody = []

    return Promise.all(keys.map(key => {
      let file = upload[key]
      let filename = ''
      if (typeof(file) === 'object') {
        if (typeof(file.file) !== 'string' || typeof(file.filename) !== 'string') {
          throw new Error('Invalid value in client.upload for key ' + key)
        }
        filename = file.filename
        file = file.file
      } else {
        filename = path.basename(file)
      }
      return fs.readFile(file).then(data => {
        uploadBody.push(Buffer.from(
          `${crlf}--${boundary}${crlf}` +
          `Content-Disposition: form-data; name="${key}"; filename="${filename}"` + crlf + crlf
        ))
        uploadBody.push(data)
      })
    }))
    .then(() => {
      uploadBody.push(
        Buffer.concat(Object.keys(body).map(function(key) {
          return Buffer.from(''
            + `${crlf}--${boundary}${crlf}`
            + `Content-Disposition: form-data; name="${key}"` + crlf + crlf
            + JSON.stringify(body[key])
          )
        }))
      )
      uploadBody.push(Buffer.from(`${crlf}--${boundary}--`))

      let multipartBody = Buffer.concat(uploadBody)

      return this.customRequest(method, url, multipartBody, {
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': multipartBody.length,
        },
      })
    })
  }
}
