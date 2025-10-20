function formatDate(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return isoDate;

  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;

  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

module.exports = { formatDate };
