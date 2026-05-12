import * as fs from 'fs'
import * as path from 'path'

export async function getLearnings(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), 'LEARNINGS.md')
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}
