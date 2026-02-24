import React, { useCallback, useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  Check,
  X,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPaymentMethodLabel } from "@/lib/payment-utils";
import type { OrderWithItems } from "./types";

interface OrdersTabProps {
  orders: OrderWithItems[] | undefined;
  ordersLoading: boolean;
  chefId: number | undefined;
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  confirmed: "outline",
  paid: "outline",
  ready: "default",
  completed: "default",
  cancelled: "destructive",
};

const OrdersTab = React.memo(function OrdersTab({
  orders,
  ordersLoading,
  chefId,
}: OrdersTabProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (statusFilter === "all") return orders;
    if (statusFilter === "active") {
      return orders.filter((o) => !["completed", "cancelled"].includes(o.status));
    }
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

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

  const handleStatusChange = useCallback((orderId: number, status: string) => {
    updateOrderStatusMutation.mutate({ orderId, status });
  }, [updateOrderStatusMutation]);

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Orders</h2>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      {ordersLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (<Card key={i}><CardContent className="py-4"><Skeleton className="h-20" /></CardContent></Card>))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium mb-2">No Orders</h3>
            <p className="text-muted-foreground text-sm">
              {statusFilter === "all"
                ? "Orders will appear here when customers place them."
                : `No ${statusFilter} orders.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Order #{order.id}</CardTitle>
                    <CardDescription>
                      {order.buyerName} &bull; {order.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup"}
                    </CardDescription>
                  </div>
                  <Badge variant={statusBadgeVariant[order.status] || "outline"}>
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

                {order.paymentMethod && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>
                      {getPaymentMethodLabel(order.paymentMethod)}
                      {order.paymentHandle ? `: ${order.paymentHandle}` : ""}
                    </span>
                  </div>
                )}

                {order.deliveryAddress && (<p className="text-sm text-muted-foreground">Deliver to: {order.deliveryAddress}</p>)}
                {order.notes && (<p className="text-sm text-muted-foreground">Note: {order.notes}</p>)}
              </CardContent>
              <CardFooter className="gap-2">
                {order.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => handleStatusChange(order.id, "confirmed")} disabled={updateOrderStatusMutation.isPending}>
                      <Check className="h-4 w-4 mr-1" />Confirm
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleStatusChange(order.id, "cancelled")} disabled={updateOrderStatusMutation.isPending}>
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  </>
                )}
                {order.status === "confirmed" && (
                  <>
                    <Button size="sm" onClick={() => handleStatusChange(order.id, "paid")} disabled={updateOrderStatusMutation.isPending}>
                      <CreditCard className="h-4 w-4 mr-1" />Mark Paid
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleStatusChange(order.id, "cancelled")} disabled={updateOrderStatusMutation.isPending}>
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  </>
                )}
                {order.status === "paid" && (
                  <>
                    <Button size="sm" onClick={() => handleStatusChange(order.id, "ready")} disabled={updateOrderStatusMutation.isPending}>
                      <Check className="h-4 w-4 mr-1" />Mark Ready
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleStatusChange(order.id, "cancelled")} disabled={updateOrderStatusMutation.isPending}>
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  </>
                )}
                {order.status === "ready" && (
                  <Button size="sm" onClick={() => handleStatusChange(order.id, "completed")} disabled={updateOrderStatusMutation.isPending}>
                    <Check className="h-4 w-4 mr-1" />Complete
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
