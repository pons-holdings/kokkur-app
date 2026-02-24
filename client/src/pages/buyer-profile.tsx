import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Header } from "@/components/header";
import { useBuyerStore } from "@/lib/buyer-store";
import { getCoordinatesFromZip } from "@/lib/location-store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, MapPin, AlertTriangle, Loader2, Upload, ImageIcon, X, Bell } from "lucide-react";
import { BuyerOrdersList } from "@/components/buyer-orders-list";
import type { Allergen, BuyerProfileWithAllergens } from "@shared/schema";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

const profileFormSchema = z.object({
  profileImageUrl: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Phone must be at least 10 characters"),
  addressStreet: z.string().min(1, "Street address is required"),
  addressUnit: z.string().optional(),
  addressCity: z.string().min(1, "City is required"),
  addressState: z.string().min(1, "State is required"),
  addressZip: z.string().length(5, "ZIP must be 5 digits"),
  allergenIds: z.array(z.number()).default([]),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function BuyerProfile() {
  const { sessionId, profileId, setProfileId } = useBuyerStore();
  const { toast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: profile, isLoading } = useQuery<BuyerProfileWithAllergens>({
    queryKey: ["/api/buyer-profile", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/buyer-profile/${sessionId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  const { data: allergens } = useQuery<Allergen[]>({
    queryKey: ["/api/allergens"],
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      profileImageUrl: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      addressStreet: "",
      addressUnit: "",
      addressCity: "",
      addressState: "",
      addressZip: "",
      allergenIds: [],
    },
  });

  // Populate form when profile data loads
  useEffect(() => {
    if (profile) {
      form.reset({
        profileImageUrl: profile.profileImageUrl || "",
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phone: profile.phone || "",
        addressStreet: profile.addressStreet || "",
        addressUnit: profile.addressUnit || "",
        addressCity: profile.addressCity || "",
        addressState: profile.addressState || "",
        addressZip: profile.addressZip || "",
        allergenIds: profile.allergens?.map((a) => a.id) || [],
      });
      if (!profileId && profile.id) {
        setProfileId(profile.id);
      }
    }
  }, [profile]);

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

  const saveMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const { allergenIds, profileImageUrl, ...profileData } = data;

      // Resolve zip to lat/long
      let addressLat: number | undefined;
      let addressLong: number | undefined;
      if (profileData.addressZip) {
        const coords = getCoordinatesFromZip(profileData.addressZip);
        if (coords) {
          addressLat = coords.lat;
          addressLong = coords.lng;
        }
      }

      const payload = { ...profileData, profileImageUrl: profileImageUrl || null, addressLat, addressLong };

      let savedProfileId = profileId || profile?.id;

      if (!savedProfileId) {
        // Create new profile
        const res = await apiRequest("POST", "/api/buyer-profile", {
          ...payload,
          sessionId,
        });
        const created = await res.json();
        savedProfileId = created.id;
        setProfileId(created.id);
      } else {
        // Update existing profile
        await apiRequest("PATCH", `/api/buyer-profile/${savedProfileId}`, payload);
      }

      // Update allergens
      await apiRequest("PUT", `/api/buyer-profile/${savedProfileId}/allergens`, {
        allergenIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buyer-profile", sessionId] });
      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="orders">My Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <BuyerOrdersList buyerProfileId={profileId} />
          </TabsContent>

          <TabsContent value="profile">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Photo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ImageIcon className="h-5 w-5" />
                  Profile Photo
                </CardTitle>
                <CardDescription>Your public profile image</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="profileImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="space-y-3">
                          <input
                            id="buyer-profile-image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingImage}
                            onChange={(e) => handleImageUpload(e, field.onChange)}
                          />
                          {field.value ? (
                            <div className="flex flex-col items-start gap-3">
                              <div className="w-32 h-32 rounded-full overflow-hidden bg-muted">
                                <img
                                  src={field.value}
                                  alt="Profile preview"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={uploadingImage}
                                  onClick={() => document.getElementById("buyer-profile-image-upload")?.click()}
                                >
                                  {uploadingImage ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <Upload className="h-4 w-4 mr-1" />
                                  )}
                                  Change Photo
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => field.onChange("")}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <label
                              htmlFor="buyer-profile-image-upload"
                              className="flex flex-col items-center justify-center w-32 h-32 rounded-full border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors"
                            >
                              {uploadingImage ? (
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                              ) : (
                                <Upload className="h-8 w-8 text-muted-foreground" />
                              )}
                            </label>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5" />
                  Personal Info
                </CardTitle>
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
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="addressStreet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apt / Unit (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Apt 4B" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="addressCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="addressState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="State" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="addressZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" maxLength={5} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Allergen Preferences */}
            {allergens && allergens.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Allergen Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select any allergens you'd like to be flagged when browsing menus.
                  </p>
                  <FormField
                    control={form.control}
                    name="allergenIds"
                    render={() => (
                      <FormItem>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {allergens.map((allergen) => (
                            <FormField
                              key={allergen.id}
                              control={form.control}
                              name="allergenIds"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(allergen.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          field.onChange([...field.value, allergen.id]);
                                        } else {
                                          field.onChange(field.value?.filter((id) => id !== allergen.id));
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">
                                    {allergen.name}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Notification Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>How you'd like to receive updates about your orders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notif-in-app"
                    checked={true}
                    disabled
                  />
                  <label htmlFor="notif-in-app" className="text-sm font-normal">In-app notifications</label>
                  <span className="text-xs text-muted-foreground">(always on)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="notif-email" disabled />
                  <label htmlFor="notif-email" className="text-sm font-normal text-muted-foreground">Email notifications (coming soon)</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="notif-text" disabled />
                  <label htmlFor="notif-text" className="text-sm font-normal text-muted-foreground">Text notifications (coming soon)</label>
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </Button>
          </form>
        </Form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
