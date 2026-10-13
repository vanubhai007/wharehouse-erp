const { calculateRentalForPeriod, splitByMonth, daysInMonth } = require('../services/rentalService');

describe('rentalService.daysInMonth', () => {
  test('handles leap year February', () => {
    expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024 (0-indexed month 1)
    expect(daysInMonth(2025, 1)).toBe(28); // Feb 2025
  });
});

describe('rentalService.splitByMonth', () => {
  test('splits a range spanning two calendar months', () => {
    const segments = splitByMonth(new Date('2026-01-20'), new Date('2026-02-10'));
    expect(segments).toEqual([
      { year: 2026, monthIndex: 0, days: 12 }, // Jan 20..31 inclusive = 12 days
      { year: 2026, monthIndex: 1, days: 9 }, // Feb 1 -> Feb 10 = 9 days
    ]);
  });

  test('returns empty when end <= start', () => {
    expect(splitByMonth(new Date('2026-02-10'), new Date('2026-02-10'))).toEqual([]);
    expect(splitByMonth(new Date('2026-02-10'), new Date('2026-02-01'))).toEqual([]);
  });
});

describe('rentalService.calculateRentalForPeriod', () => {
  test('charges a full calendar month correctly', () => {
    // 100 sq ft @ Rs.10/sqft/month, occupied the entire month of April (30 days)
    const result = calculateRentalForPeriod(100, 10, new Date('2026-04-01'), new Date('2026-05-01'), 0);
    expect(result.amount).toBe(1000); // full month = full monthly charge
  });

  test('pro-rates a partial month using actual days in that month', () => {
    // Occupied Feb 1 - Feb 15 2026 (14 days of a 28-day Feb) at Rs.280/month for 100sqft@2.8
    const result = calculateRentalForPeriod(100, 28, new Date('2026-02-01'), new Date('2026-02-15'), 0);
    // monthlyCharge = 2800, daysInMonth=28, daysOccupied=14 -> 1400
    expect(result.amount).toBe(1400);
  });

  test('handles a boundary that spans two months proportionally', () => {
    // 100 sqft @ Rs.30/sqft/month, occupied Jan 25 - Feb 5 2026
    const result = calculateRentalForPeriod(100, 30, new Date('2026-01-25'), new Date('2026-02-05'), 0);
    // Jan: 25->Feb1 = 7 days of 31-day month: 3000*7/31 = 677.42
    // Feb: Feb1->Feb5 = 4 days of 28-day month: 3000*4/28 = 428.57
    expect(result.breakdown[0].daysOccupied).toBe(7);
    expect(result.breakdown[1].daysOccupied).toBe(4);
    expect(result.amount).toBeCloseTo(677.42 + 428.57, 1);
  });

  test('uses a flat days-per-month divisor when configured', () => {
    // 100 sqft @ Rs.30/month, flat 30-day divisor, occupied 15 days
    const result = calculateRentalForPeriod(100, 30, new Date('2026-03-01'), new Date('2026-03-16'), 30);
    expect(result.amount).toBe(1500); // 3000/30*15
  });

  test('returns zero for no start date or an empty range', () => {
    expect(calculateRentalForPeriod(100, 10, null, new Date()).amount).toBe(0);
    expect(calculateRentalForPeriod(100, 10, new Date('2026-05-01'), new Date('2026-05-01')).amount).toBe(0);
  });

  test('ongoing occupancy is charged up to asOf when no endDate is given', () => {
    const asOf = new Date('2026-06-10');
    const result = calculateRentalForPeriod(50, 20, new Date('2026-06-01'), undefined, 0, asOf);
    // monthlyCharge=1000, June has 30 days, occupied 9 days (Jun1 -> Jun10 exclusive)
    expect(result.breakdown[0].daysOccupied).toBe(9);
    expect(result.amount).toBe(300);
  });
});
