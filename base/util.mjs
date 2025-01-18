
export function encode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-') // Convert '+' to '-'
    .replace(/\//g, '_') // Convert '/' to '_'
    .replace(/=+$/, '') // Remove ending '='
}

export function decode(base64StringUrlSafe) {
  let base64String = base64StringUrlSafe.replace(/-/g, '+').replace(/_/g, '/')
  switch (base64String.length % 4) {
    case 2:
      base64String += '=='
      break
    case 3:
      base64String += '='
      break
  }
  return Buffer.from(base64String, 'base64')
}

export function parseMediaAndBanner(item) {
  if (item.banner_path) {
    item.banner_path = 'https://cdn.nfp.is' + item.banner_path
    item.banner_alt_prefix = 'https://cdn.nfp.is' + (item.banner_alt_prefix || '')
  }
  if (item.media_path) {
    item.media_path = 'https://cdn.nfp.is' + item.media_path
    item.media_alt_prefix = 'https://cdn.nfp.is' + (item.media_alt_prefix || '')
  }
}

export function contentToBlocks(content) {
  if (!content) return content

  if (content[0] === '{') {
    try {
      return JSON.parse(content)
    } catch (err) {
      return {
        time: new Date().getTime(),
        blocks: [
          {id: '1', type: 'paragraph', data: { text: 'Error parsing content: ' + err.message }},
        ],
        version: '2.25.0'
      }
    }
  }

  return {
    time: new Date().getTime(),
    blocks: [
      {id: '1', type: 'htmlraw', data: { html: content }},
    ],
    version: '2.25.0'
  }
}
