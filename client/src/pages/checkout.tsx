import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Check,
  AlertCircle,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/header";
import { useCartStore } from "@/lib/cart-store";
import { getCoordinatesFromZip } from "@/lib/location-store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getDistance } from "geolib";
import { getChefDisplayName, getChefInitials } from "@/lib/chef-utils";
import type { ChefProfile } from "@shared/schema";

// Build a per-chef fulfillment schema dynamically
const chefFulfillmentSchema = z.object({
  chefId: z.number(),
  fulfillmentMethod: z.enum(["pickup", "delivery"]),
  deliveryAddress: z.string().optional(),
  deliveryZip: z.string().optional(),
  notes: z.string().optional(),
});

const checkoutSchema = z.object({
  buyerName: z.string().min(2, "Name must be at least 2 characters"),
  buyerEmail: z.string().email("Please enter a valid email"),
  buyerPhone: z.string().min(10, "Please enter a valid phone number"),
  chefFulfillments: z.array(chefFulfillmentSchema),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

function validateDelivery(chef: ChefProfile, zip: string): { valid: boolean; error: string | null } {
  if (zip.length !== 5) return { valid: false, error: null };

  const coords = getCoordinatesFromZip(zip);
  if (!coords) return { valid: false, error: "Could not verify this zip code" };

  const distanceMeters = getDistance(
    { latitude: coords.lat, longitude: coords.lng },
    { latitude: chef.locationLat, longitude: chef.locationLong }
  );
  const distanceMiles = distanceMeters / 1609.34;

  if (distanceMiles > chef.serviceRadius) {
    return {
      valid: false,
      error: `This address is ${distanceMiles.toFixed(1)} miles away, outside ${getChefDisplayName(chef)}'s ${chef.serviceRadius} mile delivery radius.`,
    };
  }

  return { valid: true, error: null };
}

export default function Checkout() {
  const [, navigate] = useLocation();
  const { items, getTotal, getItemsByChef, clearCart } = useCartStore();
  const { toast } = useToast();
  const [deliveryErrors, setDeliveryErrors] = useState<Record<number, string | null>>({});

  const chefGroups = useMemo(() => {
    const map = getItemsByChef();
    return Array.from(map.entries()).map(([chefId, { chef, items }]) => {
      const subtotal = items.reduce((sum, i) => sum + i.servingOption.price * i.quantity, 0);
      return { chefId, chef, items, subtotal };
    });
  }, [items]);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      buyerName: "",
      buyerEmail: "",
      buyerPhone: "",
      chefFulfillments: chefGroups.map(({ chefId, chef }) => ({
        chefId,
        fulfillmentMethod: chef?.fulfillmentMethod === "pickup" ? "pickup" as const : "delivery" as const,
        deliveryAddress: "",
        deliveryZip: "",
        notes: "",
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "chefFulfillments",
  });

  const total = getTotal();

  // Compute delivery fees and validation per chef
  const chefDeliveryInfo = useMemo(() => {
    const info: Record<number, { fee: number; valid: boolean; error: string | null }> = {};
    const values = form.getValues();
    chefGroups.forEach(({ chefId, chef }, idx) => {
      const fulfillment = values.chefFulfillments?.[idx];
      if (fulfillment?.fulfillmentMethod === "delivery" && chef) {
        const fee = chef.deliveryFee || 0;
        const zip = fulfillment.deliveryZip || "";
        const result = zip.length === 5 ? validateDelivery(chef, zip) : { valid: false, error: null };
        info[chefId] = { fee, ...result };
      } else {
        info[chefId] = { fee: 0, valid: true, error: null };
      }
    });
    return info;
  }, [chefGroups, form.watch("chefFulfillments")]);

  const grandDeliveryFee = Object.values(chefDeliveryInfo).reduce((sum, i) => sum + i.fee, 0);
  const allDeliveryValid = Object.values(chefDeliveryInfo).every((i) => i.valid);
  const isMultiChef = chefGroups.length > 1;

  const createOrdersMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const promises = chefGroups.map(({ chefId, chef, items }, idx) => {
        const fulfillment = data.chefFulfillments[idx];
        const coords = fulfillment.deliveryZip ? getCoordinatesFromZip(fulfillment.deliveryZip) : null;
        const fee = fulfillment.fulfillmentMethod === "delivery" && chef?.deliveryFee ? chef.deliveryFee : 0;
        const subtotal = items.reduce((sum, i) => sum + i.servingOption.price * i.quantity, 0);

        const orderData = {
          chefId,
          buyerName: data.buyerName,
          buyerEmail: data.buyerEmail,
          buyerPhone: data.buyerPhone,
          totalAmount: subtotal + fee,
          fulfillmentMethod: fulfillment.fulfillmentMethod,
          deliveryAddress: fulfillment.fulfillmentMethod === "delivery" ? fulfillment.deliveryAddress : null,
          deliveryLat: coords?.lat || null,
          deliveryLong: coords?.lng || null,
          notes: fulfillment.notes || null,
          items: items.map((item) => ({
            menuItemId: item.menuItem.id,
            quantity: item.quantity,
            priceAtOrder: item.servingOption.price,
            itemTitle: item.menuItem.title,
            servingOptionLabel: item.servingOption.label,
          })),
        };

        return apiRequest("POST", "/api/orders", orderData);
      });

      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: isMultiChef ? "Orders placed successfully!" : "Order placed successfully!",
        description: isMultiChef
          ? "All chefs have been notified and will prepare your orders."
          : "The chef has been notified and will prepare your order.",
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
    // Validate all delivery addresses
    let hasError = false;
    const newErrors: Record<number, string | null> = {};

    data.chefFulfillments.forEach((fulfillment, idx) => {
      const chef = chefGroups[idx]?.chef;
      if (fulfillment.fulfillmentMethod === "delivery" && chef) {
        const zip = fulfillment.deliveryZip || "";
        const result = validateDelivery(chef, zip);
        if (!result.valid) {
          hasError = true;
          newErrors[fulfillment.chefId] = result.error || "Please enter a valid delivery zip code.";
        }
      }
    });

    if (hasError) {
      setDeliveryErrors(newErrors);
      toast({
        title: "Delivery address invalid",
        description: "One or more delivery addresses are outside the delivery area.",
        variant: "destructive",
      });
      return;
    }

    setDeliveryErrors({});
    createOrdersMutation.mutate(data);
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
            <Button data-testid="button-browse">Browse Menus</Button>
          </Link>
        </div>
      </div>
    );
  }

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
                {/* Contact Information — shared across all orders */}
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

                {/* Per-chef fulfillment sections */}
                {fields.map((field, idx) => {
                  const group = chefGroups[idx];
                  if (!group) return null;
                  const { chef } = group;
                  const canDelivery = chef?.fulfillmentMethod !== "pickup";
                  const canPickup = chef?.fulfillmentMethod !== "delivery";
                  const fulfillmentMethod = form.watch(`chefFulfillments.${idx}.fulfillmentMethod`);
                  const deliveryZip = form.watch(`chefFulfillments.${idx}.deliveryZip`);
                  const chefDeliveryError = deliveryErrors[group.chefId] || null;
                  const deliveryFee = fulfillmentMethod === "delivery" && chef?.deliveryFee ? chef.deliveryFee : 0;

                  // Live validation for zip
                  let zipValid = true;
                  let zipError: string | null = null;
                  if (fulfillmentMethod === "delivery" && deliveryZip && deliveryZip.length === 5 && chef) {
                    const result = validateDelivery(chef, deliveryZip);
                    zipValid = result.valid;
                    zipError = result.error;
                  }

                  return (
                    <Card key={field.id}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={chef?.profileImageUrl || undefined} alt={getChefDisplayName(chef)} referrerPolicy="no-referrer" />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                              {getChefInitials(chef)}
                            </AvatarFallback>
                          </Avatar>
                          <CardTitle className="text-lg">
                            {isMultiChef ? `Fulfillment — ${getChefDisplayName(chef)}` : "Fulfillment Method"}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name={`chefFulfillments.${idx}.fulfillmentMethod`}
                          render={({ field: radioField }) => (
                            <FormItem>
                              <FormControl>
                                <RadioGroup
                                  value={radioField.value}
                                  onValueChange={radioField.onChange}
                                  className="grid sm:grid-cols-2 gap-4"
                                >
                                  <div>
                                    <RadioGroupItem
                                      value="delivery"
                                      id={`delivery-${idx}`}
                                      className="peer sr-only"
                                      disabled={!canDelivery}
                                    />
                                    <Label
                                      htmlFor={`delivery-${idx}`}
                                      className={`flex items-center gap-3 rounded-md border-2 p-4 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 ${
                                        !canDelivery ? "opacity-50 cursor-not-allowed" : ""
                                      }`}
                                      data-testid={`radio-delivery-${idx}`}
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
                                      id={`pickup-${idx}`}
                                      className="peer sr-only"
                                      disabled={!canPickup}
                                    />
                                    <Label
                                      htmlFor={`pickup-${idx}`}
                                      className={`flex items-center gap-3 rounded-md border-2 p-4 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 ${
                                        !canPickup ? "opacity-50 cursor-not-allowed" : ""
                                      }`}
                                      data-testid={`radio-pickup-${idx}`}
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
                              name={`chefFulfillments.${idx}.deliveryAddress`}
                              render={({ field: addrField }) => (
                                <FormItem>
                                  <FormLabel>Delivery Address</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="123 Main St, Apt 4B"
                                      {...addrField}
                                      data-testid={`input-address-${idx}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`chefFulfillments.${idx}.deliveryZip`}
                              render={({ field: zipField }) => (
                                <FormItem>
                                  <FormLabel>Zip Code</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        placeholder="10001"
                                        maxLength={5}
                                        {...zipField}
                                        className={
                                          (zipError || chefDeliveryError)
                                            ? "border-destructive pr-10"
                                            : zipValid && zipField.value?.length === 5
                                            ? "border-primary pr-10"
                                            : ""
                                        }
                                        data-testid={`input-delivery-zip-${idx}`}
                                      />
                                      {zipField.value?.length === 5 && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                          {(zipError || chefDeliveryError) ? (
                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                          ) : (
                                            <Check className="h-4 w-4 text-primary" />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  {(zipError || chefDeliveryError) && (
                                    <p className="text-sm text-destructive flex items-center gap-1.5 mt-1">
                                      <AlertCircle className="h-4 w-4" />
                                      {zipError || chefDeliveryError}
                                    </p>
                                  )}
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {/* Order notes per chef */}
                        <div className="pt-4 border-t">
                          <FormField
                            control={form.control}
                            name={`chefFulfillments.${idx}.notes`}
                            render={({ field: notesField }) => (
                              <FormItem>
                                <FormLabel>
                                  {isMultiChef ? `Notes for ${getChefDisplayName(chef)}` : "Order Notes"}
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Any special instructions or requests..."
                                    className="resize-none"
                                    {...notesField}
                                    data-testid={`input-notes-${idx}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Order Summary Sidebar */}
              <div>
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {chefGroups.map(({ chefId, chef, items: groupItems, subtotal }, idx) => {
                      const fulfillmentMethod = form.watch(`chefFulfillments.${idx}.fulfillmentMethod`);
                      const fee = fulfillmentMethod === "delivery" && chef?.deliveryFee ? chef.deliveryFee : 0;
                      return (
                        <div key={chefId} className="space-y-2">
                          <p className="text-sm font-medium">{getChefDisplayName(chef)}</p>
                          <div className="space-y-1 pl-2">
                            {groupItems.map((item) => (
                              <div key={`${item.menuItem.id}-${item.daySlotId}`} className="flex justify-between text-xs text-muted-foreground">
                                <span className="truncate mr-2">
                                  {item.quantity}x {item.menuItem.title}
                                </span>
                                <span className="shrink-0">${(item.servingOption.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between text-sm pl-2">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                          </div>
                          {fee > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground pl-2">
                              <span>Delivery fee</span>
                              <span>${fee.toFixed(2)}</span>
                            </div>
                          )}
                          {idx < chefGroups.length - 1 && <Separator className="my-2" />}
                        </div>
                      );
                    })}

                    <Separator />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${total.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Fees</span>
                      <span>{grandDeliveryFee > 0 ? `$${grandDeliveryFee.toFixed(2)}` : "Free"}</span>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-lg">${(total + grandDeliveryFee).toFixed(2)}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={createOrdersMutation.isPending}
                      data-testid="button-place-order"
                    >
                      {createOrdersMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        isMultiChef ? "Place Orders" : "Place Order"
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
