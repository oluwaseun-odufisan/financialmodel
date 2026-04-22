export function normalizeAiText(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => {
      let next = line.trimEnd();
      next = next.replace(/^\s*#{1,6}\s*/, '');
      next = next.replace(/^\s*>\s*/, '');
      next = next.replace(/^\s*[-*+]\s+/, '');
      next = next.replace(/^\s*\d+\.\s+/, '');
      next = next.replace(/\*\*(.*?)\*\*/g, '$1');
      next = next.replace(/__(.*?)__/g, '$1');
      next = next.replace(/`([^`]+)`/g, '$1');
      return next;
    });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function toParagraphs(text) {
  return normalizeAiText(text)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, ' ').trim())
    .filter(Boolean);
}

export function splitAiSections(text, preferredHeadings = []) {
  const headingSet = new Set(preferredHeadings.map((heading) => heading.trim().toLowerCase()));
  const lines = normalizeAiText(text).split('\n');
  const sections = [];
  let current = null;

  const startSection = (title) => {
    current = { title, paragraphs: [] };
    sections.push(current);
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const normalized = line.replace(/:$/, '').trim().toLowerCase();
    if (headingSet.has(normalized)) {
      startSection(line.replace(/:$/, '').trim());
      return;
    }

    if (!current) {
      startSection('Overview');
    }

    current.paragraphs.push(line);
  });

  return sections
    .map((section) => ({
      ...section,
      paragraphs: section.paragraphs
        .join('\n')
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.replace(/\n+/g, ' ').trim())
        .filter(Boolean),
    }))
    .filter((section) => section.paragraphs.length > 0);
}
