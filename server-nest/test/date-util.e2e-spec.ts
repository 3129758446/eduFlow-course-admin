import { formatLocalDateTime } from '../src/database/date.util';

describe('date utilities', () => {
  it('formats datetime from local date parts without applying a fixed timezone offset', () => {
    expect(formatLocalDateTime(new Date(2026, 7, 31, 0, 30, 5))).toBe('2026-08-31 00:30:05');
  });
});
