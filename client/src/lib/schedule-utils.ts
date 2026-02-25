import type { MenuItemWithDetails } from "@shared/schema";

export interface ScheduleDateEntry {
  items: MenuItemWithDetails[];
  source: Map<number, "schedule" | "manual">;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Pure function: computes which items appear on which dates based on schedule rules.
 * No DB calls — uses only the data already loaded in the client.
 */
export function computeScheduleForDateRange(
  items: MenuItemWithDetails[],
  startDate: Date,
  endDate: Date,
  exceptions: { menuItemId: number; exceptionDate: string | Date }[]
): Map<string, ScheduleDateEntry> {
  const result = new Map<string, ScheduleDateEntry>();

  // Build exception lookup: menuItemId -> Set of dateKeys
  const exceptionsByItem = new Map<number, Set<string>>();
  for (const exc of exceptions) {
    const d = new Date(exc.exceptionDate);
    const key = formatDateKey(d);
    if (!exceptionsByItem.has(exc.menuItemId)) exceptionsByItem.set(exc.menuItemId, new Set());
    exceptionsByItem.get(exc.menuItemId)!.add(key);
  }

  // Generate all dates in range
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  for (const item of items) {
    // Skip manual or inactive items
    if (item.scheduleType === "manual" || item.isScheduleActive !== 1) continue;

    const itemExceptions = exceptionsByItem.get(item.id) || new Set<string>();

    for (const date of dates) {
      const dateKey = formatDateKey(date);

      // Check exception
      if (itemExceptions.has(dateKey)) continue;

      // Check start/end bounds
      if (item.scheduleStartDate) {
        const startBound = new Date(item.scheduleStartDate);
        startBound.setHours(0, 0, 0, 0);
        if (date < startBound) continue;
      }
      if (item.scheduleEndDate) {
        const endBound = new Date(item.scheduleEndDate);
        endBound.setHours(23, 59, 59, 999);
        if (date > endBound) continue;
      }

      let matches = false;
      const dayOfWeek = date.getDay(); // 0=Sun...6=Sat

      switch (item.scheduleType) {
        case "daily":
          matches = true;
          break;
        case "weekdays":
          matches = dayOfWeek >= 1 && dayOfWeek <= 5;
          break;
        case "weekends":
          matches = dayOfWeek === 0 || dayOfWeek === 6;
          break;
        case "custom_days":
          matches = (item.scheduleDays || []).includes(dayOfWeek);
          break;
        case "one_off":
          if (item.oneOffDate) {
            const oneOff = new Date(item.oneOffDate);
            matches = formatDateKey(oneOff) === dateKey;
          }
          break;
      }

      if (matches) {
        if (!result.has(dateKey)) {
          result.set(dateKey, { items: [], source: new Map() });
        }
        const entry = result.get(dateKey)!;
        // Avoid duplicates
        if (!entry.source.has(item.id)) {
          entry.items.push(item);
          entry.source.set(item.id, "schedule");
        }
      }
    }
  }

  return result;
}
