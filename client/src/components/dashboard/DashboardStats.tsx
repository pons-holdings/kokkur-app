import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  UtensilsCrossed,
  Calendar,
  Package,
  ClipboardList,
} from "lucide-react";

interface DashboardStatsProps {
  menuItemCount: number;
  scheduledDayCount: number;
  pendingOrderCount: number;
  prepItemCount: number;
}

const DashboardStats = React.memo(function DashboardStats({
  menuItemCount,
  scheduledDayCount,
  pendingOrderCount,
  prepItemCount,
}: DashboardStatsProps) {
  return (
    <div className="grid md:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
              <UtensilsCrossed className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{menuItemCount}</p>
              <p className="text-sm text-muted-foreground">Food Items</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{scheduledDayCount}</p>
              <p className="text-sm text-muted-foreground">Scheduled Days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
              <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingOrderCount}</p>
              <p className="text-sm text-muted-foreground">Pending Orders</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/30">
              <ClipboardList className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{prepItemCount}</p>
              <p className="text-sm text-muted-foreground">Items to Prepare</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default DashboardStats;
