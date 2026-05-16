const COMPANY_ALIASES = {
  'ey': 'ernst and young',
  'ernst & young': 'ernst and young',
  'ernst and young': 'ernst and young',
  'tech mahindra': 'tech mahindra',
  'jp morgan': 'jp morgan and chase',
  'jpmorgan': 'jp morgan and chase',
  'jp morgan chase': 'jp morgan and chase',
  'jp morgan and chase': 'jp morgan and chase',
};

const normalizeCompanyName = (value) => {
  const raw = String(value || '');
  let name = raw
    .toLowerCase()
    .replace(/[\t\n\r]+/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name) return '';

  if (name.startsWith('iit ')) {
    name = name
      .replace(/\b(research|summer|winter|internship|programme|program|training|project)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (COMPANY_ALIASES[name]) {
    return COMPANY_ALIASES[name];
  }

  return name;
};

const similarityScore = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aTokens = new Set(a.split(' '));
  const bTokens = new Set(b.split(' '));
  const intersect = [...aTokens].filter((t) => bTokens.has(t)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersect / union;
};

export {
  COMPANY_ALIASES,
  normalizeCompanyName,
  similarityScore,
};
