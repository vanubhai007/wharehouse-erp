// Warehouse rental calculation service.
//
// BUSINESS RULE (CONFIRM WITH BUSINESS - safe default implemented here):
//   Rent is charged pro-rata by day. A location's monthly rate is split
//   across the calendar days an item actually occupied it. By default the
//   denominator for a given calendar month is the real number of days in
//   that month (28/29/30/31); Settings.rentalDaysPerMonth can instead force
//   a flat divisor (e.g. 30) if the business prefers flat-month billing.
//   The occupied date range is treated as [startDate, endDate) - the day an
//   item is dispatched/moved out is NOT charged, matching typical storage
//   billing conventions. An ongoing occupancy (no endDate yet) is charged
//   up to "asOf" (defaults to today).

function daysInMonth(year, monthIndex /* 0-based */) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Splits [start, end) into per-calendar-month day counts.
// Returns an array of { year, monthIndex, days }.
function splitByMonth(start, end) {
  const segments = [];
  let cursor = startOfDay(start);
  const endDay = startOfDay(end);
  if (cursor >= endDay) return segments;

  while (cursor < endDay) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const monthEnd = new Date(year, monthIndex + 1, 1); // first day of next month
    const segmentEnd = monthEnd < endDay ? monthEnd : endDay;
    const days = Math.round((segmentEnd - cursor) / 86400000);
    segments.push({ year, monthIndex, days });
    cursor = segmentEnd;
  }
  return segments;
}

/**
 * @param {number} areaSqFt
 * @param {number} ratePerSqFtPerMonth
 * @param {Date|string} startDate inclusive
 * @param {Date|string} endDate exclusive (defaults to asOf)
 * @param {number} flatDaysPerMonth 0 = use actual days in month
 * @param {Date|string} asOf used when endDate is not provided (ongoing occupancy)
 */
function calculateRentalForPeriod(areaSqFt, ratePerSqFtPerMonth, startDate, endDate, flatDaysPerMonth = 0, asOf = new Date()) {
  if (!startDate) return { amount: 0, breakdown: [] };
  const start = startOfDay(startDate);
  const end = startOfDay(endDate || asOf);
  if (end <= start) return { amount: 0, breakdown: [] };

  const monthlyCharge = areaSqFt * ratePerSqFtPerMonth;
  const segments = splitByMonth(start, end);

  let total = 0;
  const breakdown = segments.map((seg) => {
    const denominator = flatDaysPerMonth > 0 ? flatDaysPerMonth : daysInMonth(seg.year, seg.monthIndex);
    const amount = (monthlyCharge / denominator) * seg.days;
    total += amount;
    return {
      year: seg.year,
      month: seg.monthIndex + 1,
      daysOccupied: seg.days,
      daysInMonth: denominator,
      amount: Math.round(amount * 100) / 100,
    };
  });

  return { amount: Math.round(total * 100) / 100, breakdown };
}

/**
 * Calculates total accumulated rental for one item across its full
 * locationHistory (handles the item moving between locations).
 */
function calculateItemRental(item, settings, asOf = new Date()) {
  const flatDaysPerMonth = settings?.rentalDaysPerMonth || 0;
  let total = 0;
  const details = [];
  for (const entry of item.locationHistory || []) {
    const rate = entry.ratePerSqFtPerMonth || settings?.defaultRatePerSqFtPerMonth || 0;
    const result = calculateRentalForPeriod(entry.areaSqFt, rate, entry.startDate, entry.endDate, flatDaysPerMonth, asOf);
    total += result.amount;
    details.push({ location: entry.location, ...result });
  }
  return { amount: Math.round(total * 100) / 100, details };
}

module.exports = { calculateRentalForPeriod, calculateItemRental, splitByMonth, daysInMonth, addDays, startOfDay };
