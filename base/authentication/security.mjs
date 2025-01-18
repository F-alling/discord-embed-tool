import crypto from 'crypto'
import { HttpError } from 'flaska'
import { decode, encode } from '../util.mjs'
import config from '../config.mjs'

export const RankLevels = {
  Normal: 1,
  Manager: 10,
  Admin: 100,
}

const issuer = config.get('mssql:connectionUser')
const secret = config.get('jwtsecret')

export function verifyValidToken(parts, minLevel) {
  if (parts.length !== 4) {
    throw new HttpError(401, 'Authentication token invalid')
  }

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update([parts[0], parts[1], parts[2]].join('.'))
  let apiSignature = encode(hmac.digest())
  
  if (apiSignature !== parts[3]) {
    throw new HttpError(401, 'Authentication token invalid signature')
  }

  let header
  let body
  try {
    header = JSON.parse(decode(parts[0]).toString('utf8'))
    body = JSON.parse(decode(parts[1]).toString('utf8'))
  } catch (err) {
    throw new HttpError(401, 'Authentication token invalid json')
  }

  if (header.alg !== 'HS256') {
    throw new HttpError(401, 'Authentication token invalid alg')
  }

  let unixNow = Math.floor(Date.now() / 1000)

  // Validate token, add a little skew support for issued_at
  if (body.iss !== issuer || !body.iat || !body.exp
      || body.iat > unixNow + 300 || body.exp <= unixNow) {
    throw new HttpError(403, 'Authentication token expired or invalid')
  }

  if (body.rank < minLevel) {
    throw new HttpError(401, 'User does not have access to this resource')
  }

  return body
}

export function authenticate(minLevel = RankLevels.Manager) {
  return function(ctx) {
    if (!ctx.req.headers.authorization) {
      throw new HttpError(401, 'Authentication token missing')
    }
    if (!ctx.req.headers.authorization.startsWith('Bearer ')) {
      throw new HttpError(401, 'Authentication token invalid')
    }

    let parts = ctx.req.headers.authorization.slice(7).split('.')

    ctx.state.auth_user = verifyValidToken(parts, minLevel)
    ctx.state.auth_token = [parts[0], parts[1], parts[2]].join('.')
  }
}
