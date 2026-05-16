const parseYears = () => {
  const raw = process.env.ACADEMIC_YEARS || '2025,2026,2027';
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

module.exports = {
  parseYears,
};
