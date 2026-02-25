import React, { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { IngredientTypeahead } from "@/components/ingredient-typeahead";
import { ServingOptionsEditor } from "@/components/serving-options-editor";
import {
  AlertTriangle,
  Loader2,
  Upload,
  ImageIcon,
  X,
  CalendarClock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MenuItemFormData, Allergen } from "./types";
import type { ScheduleType } from "./types";

interface MenuItemFormTestIds {
  titleInput: string;
  descriptionInput?: string;
  removeImageButton: string;
  imageUploadInput: string;
  allergenCheckboxPrefix: string;
  submitButton: string;
}

interface MenuItemFormProps {
  form: UseFormReturn<MenuItemFormData>;
  allergens: Allergen[] | undefined;
  onSubmit: (data: MenuItemFormData) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  imageUploadId: string;
  testIds: MenuItemFormTestIds;
}

const MenuItemFormComponent = React.memo(function MenuItemFormComponent({
  form,
  allergens,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
  pendingLabel,
  imageUploadId,
  testIds,
}: MenuItemFormProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const { toast } = useToast();

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
      const uploadRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Failed to upload image");
      fieldOnChange(objectPath);
      toast({ title: "Image uploaded", description: "Your dish photo has been uploaded successfully." });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload image", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Homemade Lasagna" {...field} data-testid={testIds.titleInput} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe your dish..." className="resize-none" {...field} {...(testIds.descriptionInput ? { "data-testid": testIds.descriptionInput } : {})} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="servingOptions"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ServingOptionsEditor
                  options={field.value || []}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Dish Photo
              </FormLabel>
              <FormDescription>Upload an appetizing photo of your dish</FormDescription>
              <FormControl>
                <div className="space-y-3">
                  {field.value ? (
                    <div className="relative w-full h-40 rounded-md overflow-hidden bg-muted">
                      <img src={field.value} alt="Dish preview" className="w-full h-full object-cover" />
                      <Button type="button" variant="secondary" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => field.onChange("")} data-testid={testIds.removeImageButton}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label htmlFor={imageUploadId} className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
                      {uploadingImage ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Click to upload photo</span>
                          <span className="text-xs text-muted-foreground">PNG, JPG up to 10MB</span>
                        </div>
                      )}
                      <input
                        id={imageUploadId}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => handleImageUpload(e, field.onChange)}
                        data-testid={testIds.imageUploadInput}
                      />
                    </label>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {allergens && allergens.length > 0 && (
          <FormField
            control={form.control}
            name="allergenIds"
            render={() => (
              <FormItem>
                <div className="mb-2">
                  <FormLabel className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Allergens
                  </FormLabel>
                  <FormDescription>Select all allergens present in this dish</FormDescription>
                </div>
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
                              data-testid={`${testIds.allergenCheckboxPrefix}${allergen.id}`}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal cursor-pointer">{allergen.name}</FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="ingredientIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ingredients</FormLabel>
              <FormDescription>Search and add ingredients - allergens will auto-select based on ingredients</FormDescription>
              <FormControl>
                <IngredientTypeahead
                  selectedIds={field.value || []}
                  onChange={field.onChange}
                  onAllergensDetected={(newAllergenIds) => {
                    const currentAllergenIds = form.getValues("allergenIds") || [];
                    const mergedAllergenIds = Array.from(new Set([...currentAllergenIds, ...newAllergenIds]));
                    form.setValue("allergenIds", mergedAllergenIds, { shouldDirty: true, shouldValidate: true });
                  }}
                  placeholder="Search or add ingredients..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Availability / Scheduling Section */}
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Availability</h3>
          </div>
          <FormDescription>Set up automatic scheduling so this item appears on the right dates without manual setup.</FormDescription>

          <FormField
            control={form.control}
            name="scheduleType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Schedule Type</FormLabel>
                <Select value={field.value || "manual"} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="manual">Not scheduled (manual)</SelectItem>
                    <SelectItem value="one_off">One-time date</SelectItem>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekdays">Weekdays (Mon-Fri)</SelectItem>
                    <SelectItem value="weekends">Weekends (Sat-Sun)</SelectItem>
                    <SelectItem value="custom_days">Specific days of the week</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* One-off date picker */}
          {form.watch("scheduleType") === "one_off" && (
            <FormField
              control={form.control}
              name="oneOffDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Custom days checkboxes */}
          {form.watch("scheduleType") === "custom_days" && (
            <FormField
              control={form.control}
              name="scheduleDays"
              render={({ field }) => {
                const days = [
                  { value: 1, label: "Mon" },
                  { value: 2, label: "Tue" },
                  { value: 3, label: "Wed" },
                  { value: 4, label: "Thu" },
                  { value: 5, label: "Fri" },
                  { value: 6, label: "Sat" },
                  { value: 0, label: "Sun" },
                ];
                const selected = field.value || [];
                return (
                  <FormItem>
                    <FormLabel>Days of the week</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {days.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={selected.includes(day.value) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newDays = selected.includes(day.value)
                              ? selected.filter((d: number) => d !== day.value)
                              : [...selected, day.value];
                            field.onChange(newDays.length > 0 ? newDays : null);
                          }}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}

          {/* Start/End dates for recurring types */}
          {form.watch("scheduleType") && form.watch("scheduleType") !== "manual" && form.watch("scheduleType") !== "one_off" && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduleStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scheduleEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Cutoff lead time */}
          {form.watch("scheduleType") && form.watch("scheduleType") !== "manual" && (
            <FormField
              control={form.control}
              name="cutoffLeadHours"
              render={({ field }) => {
                const hours = field.value || 24;
                const displayDays = Math.floor(hours / 24);
                const displayHours = hours % 24;
                return (
                  <FormItem>
                    <FormLabel>Advance notice required</FormLabel>
                    <FormDescription>How far in advance must customers order?</FormDescription>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          value={field.value || 24}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 24)}
                          className="w-24"
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">
                        hours ({displayDays > 0 ? `${displayDays}d` : ""}{displayHours > 0 ? `${displayHours}h` : displayDays > 0 ? "" : "0h"})
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isPending} data-testid={testIds.submitButton}>
            {isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{pendingLabel}</>) : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
});

export default MenuItemFormComponent;
