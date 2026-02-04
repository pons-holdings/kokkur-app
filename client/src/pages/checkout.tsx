import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowLeft,
  Truck,
  Store,
  MapPin,
  Check,
  AlertCircle,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/header";
import { useCartStore } from "@/lib/cart-store";
import { useLocationStore, getCoordinatesFromZip } from "@/lib/location-store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getDistance } from "geolib";

const checkoutSchema = z.object({
  buyerName: z.string().min(2, "Name must be at least 2 characters"),
  buyerEmail: z.string().email("Please enter a valid email"),
  buyerPhone: z.string().min(10, "Please enter a valid phone number"),
  fulfillmentMethod: z.enum(["pickup", "delivery"]),
  deliveryAddress: z.string().optional(),
  deliveryZip: z.string().optional(),
  notes: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, navigate] = useLocation();
  const { items, chef, getTotal, clearCart } = useCartStore();
  const { lat: userLat, lng: userLng } = useLocationStore();
  const { toast } = useToast();
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      buyerName: "",
      buyerEmail: "",
      buyerPhone: "",
      fulfillmentMethod: chef?.fulfillmentMethod === "pickup" ? "pickup" : "delivery",
      deliveryAddress: "",
      deliveryZip: "",
      notes: "",
    },
  });

  const fulfillmentMethod = form.watch("fulfillmentMethod");
  const deliveryZip = form.watch("deliveryZip");

  const total = getTotal();
  const deliveryFee = fulfillmentMethod === "delivery" && chef?.deliveryFee ? chef.deliveryFee : 0;

  const isDeliveryValid = useMemo(() => {
    if (fulfillmentMethod !== "delivery" || !chef || !deliveryZip) {
      setDeliveryError(null);
      return true;
    }

    if (deliveryZip.length !== 5) {
      setDeliveryError(null);
      return false;
    }

    const coords = getCoordinatesFromZip(deliveryZip);
    if (!coords) {
      setDeliveryError("Could not verify this zip code");
      return false;
    }

    const distanceMeters = getDistance(
      { latitude: coords.lat, longitude: coords.lng },
      { latitude: chef.locationLat, longitude: chef.locationLong }
    );
    const distanceMiles = distanceMeters / 1609.34;

    if (distanceMiles > chef.serviceRadius) {
      setDeliveryError(
        `This address is ${distanceMiles.toFixed(1)} miles away, outside the chef's ${chef.serviceRadius} mile delivery radius.`
      );
      return false;
    }

    setDeliveryError(null);
    return true;
  }, [fulfillmentMethod, chef, deliveryZip]);

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      if (!chef) throw new Error("No chef selected");

      const coords = data.deliveryZip ? getCoordinatesFromZip(data.deliveryZip) : null;

      const orderData = {
        chefId: chef.id,
        buyerName: data.buyerName,
        buyerEmail: data.buyerEmail,
        buyerPhone: data.buyerPhone,
        totalAmount: total + deliveryFee,
        fulfillmentMethod: data.fulfillmentMethod,
        deliveryAddress: data.fulfillmentMethod === "delivery" ? data.deliveryAddress : null,
        deliveryLat: coords?.lat || null,
        deliveryLong: coords?.lng || null,
        notes: data.notes || null,
        items: items.map((item) => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          priceAtOrder: item.servingOption.price,
          itemTitle: item.menuItem.title,
          servingOptionLabel: item.servingOption.label,
        })),
      };

      return apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      toast({
        title: "Order placed successfully!",
        description: "The chef has been notified and will prepare your order.",
      });
      clearCart();
      navigate("/order-success");
    },
    onError: (error: Error) => {
      toast({
        title: "Order failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CheckoutForm) => {
    if (fulfillmentMethod === "delivery" && !isDeliveryValid) {
      toast({
        title: "Delivery address invalid",
        description: deliveryError || "Please enter an address within the delivery area.",
        variant: "destructive",
      });
      return;
    }

    createOrderMutation.mutate(data);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Your Cart is Empty</h1>
          <p className="text-muted-foreground mb-6">
            Add some items to your cart before checking out.
          </p>
          <Link href="/">
            <Button data-testid="button-browse">Browse Chefs</Button>
          </Link>
        </div>
      </div>
    );
  }

  const canDelivery = chef?.fulfillmentMethod !== "pickup";
  const canPickup = chef?.fulfillmentMethod !== "delivery";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <Link href="/cart">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cart
          </Button>
        </Link>

        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid lg:grid-cols-[1fr_380px] gap-8">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="buyerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="buyerEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="john@example.com"
                                {...field}
                                data-testid="input-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="buyerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="(555) 123-4567"
                                {...field}
                                data-testid="input-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fulfillment Method</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="fulfillmentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="grid sm:grid-cols-2 gap-4"
                            >
                              <div>
                                <RadioGroupItem
                                  value="delivery"
                                  id="delivery"
                                  className="peer sr-only"
                                  disabled={!canDelivery}
                                />
                                <Label
                                  htmlFor="delivery"
                                  className={`flex items-center gap-3 rounded-md border-2 p-4 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 ${
                                    !canDelivery ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                  data-testid="radio-delivery"
                                >
                                  <Truck className="h-5 w-5 text-primary" />
                                  <div>
                                    <p className="font-medium">Delivery</p>
                                    <p className="text-sm text-muted-foreground">
                                      {chef?.deliveryFee
                                        ? `$${chef.deliveryFee.toFixed(2)} fee`
                                        : "Free delivery"}
                                    </p>
                                  </div>
                                </Label>
                              </div>

                              <div>
                                <RadioGroupItem
                                  value="pickup"
                                  id="pickup"
                                  className="peer sr-only"
                                  disabled={!canPickup}
                                />
                                <Label
                                  htmlFor="pickup"
                                  className={`flex items-center gap-3 rounded-md border-2 p-4 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 ${
                                    !canPickup ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                  data-testid="radio-pickup"
                                >
                                  <Store className="h-5 w-5 text-primary" />
                                  <div>
                                    <p className="font-medium">Pickup</p>
                                    <p className="text-sm text-muted-foreground">
                                      Collect from chef
                                    </p>
                                  </div>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {fulfillmentMethod === "delivery" && (
                      <div className="space-y-4 pt-4 border-t">
                        <FormField
                          control={form.control}
                          name="deliveryAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Delivery Address</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="123 Main St, Apt 4B"
                                  {...field}
                                  data-testid="input-address"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="deliveryZip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zip Code</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    placeholder="10001"
                                    maxLength={5}
                                    {...field}
                                    className={
                                      deliveryError
                                        ? "border-destructive pr-10"
                                        : isDeliveryValid && field.value?.length === 5
                                        ? "border-primary pr-10"
                                        : ""
                                    }
                                    data-testid="input-delivery-zip"
                                  />
                                  {field.value?.length === 5 && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                      {deliveryError ? (
                                        <AlertCircle className="h-4 w-4 text-destructive" />
                                      ) : (
                                        <Check className="h-4 w-4 text-primary" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              {deliveryError && (
                                <p className="text-sm text-destructive flex items-center gap-1.5 mt-1">
                                  <AlertCircle className="h-4 w-4" />
                                  {deliveryError}
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Order Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Any special instructions or requests..."
                              className="resize-none"
                              {...field}
                              data-testid="input-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.menuItem.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.quantity}x {item.menuItem.title}
                          </span>
                          <span>${(item.menuItem.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${total.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {fulfillmentMethod === "delivery" ? "Delivery Fee" : "Pickup"}
                      </span>
                      <span>
                        {deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : "Free"}
                      </span>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-lg">${(total + deliveryFee).toFixed(2)}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={
                        createOrderMutation.isPending ||
                        (fulfillmentMethod === "delivery" && !isDeliveryValid)
                      }
                      data-testid="button-place-order"
                    >
                      {createOrderMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Place Order"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
