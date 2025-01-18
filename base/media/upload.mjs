import config from '../config.mjs'
import Client from './client.mjs'

export function uploadMedia(file) {
  const media = config.get('media')

  const client = new Client()
  let token = client.createJwt({ iss: media.iss }, media.secret)

  let out = {
    sizes: {
      small: media.small ? {} : null,
      medium: media.medium ? {} : null,
      large: media.large ? {} : null,
    }
  }

  let body = {}

  if (media.preview) {
    body.preview = media.preview
  }
  if (media.small?.avif) {
    body.small = media.small.avif
  }
  if (media.medium?.avif) {
    body.medium = media.medium.avif
  }
  if (media.large?.avif) {
    body.large = media.large.avif
  }

  return client.upload(media.path + '?token=' + token, { file: {
    file: file.path,
    filename: file.name,
  } }, 'POST', body).then(res => {
    out.filename = res.filename
    out.path = res.path
    out.preview = res.preview
    if (out.sizes.small) { out.sizes.small.avif = res.small }
    if (out.sizes.medium) { out.sizes.medium.avif = res.medium }
    if (out.sizes.large) { out.sizes.large.avif = res.large }
    out.size = file.size
    out.type = file.type

    let body = {}
    if (media.small?.jpeg) {
      body.small = media.small.jpeg
    }
    if (media.medium?.jpeg) {
      body.medium = media.medium.jpeg
    }
    if (media.large?.jpeg) {
      body.large = media.large.jpeg
    }

    return client.post(media.path + '/' + out.filename + '?token=' + token, body)
    .then(res => {
      if (out.sizes.small) { out.sizes.small.jpeg = res.small }
      if (out.sizes.medium) { out.sizes.medium.jpeg = res.medium }
      if (out.sizes.large) { out.sizes.large.jpeg = res.large }
    })
  })
  .then(() => {
    return out
  })
}

export function uploadFile(file) {
  const media = config.get('media')

  const client = new Client()
  let token = client.createJwt({ iss: media.iss }, media.secret)

  return client.upload(media.filePath + '?token=' + token, { file: {
    file: file.path,
    filename: file.name,
  } }, 'POST').then(res => {
    return {
      filename: res.filename,
      path: res.path,
      size: file.size,
      type: file.type,
    }
  })
}

export function deleteFile(filename) {
  const media = config.get('media')

  const client = new Client()
  let token = client.createJwt({ iss: media.iss }, media.secret)

  return client.delete(media.removePath + filename + '?token=' + token, { })
}
