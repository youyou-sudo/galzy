/**
 * 搜索关键词归一。
 *
 * Meilisearch 的 `q` 是自由文本（只有 filter 表达式才需要语法转义），但旧实现把
 * `+ - * / = < > ! & | % ^ $ # @ ~ ? : ; ' " , ( ) [ ] { } \` 全部删掉，
 * 把 `9-nine`、`Fate/stay night`、`K-ON!`、`v1.0` 这类标题直接搜坏。
 *
 * 这里只做空白归一：多余空白/换行折叠成单个空格并去掉首尾。分词、大小写与
 * typo 容错都交给搜索引擎，不要在应用层替它做正则清洗。
 */
export function normalizeSearchQuery(q?: string | null): string {
  return (q ?? '').replace(/\s+/g, ' ').trim()
}
