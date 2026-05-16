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

  // IIT variants: collapse "IIT <campus> Research Internship" to "IIT <campus>"
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

module.exports = {
  normalizeCompanyName,
  COMPANY_ALIASES,
};
