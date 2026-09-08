export function isLikelyMarkdown(value: string) {
  const text = value.trim();
  if (!text) return false;

  const blockMarkdown = [
    /(^|\n)[ \t]{0,3}#{1,6}[ \t]+\S/,
    /(^|\n)[ \t]{0,3}(?:[-+*]|\d+[.)])[ \t]+\S/,
    /(^|\n)[ \t]{0,3}>[ \t]+\S/,
    /(^|\n)[ \t]{0,3}(?:```|~~~)/,
    /(^|\n)[ \t]{0,3}[-+*][ \t]+\[[ xX]\][ \t]+\S/,
    /(^|\n)[ \t]{0,3}(?:[-*_][ \t]*){3,}(?:\n|$)/,
    /(^|\n)[^\n]*\|[^\n]*\n[ \t]*\|?[ \t]*:?-{3,}/,
  ];
  if (blockMarkdown.some((pattern) => pattern.test(text))) return true;

  return /!\[[^\]]*\]\([^\n)]+\)|\[[^\]]+\]\([^\n)]+\)|\*\*[^\n*]+\*\*|__[^\n_]+__|~~[^\n~]+~~/.test(text);
}
