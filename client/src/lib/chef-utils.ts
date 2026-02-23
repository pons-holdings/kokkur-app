/**
 * Display name for cards, cart, checkout: "Chef Maria R."
 */
export function getChefDisplayName(chef: { firstName: string; lastName: string } | null | undefined): string {
  if (!chef?.firstName) return "Chef";
  const lastInitial = chef.lastName ? ` ${chef.lastName[0]}.` : "";
  return `Chef ${chef.firstName}${lastInitial}`;
}

/**
 * Full name for profile page: "Chef Maria Rodriguez"
 */
export function getChefFullName(chef: { firstName: string; lastName: string } | null | undefined): string {
  if (!chef?.firstName) return "Chef";
  return `Chef ${chef.firstName}${chef.lastName ? ` ${chef.lastName}` : ""}`;
}

/**
 * Initials for avatar fallback: "MR"
 */
export function getChefInitials(chef: { firstName: string; lastName: string } | null | undefined): string {
  if (!chef?.firstName) return "?";
  const first = chef.firstName[0] || "";
  const last = chef.lastName?.[0] || "";
  return (first + last).toUpperCase();
}
