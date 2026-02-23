import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Loader2,
  Upload,
  ImageIcon,
  X,
  MapPin,
  Truck,
  Store,
  User,
  Plus,
  CreditCard,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCoordinatesFromZip, getLocationNameFromZip } from "@/lib/location-store";
import { chefProfileSchema, type ChefProfileFormData, type ChefProfileWithDaySlots } from "./types";

interface ProfileTabProps {
  chef: ChefProfileWithDaySlots | undefined;
}

export default function ProfileTab({ chef }: ProfileTabProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [zipInput, setZipInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ChefProfileFormData>({
    resolver: zodResolver(chefProfileSchema),
    values: chef
      ? {
          firstName: chef.firstName,
          lastName: chef.lastName,
          email: chef.email || "",
          phone: chef.phone || "",
          slug: chef.slug || "",
          bio: chef.bio || "",
          profileImageUrl: chef.profileImageUrl || "",
          locationLat: chef.locationLat,
          locationLong: chef.locationLong,
          locationName: chef.locationName || "",
          serviceRadius: chef.serviceRadius,
          fulfillmentMethod: chef.fulfillmentMethod,
          deliveryFee: chef.deliveryFee ?? 0,
          cuisineTags: chef.cuisineTags || [],
          paymentMethods: (chef.paymentMethods as Array<{ method: string; handle: string }>) || [],
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: async (data: ChefProfileFormData) => {
      const res = await fetch(`/api/chefs/${chef!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = useCallback(
    (data: ChefProfileFormData) => mutation.mutate(data),
    [mutation]
  );

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldOnChange: (value: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Failed to upload image");
      fieldOnChange(objectPath);
      toast({ title: "Image uploaded", description: "Your profile photo has been uploaded." });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleResolveZip = useCallback(() => {
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      toast({ title: "Invalid zip code", description: "Please enter a 5-digit zip code.", variant: "destructive" });
      return;
    }
    const coords = getCoordinatesFromZip(zip);
    if (!coords) {
      toast({ title: "Zip code not found", description: "Could not resolve coordinates for this zip code.", variant: "destructive" });
      return;
    }
    const name = getLocationNameFromZip(zip) || zip;
    form.setValue("locationLat", coords.lat, { shouldDirty: true });
    form.setValue("locationLong", coords.lng, { shouldDirty: true });
    form.setValue("locationName", name, { shouldDirty: true });
    setZipInput("");
    toast({ title: "Location updated", description: `Set to ${name}` });
  }, [zipInput, form, toast]);

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim();
    if (!tag) return;
    const current = form.getValues("cuisineTags") || [];
    if (current.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      toast({ title: "Duplicate tag", description: "This cuisine tag already exists.", variant: "destructive" });
      return;
    }
    form.setValue("cuisineTags", [...current, tag], { shouldDirty: true });
    setNewTag("");
  }, [newTag, form, toast]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      const current = form.getValues("cuisineTags") || [];
      form.setValue(
        "cuisineTags",
        current.filter((t) => t !== tag),
        { shouldDirty: true }
      );
    },
    [form]
  );

  const fulfillmentMethod = form.watch("fulfillmentMethod");
  const showDeliveryFee = fulfillmentMethod === "delivery" || fulfillmentMethod === "both";

  if (!chef) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a chef to edit their profile.
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Your public profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="your@email.com" {...field} />
                      </FormControl>
                      <FormDescription>For order notifications</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormDescription>For order notifications</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile URL</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">/chef/</span>
                        <Input placeholder="your-url" {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>Unique URL for your public profile page</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell customers about yourself and your cooking..."
                        className="resize-none min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Profile Image */}
              <FormField
                control={form.control}
                name="profileImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Profile Photo
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {field.value ? (
                          <div className="relative w-32 h-32 rounded-full overflow-hidden bg-muted">
                            <img
                              src={field.value}
                              alt="Profile preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7"
                              onClick={() => field.onChange("")}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <label
                            htmlFor="profile-image-upload"
                            className="flex flex-col items-center justify-center w-32 h-32 rounded-full border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors"
                          >
                            {uploadingImage ? (
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            ) : (
                              <Upload className="h-8 w-8 text-muted-foreground" />
                            )}
                            <input
                              id="profile-image-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingImage}
                              onChange={(e) => handleImageUpload(e, field.onChange)}
                            />
                          </label>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cuisine Tags */}
              <FormField
                control={form.control}
                name="cuisineTags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuisine Tags</FormLabel>
                    <FormDescription>Add tags to help customers find your food</FormDescription>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., Mexican, Italian, BBQ"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTag();
                              }
                            }}
                          />
                          <Button type="button" variant="outline" onClick={handleAddTag}>
                            Add
                          </Button>
                        </div>
                        {field.value && field.value.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {field.value.map((tag) => (
                              <Badge key={tag} variant="secondary" className="gap-1">
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTag(tag)}
                                  className="ml-0.5 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Location & Service Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location & Service Area
              </CardTitle>
              <CardDescription>Where you operate and how far you serve</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current location display */}
              <div className="text-sm">
                <span className="text-muted-foreground">Current location: </span>
                <span className="font-medium">{form.watch("locationName") || "Not set"}</span>
                <span className="text-muted-foreground ml-2">
                  ({form.watch("locationLat")?.toFixed(4)}, {form.watch("locationLong")?.toFixed(4)})
                </span>
              </div>

              {/* Zip code update */}
              <div>
                <FormLabel>Update Location</FormLabel>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Enter zip code"
                    value={zipInput}
                    onChange={(e) => setZipInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleResolveZip();
                      }
                    }}
                    className="w-40"
                  />
                  <Button type="button" variant="outline" onClick={handleResolveZip}>
                    <MapPin className="h-4 w-4 mr-1" />
                    Set
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="serviceRadius"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Radius</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          className="w-24"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                        <span className="text-sm text-muted-foreground">miles</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Fulfillment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Fulfillment
              </CardTitle>
              <CardDescription>How customers receive their orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fulfillmentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fulfillment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fulfillment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pickup">
                          <span className="flex items-center gap-2">
                            <Store className="h-4 w-4" /> Pickup Only
                          </span>
                        </SelectItem>
                        <SelectItem value="delivery">
                          <span className="flex items-center gap-2">
                            <Truck className="h-4 w-4" /> Delivery Only
                          </span>
                        </SelectItem>
                        <SelectItem value="both">
                          <span className="flex items-center gap-2">
                            <Store className="h-4 w-4" /> Both Pickup & Delivery
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showDeliveryFee && (
                <FormField
                  control={form.control}
                  name="deliveryFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Fee</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-24"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Set to $0 for free delivery</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              <CardDescription>
                How customers can pay you directly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="paymentMethods"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="space-y-3">
                        {field.value && field.value.length > 0 && (
                          <div className="space-y-2">
                            {field.value.map((pm, index) => (
                              <div key={index} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={pm.method}
                                    onValueChange={(value) => {
                                      const updated = [...field.value];
                                      updated[index] = { ...updated[index], method: value };
                                      field.onChange(updated);
                                    }}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue placeholder="Method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="venmo">Venmo</SelectItem>
                                      <SelectItem value="paypal">PayPal</SelectItem>
                                      <SelectItem value="zelle">Zelle</SelectItem>
                                      <SelectItem value="cashapp">Cash App</SelectItem>
                                      <SelectItem value="cash">Cash</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    placeholder="@username or email"
                                    value={pm.handle}
                                    onChange={(e) => {
                                      const updated = [...field.value];
                                      updated[index] = { ...updated[index], handle: e.target.value };
                                      field.onChange(updated);
                                    }}
                                    className="flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={() => {
                                      const updated = field.value.filter((_, i) => i !== index);
                                      field.onChange(updated);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </div>
                                {form.formState.errors.paymentMethods?.[index]?.method && (
                                  <p className="text-sm text-destructive">Select a payment method</p>
                                )}
                                {form.formState.errors.paymentMethods?.[index]?.handle && (
                                  <p className="text-sm text-destructive">
                                    {form.formState.errors.paymentMethods[index].handle.message}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const current = field.value || [];
                            field.onChange([...current, { method: "venmo", handle: "" }]);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add payment method
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
