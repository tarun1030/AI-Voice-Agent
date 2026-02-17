/**
 * Strips markdown formatting from text for clean TTS output.
 * Removes all symbols that a speech engine would pronounce literally
 * (asterisks, slashes, hashes, backticks, brackets, pipes, etc.)
 */
export const stripMarkdown = (text: string): string => {
  if (!text) return '';

  return text
    // ── Block-level elements ──────────────────────────────────────────
    // Remove fenced code blocks entirely (``` ... ```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove indented code blocks (4 spaces or tab)
    .replace(/^(?: {4}|\t).+$/gm, '')
    // Remove horizontal rules (---, ***, ___, ===)
    .replace(/^[ \t]*[-*_=]{3,}[ \t]*$/gm, '')
    // Remove blockquote markers
    .replace(/^[ \t]*>+[ \t]?/gm, '')
    // Remove headings — keep the text, strip the # symbols
    .replace(/^#{1,6}\s+/gm, '')
    // Remove setext-style headings (underlines)
    .replace(/^[=-]{2,}$/gm, '')

    // ── Inline code ───────────────────────────────────────────────────
    // Keep the text inside backticks, remove backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove any stray single backticks
    .replace(/`/g, '')

    // ── Emphasis / bold ───────────────────────────────────────────────
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1') // bold italic ***
    .replace(/___([^_]+)___/g, '$1')        // bold italic ___
    .replace(/\*\*([^*]+)\*\*/g, '$1')      // bold **
    .replace(/__([^_]+)__/g, '$1')          // bold __
    .replace(/\*([^*\n]+)\*/g, '$1')        // italic *
    .replace(/_([^_\n]+)_/g, '$1')          // italic _
    // Strikethrough
    .replace(/~~([^~]+)~~/g, '$1')

    // ── Links & images ────────────────────────────────────────────────
    // Keep link text, discard URL
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Reference links [text][ref]
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Images — discard entirely (alt text not useful for TTS)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Bare angle-bracket links <https://...>
    .replace(/<https?:\/\/[^>]+>/g, '')
    // HTML tags
    .replace(/<[^>]+>/g, '')

    // ── List markers ──────────────────────────────────────────────────
    // Unordered list bullets (-, *, +) — remove marker, keep text
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    // Ordered list numbers (1. 2. etc.) — remove marker, keep text
    .replace(/^[ \t]*\d+\.[ \t]+/gm, '')
    // Task list checkboxes [ ] [x]
    .replace(/\[[ xX]\][ \t]*/g, '')

    // ── Tables ────────────────────────────────────────────────────────
    // Remove pipe characters and separator rows
    .replace(/^\|?.+\|.+\|?$/gm, (line) =>
      line.replace(/\|/g, ' ').replace(/[-:]+/g, '').trim()
    )

    // ── Remaining stray symbols that TTS would vocalise ──────────────
    // Standalone asterisks, slashes, hashes, tildes, carets, backslashes
    .replace(/[*\\^~|]/g, '')
    // Forward slash between words (e.g. and/or → "and or")
    .replace(/\//g, ' ')
    // Angle brackets (not already removed as HTML)
    .replace(/[<>]/g, '')
    // Remove definition list markers (: at line start)
    .replace(/^:[ \t]+/gm, '')

    // ── Whitespace cleanup ────────────────────────────────────────────
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Collapse runs of spaces
    .replace(/[ \t]{2,}/g, ' ')
    // Trim each line
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
};