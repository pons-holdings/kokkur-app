import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Package, Truck, Store } from "lucide-react";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { getPaymentMethodLabel } from "@/lib/payment-utils";
import { getChefDisplayName, getChefInitials } from "@/lib/chef-utils";
import type { OrderWithItems } from "@shared/schema";

interface BuyerOrdersListProps {
  buyerProfileId: number | null;
}

export function BuyerOrdersList({ buyerProfileId }: BuyerOrdersListProps) {
  const { data: orders, isLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders/buyer", buyerProfileId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/buyer/${buyerProfileId}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    enabled: !!buyerProfileId,
  });

  if (!buyerProfileId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-medium mb-2">Set Up Your Profile</h3>
          <p className="text-muted-foreground text-sm">
            Create a profile to track your orders.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <Skeleton className="h-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-medium mb-2">No Orders Yet</h3>
          <p className="text-muted-foreground text-sm">
            Your orders will appear here after you place them.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {order.chef && (
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={order.chef.profileImageUrl || undefined}
                      alt={getChefDisplayName(order.chef)}
                      referrerPolicy="no-referrer"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                      {getChefInitials(order.chef)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <CardTitle className="text-base">Order #{order.id}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {order.chef ? getChefDisplayName(order.chef) : "Chef"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {order.fulfillmentMethod === "delivery" ? (
                  <Badge variant="outline" className="gap-1">
                    <Truck className="h-3 w-3" /> Delivery
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Store className="h-3 w-3" /> Pickup
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <OrderStatusTimeline status={order.status} />

            <div className="space-y-1">
              {order.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.itemTitle}</span>
                  <span className="text-muted-foreground">
                    ${(Number(item.priceAtOrder) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex justify-between font-medium text-sm">
              <span>Total</span>
              <span>${Number(order.totalAmount).toFixed(2)}</span>
            </div>

            {order.paymentMethod && (
              <p className="text-xs text-muted-foreground">
                Payment: {getPaymentMethodLabel(order.paymentMethod)}
                {order.paymentHandle ? ` (${order.paymentHandle})` : ""}
              </p>
            )}

            {order.notes && (
              <p className="text-xs text-muted-foreground">Note: {order.notes}</p>
            )}

            <p className="text-[10px] text-muted-foreground">
              Placed {new Date(order.createdAt!).toLocaleDateString()} at{" "}
              {new Date(order.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
