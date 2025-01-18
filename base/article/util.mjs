import { contentToBlocks, parseMediaAndBanner } from '../util.mjs'

export function parseArticles(articles) {
  for (let i = 0; i < articles.length; i++) {
    parseArticle(articles[i])
  }
  return articles
}

export function parseArticle(article) {
  if (!article) {
    return null
  }
  article.content = contentToBlocks(article.content)
  parseMediaAndBanner(article)
  return article
}