import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";
import type { PrepListItem } from "./types";

interface PrepListTabProps {
  prepList: PrepListItem[];
  pendingOrderCount: number;
}

const PrepListTab = React.memo(function PrepListTab({
  prepList,
  pendingOrderCount,
}: PrepListTabProps) {
  return (
    <>
      <h2 className="text-xl font-semibold">Prep List</h2>

      {prepList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium mb-2">No Items to Prepare</h3>
            <p className="text-muted-foreground text-sm">When you have pending orders, you'll see a summary of items to prepare here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Items to Prepare</CardTitle>
            <CardDescription>Aggregated from {pendingOrderCount} pending order{pendingOrderCount !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {prepList.map((item) => (
                <div key={item.menuItemId} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{item.itemTitle}</h4>
                    <p className="text-sm text-muted-foreground">From {item.orderCount} order{item.orderCount !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{item.totalQuantity}</p>
                    <p className="text-sm text-muted-foreground">to make</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
});

export default PrepListTab;
