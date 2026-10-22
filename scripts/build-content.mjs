import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { compileContent } from './content.mjs'

const content = await compileContent(fileURLToPath(new URL('../content/', import.meta.url)))
const target = new URL('../src/generated/', import.meta.url)
await mkdir(target, { recursive: true })
await writeFile(new URL('content.json', target), `${JSON.stringify(content, null, 2)}\n`)
console.log(`内容校验通过：${content.articles.length} 篇文章，${content.questions.length} 道题。`)
