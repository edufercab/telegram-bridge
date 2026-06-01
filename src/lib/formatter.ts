function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function markdownToHtml(text: string): string {
  const codeBlocks: string[] = []
  let result = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_match, _lang, code: string) => {
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`)
    return `\x00CODE_BLOCK_${codeBlocks.length - 1}\x00`
  })

  const inlineCodes: string[] = []
  result = result.replace(/`([^`]+)`/g, (_match, code: string) => {
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`)
    return `\x00INLINE_CODE_${inlineCodes.length - 1}\x00`
  })

  result = escapeHtml(result)

  result = result
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/_(.+?)_/g, '<i>$1</i>')
    .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
    .replace(/^---+$/gm, '──────────')
    .replace(/\n{3,}/g, '\n\n')

  codeBlocks.forEach((block, i) => {
    result = result.replace(`\x00CODE_BLOCK_${i}\x00`, block)
  })
  inlineCodes.forEach((code, i) => {
    result = result.replace(`\x00INLINE_CODE_${i}\x00`, code)
  })

  return result.trim()
}

export function splitMessage(text: string, maxLength = 4000): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n\n', maxLength)
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('\n', maxLength)
    if (splitAt <= 0) splitAt = maxLength

    chunks.push(remaining.slice(0, splitAt).trim())
    remaining = remaining.slice(splitAt).trim()
  }

  if (remaining) chunks.push(remaining)

  if (chunks.length > 2) {
    return chunks.map((chunk, i) => `[${i + 1}/${chunks.length}]\n${chunk}`)
  }
  return chunks
}
