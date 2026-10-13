import { formatShortDate, formatTime } from "./time";

export function scheduleHistoryLine(
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
): string {
  return `Rescheduled from ${formatShortDate(fromDate)} at ${formatTime(fromTime)} to ${formatShortDate(toDate)} at ${formatTime(toTime)}`;
}
