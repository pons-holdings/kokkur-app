import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { useLocationStore, getCoordinatesFromZip } from "@/lib/location-store";
import { useToast } from "@/hooks/use-toast";

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationModal({ open, onOpenChange }: LocationModalProps) {
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { setLocation } = useLocationStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (zipCode.length !== 5 || !/^\d+$/.test(zipCode)) {
      toast({
        title: "Invalid zip code",
        description: "Please enter a valid 5-digit zip code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const coords = getCoordinatesFromZip(zipCode);
    
    if (coords) {
      setLocation(zipCode, coords.lat, coords.lng);
      onOpenChange(false);
      toast({
        title: "Location set",
        description: `Finding chefs near ${zipCode}`,
      });
    } else {
      toast({
        title: "Could not find location",
        description: "Please try a different zip code",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Find Local Chefs</DialogTitle>
          <DialogDescription className="text-center">
            Enter your zip code to discover chefs cooking in your neighborhood
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input
              id="zipCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              placeholder="10001"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-widest"
              data-testid="input-zipcode"
            />
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={loading || zipCode.length !== 5}
            data-testid="button-find-chefs"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding chefs...
              </>
            ) : (
              "Find Chefs Near Me"
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Try: 10001, 10011, 11201 for demo locations
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
