import { useRef, useEffect } from "react";
import { format, isToday, isTomorrow } from "date-fns";
import { Calendar } from "lucide-react";

interface DaySelectorProps {
  availableDates: Date[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}

function getLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE");
}

export function DaySelector({ availableDates, selectedDate, onSelectDate }: DaySelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-select nearest available date on mount if nothing selected
  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      onSelectDate(availableDates[0]);
    }
  }, [availableDates.length]);

  const isSelected = (date: Date) =>
    selectedDate && date.toDateString() === selectedDate.toDateString();

  const allDaysSelected = selectedDate === null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:-mx-0 sm:px-0"
      role="tablist"
      aria-label="Select a day"
    >
      {/* All Days pill */}
      <button
        role="tab"
        aria-selected={allDaysSelected}
        onClick={() => onSelectDate(null)}
        className={`
          flex flex-col items-center justify-center shrink-0
          rounded-full px-4 py-2 text-xs font-medium transition-all border min-w-[4rem]
          ${allDaysSelected
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
          }
        `}
      >
        <Calendar className="h-3.5 w-3.5 mb-0.5" />
        <span>All</span>
      </button>

      {availableDates.map((date) => (
        <button
          key={date.toISOString()}
          role="tab"
          aria-selected={!!isSelected(date)}
          onClick={() => onSelectDate(date)}
          className={`
            flex flex-col items-center justify-center shrink-0
            rounded-full px-4 py-2 text-xs font-medium transition-all border min-w-[4rem]
            ${isSelected(date)
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
            }
          `}
        >
          <span className="text-[10px] uppercase tracking-wide">{getLabel(date)}</span>
          <span className="text-sm font-semibold">{format(date, "d")}</span>
          <span className="text-[10px]">{format(date, "MMM")}</span>
        </button>
      ))}
    </div>
  );
}
