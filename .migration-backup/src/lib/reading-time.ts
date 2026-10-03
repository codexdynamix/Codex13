/**
 * Estimates reading time in minutes for a given text or markdown string.
 * Uses the industry standard reading speed of 200–225 words per minute.
 */
export function calculateReadingTime(content: string, wpm = 200): {
  minutes: number;
  text: string;
  words: number;
} {
  if (!content || typeof content !== "string") {
    return { minutes: 1, text: "1 min read", words: 0 };
  }

  // Strip markdown formatting symbols for accurate word count
  const cleanText = content
    .replace(/!\[.*?\]\(.*?\)/g, "") // remove images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // replace links with anchor text
    .replace(/[#*`_~>[\]()-]/g, " ") // remove formatting characters
    .replace(/\s+/g, " ")
    .trim();

  const words = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
  const minutes = Math.max(1, Math.ceil(words / wpm));

  return {
    minutes,
    text: `${minutes} min read`,
    words,
  };
}
