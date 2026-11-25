export function formatLocalDateIso(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isDateWithinRange(
  date: string,
  startDate: string,
  endDate: string | null
) {
  return date >= startDate && (!endDate || date <= endDate);
}
