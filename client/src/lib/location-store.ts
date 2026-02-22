import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocationState {
  zipCode: string | null;
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  geoStatus: "idle" | "requesting" | "granted" | "denied";
  setLocation: (zipCode: string, lat: number, lng: number, name?: string) => void;
  setLocationFromCoords: (lat: number, lng: number, name: string) => void;
  setGeoStatus: (status: "idle" | "requesting" | "granted" | "denied") => void;
  clearLocation: () => void;
}

const ZIP_CODE_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  "10001": { lat: 40.7484, lng: -73.9967, name: "New York, NY" },
  "10002": { lat: 40.7157, lng: -73.9863, name: "New York, NY" },
  "10003": { lat: 40.7317, lng: -73.9892, name: "New York, NY" },
  "10010": { lat: 40.7390, lng: -73.9826, name: "New York, NY" },
  "10011": { lat: 40.7418, lng: -74.0002, name: "New York, NY" },
  "10012": { lat: 40.7258, lng: -73.9981, name: "New York, NY" },
  "10013": { lat: 40.7198, lng: -74.0047, name: "New York, NY" },
  "10014": { lat: 40.7340, lng: -74.0054, name: "New York, NY" },
  "10016": { lat: 40.7459, lng: -73.9778, name: "New York, NY" },
  "10017": { lat: 40.7527, lng: -73.9735, name: "New York, NY" },
  "10018": { lat: 40.7549, lng: -73.9930, name: "New York, NY" },
  "10019": { lat: 40.7654, lng: -73.9857, name: "New York, NY" },
  "10020": { lat: 40.7587, lng: -73.9787, name: "New York, NY" },
  "10021": { lat: 40.7693, lng: -73.9588, name: "New York, NY" },
  "10022": { lat: 40.7585, lng: -73.9673, name: "New York, NY" },
  "10023": { lat: 40.7764, lng: -73.9826, name: "New York, NY" },
  "10024": { lat: 40.7870, lng: -73.9754, name: "New York, NY" },
  "10025": { lat: 40.7987, lng: -73.9662, name: "New York, NY" },
  "10026": { lat: 40.8022, lng: -73.9524, name: "New York, NY" },
  "10027": { lat: 40.8117, lng: -73.9534, name: "New York, NY" },
  "10028": { lat: 40.7767, lng: -73.9536, name: "New York, NY" },
  "10029": { lat: 40.7919, lng: -73.9438, name: "New York, NY" },
  "10030": { lat: 40.8185, lng: -73.9427, name: "New York, NY" },
  "10031": { lat: 40.8252, lng: -73.9497, name: "New York, NY" },
  "10032": { lat: 40.8382, lng: -73.9421, name: "New York, NY" },
  "11201": { lat: 40.6935, lng: -73.9897, name: "Brooklyn, NY" },
  "11211": { lat: 40.7128, lng: -73.9566, name: "Brooklyn, NY" },
  "11215": { lat: 40.6654, lng: -73.9867, name: "Brooklyn, NY" },
  "11217": { lat: 40.6820, lng: -73.9787, name: "Brooklyn, NY" },
  "11222": { lat: 40.7274, lng: -73.9479, name: "Brooklyn, NY" },
  "11231": { lat: 40.6795, lng: -74.0012, name: "Brooklyn, NY" },
  "11238": { lat: 40.6796, lng: -73.9660, name: "Brooklyn, NY" },
  "11249": { lat: 40.7002, lng: -73.9605, name: "Brooklyn, NY" },
  "00000": { lat: 0, lng: 0, name: "Nowhere" },
};

export const getCoordinatesFromZip = (zipCode: string): { lat: number; lng: number } | null => {
  const coords = ZIP_CODE_COORDINATES[zipCode];
  if (coords) return { lat: coords.lat, lng: coords.lng };

  const firstDigit = parseInt(zipCode[0]);
  if (zipCode.length === 5 && !isNaN(firstDigit)) {
    const baseLat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const baseLng = -74.0060 + (Math.random() - 0.5) * 0.1;
    return { lat: baseLat, lng: baseLng };
  }

  return null;
};

export const getLocationNameFromZip = (zipCode: string): string | null => {
  const entry = ZIP_CODE_COORDINATES[zipCode];
  return entry?.name ?? null;
};

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      zipCode: null,
      lat: null,
      lng: null,
      locationName: null,
      geoStatus: "idle" as const,

      setLocation: (zipCode: string, lat: number, lng: number, name?: string) => {
        const locationName = name || getLocationNameFromZip(zipCode) || zipCode;
        set({ zipCode, lat, lng, locationName });
      },

      setLocationFromCoords: (lat: number, lng: number, name: string) => {
        set({ lat, lng, locationName: name, zipCode: name });
      },

      setGeoStatus: (status: "idle" | "requesting" | "granted" | "denied") => {
        set({ geoStatus: status });
      },

      clearLocation: () => {
        set({ zipCode: null, lat: null, lng: null, locationName: null, geoStatus: "idle" });
      },
    }),
    {
      name: "kokkur-location",
      version: 1,
      migrate: (persisted: any) => {
        const looksLikeCoords = (v: unknown) =>
          typeof v === "string" && v.includes(",") && /\d+\.\d+/.test(v);
        if (looksLikeCoords(persisted?.locationName)) persisted.locationName = null;
        if (looksLikeCoords(persisted?.zipCode)) {
          persisted.zipCode = null;
          persisted.lat = null;
          persisted.lng = null;
        }
        return persisted;
      },
      partialize: (state) => ({
        zipCode: state.zipCode,
        lat: state.lat,
        lng: state.lng,
        locationName: state.locationName,
      }),
    }
  )
);
