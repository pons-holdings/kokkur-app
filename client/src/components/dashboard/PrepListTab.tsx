import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Calendar } from "lucide-react";
import type { PrepListDayGroup } from "./types";

interface PrepListTabProps {
  prepListByDay: PrepListDayGroup[];
  pendingOrderCount: number;
  onViewOrder: () => void;
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const slotDay = new Date(date);
  slotDay.setHours(0, 0, 0, 0);

  if (slotDay.getTime() === today.getTime()) return "Today";
  if (slotDay.getTime() === tomorrow.getTime()) return "Tomorrow";

  return slotDay.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

const PrepListTab = React.memo(function PrepListTab({
  prepListByDay,
  pendingOrderCount,
  onViewOrder,
}: PrepListTabProps) {
  return (
    <>
      <h2 className="text-xl font-semibold">Prep List</h2>

      {prepListByDay.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium mb-2">No Items to Prepare</h3>
            <p className="text-muted-foreground text-sm">
              When you have pending orders with upcoming dates, you'll see a summary of items to prepare here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Aggregated from {pendingOrderCount} pending order{pendingOrderCount !== 1 ? "s" : ""}
          </p>
          {prepListByDay.map((group) => (
            <Card key={group.daySlotDate || "unknown"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {group.daySlotDate ? formatDayLabel(group.daySlotDate) : "Unscheduled"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {group.items.map((item) => (
                    <div key={item.menuItemId} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{item.itemTitle}</h4>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-primary">{item.totalQuantity}</span>
                          <span className="text-sm text-muted-foreground ml-1">to make</span>
                        </div>
                      </div>
                      <div className="space-y-1 pl-2">
                        {item.orders.map((detail, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{detail.buyerName}</span>
                            {detail.quantity > 1 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                x{detail.quantity}
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={onViewOrder}
                              className="text-primary hover:underline text-xs"
                            >
                              Order #{detail.orderId}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
});

export default PrepListTab;
