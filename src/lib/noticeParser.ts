export interface ParsedNoticeSubject {
  name: string;
  topics: string[];
}

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isUppercaseHeading(value: string) {
  const cleaned = value.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").trim();

  if (!cleaned || cleaned.length > 60) {
    return false;
  }

  return cleaned === cleaned.toUpperCase() && cleaned.includes(" ");
}

function extractHeading(line: string) {
  const normalized = normalizeLine(line);
  const headingMatch = normalized.match(
    /^(disciplina|materia|matéria|conteudo|conteúdo)\s*:\s*(.+)$/i,
  );

  if (headingMatch) {
    return headingMatch[2].trim();
  }

  if (normalized.endsWith(":") && normalized.length <= 70) {
    return normalized.slice(0, -1).trim();
  }

  if (isUppercaseHeading(normalized)) {
    return normalized;
  }

  return null;
}

function extractTopic(line: string) {
  const normalized = normalizeLine(line);

  if (!normalized) {
    return null;
  }

  const topic = normalized
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)-]\s*/, "")
    .trim();

  return topic || null;
}

export function parseNoticeText(rawText: string) {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const subjects: ParsedNoticeSubject[] = [];
  let currentSubject: ParsedNoticeSubject | null = null;

  for (const line of lines) {
    const heading = extractHeading(line);

    if (heading) {
      currentSubject = {
        name: heading,
        topics: [],
      };
      subjects.push(currentSubject);
      continue;
    }

    const topic = extractTopic(line);

    if (!topic) {
      continue;
    }

    if (!currentSubject) {
      currentSubject = {
        name: "Conteúdo importado",
        topics: [],
      };
      subjects.push(currentSubject);
    }

    if (!currentSubject.topics.includes(topic)) {
      currentSubject.topics.push(topic);
    }
  }

  return subjects
    .filter((subject) => subject.name && subject.topics.length > 0)
    .map((subject) => ({
      ...subject,
      name: subject.name.replace(/\s+/g, " ").trim(),
      topics: subject.topics.map((topic) => topic.trim()),
    }));
}
