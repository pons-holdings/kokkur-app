import React, { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OrderWithItems } from "./types";

interface OrdersTabProps {
  orders: OrderWithItems[] | undefined;
  ordersLoading: boolean;
  chefId: number | undefined;
}

const OrdersTab = React.memo(function OrdersTab({
  orders,
  ordersLoading,
  chefId,
}: OrdersTabProps) {
  const { toast } = useToast();

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return apiRequest("PATCH", `/api/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Order updated", description: "Order status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/chef", chefId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating order", description: error.message, variant: "destructive" });
    },
  });

  const handleConfirm = useCallback((orderId: number) => {
    updateOrderStatusMutation.mutate({ orderId, status: "confirmed" });
  }, [updateOrderStatusMutation]);

  const handleComplete = useCallback((orderId: number) => {
    updateOrderStatusMutation.mutate({ orderId, status: "completed" });
  }, [updateOrderStatusMutation]);

  return (
    <>
      <h2 className="text-xl font-semibold">Recent Orders</h2>

      {ordersLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (<Card key={i}><CardContent className="py-4"><Skeleton className="h-20" /></CardContent></Card>))}
        </div>
      ) : !orders || orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium mb-2">No Orders Yet</h3>
            <p className="text-muted-foreground text-sm">Orders will appear here when customers place them.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Order #{order.id}</CardTitle>
                    <CardDescription>{order.buyerName} &bull; {order.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup"}</CardDescription>
                  </div>
                  <Badge variant={order.status === "completed" ? "default" : order.status === "pending" ? "secondary" : "outline"}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.itemTitle}</span>
                      <span className="text-muted-foreground">${(Number(item.priceAtOrder) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>${Number(order.totalAmount).toFixed(2)}</span>
                </div>
                {order.deliveryAddress && (<p className="text-sm text-muted-foreground">Deliver to: {order.deliveryAddress}</p>)}
                {order.notes && (<p className="text-sm text-muted-foreground">Note: {order.notes}</p>)}
              </CardContent>
              <CardFooter className="gap-2">
                {order.status === "pending" && (
                  <Button size="sm" onClick={() => handleConfirm(order.id)} disabled={updateOrderStatusMutation.isPending} data-testid={`button-confirm-${order.id}`}>
                    <Check className="h-4 w-4 mr-1" />Confirm
                  </Button>
                )}
                {order.status === "confirmed" && (
                  <Button size="sm" onClick={() => handleComplete(order.id)} disabled={updateOrderStatusMutation.isPending} data-testid={`button-complete-${order.id}`}>
                    <Check className="h-4 w-4 mr-1" />Mark Complete
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
});

export default OrdersTab;
