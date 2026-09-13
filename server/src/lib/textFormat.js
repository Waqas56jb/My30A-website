// Cleans concierge chat replies (AI-generated or fallback) into elegant plain text: no markdown
// survives — no **bold**, no _italics_, no # headings, no [links](url), no backticks, no
// dash/asterisk bullets — just clean prose with real paragraph breaks. Applied to every Vitoria
// reply so the guest never sees a stray "**" or "- " no matter what the model returns.
export function cleanConciergeText(text) {
  if (!text) return ''
  let out = String(text)

  // Code fences / inline code — unwrap rather than strip, in case the model quotes something.
  out = out.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim())
  out = out.replace(/`([^`]+)`/g, '$1')

  // Markdown links [label](url) -> "label (url)"
  out = out.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, '$1 ($2)')

  // Bold / italic emphasis -> plain text
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, '$1')
  out = out.replace(/\*\*(.+?)\*\*/g, '$1')
  out = out.replace(/__(.+?)__/g, '$1')
  out = out.replace(/(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, '$1')
  out = out.replace(/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '$1')

  // Headings "## Title" -> "Title"
  out = out.replace(/^ {0,3}#{1,6}\s+/gm, '')

  // Bullet markers "- ", "* ", "+ " at line start -> a clean typographic bullet
  out = out.replace(/^[ \t]*[-*+]\s+/gm, '• ')

  // Trim trailing spaces per line, then collapse 3+ blank lines to a single paragraph break.
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return out
}
