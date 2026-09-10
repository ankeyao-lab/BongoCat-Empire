import translations from './empire-errors-en.json'

// Translate at the display boundary so the original error and diagnostics remain
// intact, and an already-visible error follows subsequent language changes.
const replacements = Object.entries(translations).sort((a, b) => b[0].length - a[0].length)

export function translateEmpireError(message: string, locale: string): string {
  if (locale.startsWith('zh') || !message) return message
  let text = message
  for (const [source, english] of replacements) text = text.split(source).join(english)
  return text
    .replace(/动作 (.+?) 时长读取失败，使用默认反馈：/g, 'Could not read the duration of motion $1. Using default feedback: ')
    .replace(/动作组 (.+?) 格式无效/g, 'Motion group $1 has an invalid format.')
    .replace(/动作 (.+?) 缺少文件路径/g, 'Motion $1 is missing its file path.')
    .replace(/LV(\d+) 必须是安全范围内的非负整数。/g, 'LV$1 must be a non-negative safe integer.')
    .replace(/LV(\d+) 必须大于 LV(\d+) 的累计门槛。/g, 'The LV$1 threshold must exceed the LV$2 threshold.')
}
