import { contentToBlocks, parseMediaAndBanner } from '../util.mjs'

export function parsePagesToTree(pages) {
  let out = []
  let children = []
  let map = new Map()
  for (let page of pages) {
    if (!page.parent_id) {
      out.push(page)
    } else {
      children.push(page)
    }
    map.set(page.id, page)
  }
  for (let page of children) {
    let parent = map.get(page.parent_id)
    if (!parent.children) {
      parent.children = []
    }
    parent.children.push(page)
  }
  return {
    tree: out
  }
}

export function parsePages(pages) {
  for (let i = 0; i < pages.length; i++) {
    parsePage(pages[i])
  }
  return pages
}

export function parsePage(page) {
  if (!page) {
    return null
  }
  page.content = contentToBlocks(page.content)
  parseMediaAndBanner(page)
  return page
}