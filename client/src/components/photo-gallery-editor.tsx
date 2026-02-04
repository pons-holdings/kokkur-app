import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Plus, Star, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Photo {
  id?: number;
  imageUrl: string;
  isCover?: number;
  sortOrder?: number;
}

interface PhotoGalleryEditorProps {
  menuItemId?: number;
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  onCoverChange?: (photoUrl: string) => void;
}

export function PhotoGalleryEditor({
  menuItemId,
  photos,
  onPhotosChange,
  onCoverChange,
}: PhotoGalleryEditorProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPhotoMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      if (menuItemId) {
        const res = await apiRequest("POST", `/api/menu-items/${menuItemId}/photos`, { imageUrl });
        return res.json();
      }
      return { imageUrl };
    },
    onSuccess: () => {
      if (menuItemId) {
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef"] });
        queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      }
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: number) => {
      await apiRequest("DELETE", `/api/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
    },
  });

  const setCoverMutation = useMutation({
    mutationFn: async ({ photoId }: { photoId: number }) => {
      if (menuItemId) {
        await apiRequest("POST", `/api/menu-items/${menuItemId}/photos/${photoId}/set-cover`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload JPEG, PNG, GIF, or WebP", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { url, publicUrl } = await urlRes.json();

      const uploadRes = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Failed to upload image");

      if (menuItemId) {
        await addPhotoMutation.mutateAsync(publicUrl);
      }

      const newPhoto: Photo = { imageUrl: publicUrl, isCover: photos.length === 0 ? 1 : 0 };
      const newPhotos = [...photos, newPhoto];
      onPhotosChange(newPhotos);

      if (photos.length === 0 && onCoverChange) {
        onCoverChange(publicUrl);
      }

      toast({ title: "Photo uploaded", description: "Your photo has been added successfully." });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: "Could not upload the image", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async (index: number) => {
    const photo = photos[index];
    if (photo.id && menuItemId) {
      try {
        await deletePhotoMutation.mutateAsync(photo.id);
      } catch (error) {
        toast({ title: "Error", description: "Could not delete photo", variant: "destructive" });
        return;
      }
    }
    const newPhotos = photos.filter((_, i) => i !== index);
    if (photo.isCover === 1 && newPhotos.length > 0) {
      newPhotos[0].isCover = 1;
      if (onCoverChange) onCoverChange(newPhotos[0].imageUrl);
    } else if (newPhotos.length === 0 && onCoverChange) {
      onCoverChange("");
    }
    onPhotosChange(newPhotos);
  };

  const handleSetCover = async (index: number) => {
    const photo = photos[index];
    if (photo.id && menuItemId) {
      try {
        await setCoverMutation.mutateAsync({ photoId: photo.id });
      } catch (error) {
        toast({ title: "Error", description: "Could not set cover photo", variant: "destructive" });
        return;
      }
    }
    const newPhotos = photos.map((p, i) => ({
      ...p,
      isCover: i === index ? 1 : 0,
    }));
    onPhotosChange(newPhotos);
    if (onCoverChange) onCoverChange(photo.imageUrl);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Dish Photos
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
          data-testid="input-photo-upload"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-1"
          data-testid="button-add-photo"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add Photo
        </Button>
      </div>

      {photos.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No photos yet. Add appetizing photos of your dish.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-md overflow-hidden bg-muted"
              data-testid={`photo-${index}`}
            >
              <img
                src={photo.imageUrl}
                alt={`Dish photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {photo.isCover !== 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSetCover(index)}
                    disabled={setCoverMutation.isPending}
                    className="gap-1"
                    data-testid={`button-set-cover-${index}`}
                  >
                    <Star className="h-3 w-3" />
                    Cover
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={() => handleRemove(index)}
                  disabled={deletePhotoMutation.isPending}
                  data-testid={`button-remove-photo-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {photo.isCover === 1 && (
                <Badge className="absolute top-2 left-2 gap-1" variant="secondary">
                  <Star className="h-3 w-3 fill-current" />
                  Cover
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        The cover photo will be shown in listings. Supports JPEG, PNG, GIF, WebP up to 10MB.
      </p>
    </div>
  );
}
