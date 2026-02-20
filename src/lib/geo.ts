import { getDistance } from "geolib";

export type LatLong = {
  latitude: number;
  longitude: number;
};

// Mock zip code to lat/long mapping (Austin, TX area)
const ZIP_CODE_MAP: Record<string, LatLong> = {
  "78701": { latitude: 30.2672, longitude: -97.7431 }, // Downtown Austin
  "78702": { latitude: 30.2630, longitude: -97.7192 }, // East Austin
  "78703": { latitude: 30.2900, longitude: -97.7650 }, // Tarrytown
  "78704": { latitude: 30.2400, longitude: -97.7640 }, // South Austin
  "78705": { latitude: 30.2950, longitude: -97.7420 }, // UT Area
  "78751": { latitude: 30.3150, longitude: -97.7240 }, // Hyde Park
  "78752": { latitude: 30.3300, longitude: -97.7080 }, // Windsor Park
  "78756": { latitude: 30.3230, longitude: -97.7420 }, // Brentwood
  "78757": { latitude: 30.3510, longitude: -97.7350 }, // Crestview
  "78758": { latitude: 30.3850, longitude: -97.7040 }, // North Austin
  "78759": { latitude: 30.3990, longitude: -97.7540 }, // Great Hills
  "78745": { latitude: 30.2050, longitude: -97.7850 }, // South Austin (far)
  "78746": { latitude: 30.2800, longitude: -97.8100 }, // Westlake
  "78748": { latitude: 30.1700, longitude: -97.8000 }, // South Manchaca
  "78660": { latitude: 30.4400, longitude: -97.6000 }, // Pflugerville
};

export function zipToLatLong(zip: string): LatLong | null {
  return ZIP_CODE_MAP[zip] || null;
}

/**
 * Calculate distance between two points in miles
 */
export function getDistanceMiles(from: LatLong, to: LatLong): number {
  const meters = getDistance(
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude }
  );
  return meters / 1609.344; // Convert meters to miles
}

/**
 * Check if a user location is within a chef's service radius
 */
export function isWithinServiceRadius(
  userLocation: LatLong,
  chefLocation: LatLong,
  serviceRadius: number
): boolean {
  const distance = getDistanceMiles(userLocation, chefLocation);
  return distance <= serviceRadius;
}

export function getKnownZipCodes(): string[] {
  return Object.keys(ZIP_CODE_MAP);
}
