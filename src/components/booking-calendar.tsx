import { ChevronLeft, ChevronRight } from "lucide-react";
import { daysInMonth, isoFromParts, monthLabel, todayInFacility, weekdayOfIso } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingCalendar({
  year,
  month,
  selected,
  availability,
  onSelect,
  onMonthChange,
}: {
  year: number;
  month: number;
  selected: string | null;
  availability: Record<string, number>;
  onSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}) {
  const today = todayInFacility();
  const firstDow = weekdayOfIso(isoFromParts(year, month, 1));
  const count = daysInMonth(year, month);
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    onMonthChange(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-xl text-fg">{monthLabel(year, month)}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-10"
            aria-label="Previous month"
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-10"
            aria-label="Next month"
            onClick={() => shift(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] tracking-wide text-muted uppercase">
        {DOW.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const date = isoFromParts(year, month, day);
          const open = availability[date] ?? 0;
          const isPast = date < today;
          const isSelected = selected === date;
          const enabled = !isPast && open > 0;
          return (
            <button
              key={date}
              type="button"
              disabled={!enabled}
              onClick={() => onSelect(date)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors duration-150",
                enabled && "hover:bg-primary/10",
                isSelected && "bg-primary text-primary-fg hover:bg-primary",
                !enabled && "text-muted/45",
                date === today && !isSelected && "ring-1 ring-primary/40",
              )}
            >
              <span className="tabular-nums">{day}</span>
              {enabled && !isSelected ? (
                <span className="mt-0.5 size-1 rounded-full bg-primary" />
              ) : (
                <span className="mt-0.5 size-1" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
