interface KokkurIconProps {
  size?: number;
  className?: string;
}

export function KokkurIcon({ size = 36, className = "" }: KokkurIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Map pin / teardrop shape */}
      <path
        d="M32 78C32 78 60 44 60 28C60 12.536 47.464 0 32 0C16.536 0 4 12.536 4 28C4 44 32 78 32 78Z"
        fill="#2E7D32"
      />
      {/* Subtle inner glow circle */}
      <circle cx="32" cy="28" r="20" fill="rgba(255,255,255,0.12)" />
      {/* Chef hat - three rounded bumps */}
      <path
        d="M20 32C20 32 20 26 20 24C20 20 22 17 25 16C25 13 27.5 10 32 10C36.5 10 39 13 39 16C42 17 44 20 44 24C44 26 44 32 44 32Z"
        fill="white"
      />
      {/* Chef hat - left bump */}
      <circle cx="23" cy="17" r="5.5" fill="white" />
      {/* Chef hat - center bump (taller) */}
      <circle cx="32" cy="14" r="6.5" fill="white" />
      {/* Chef hat - right bump */}
      <circle cx="41" cy="17" r="5.5" fill="white" />
      {/* Chef hat - rectangular band */}
      <rect x="20" y="31" width="24" height="6" rx="1.5" fill="white" />
    </svg>
  );
}

interface KokkurLogoProps {
  iconSize?: number;
  variant?: "light" | "dark";
  showTagline?: boolean;
  className?: string;
}

export function KokkurLogo({
  iconSize = 36,
  variant = "light",
  showTagline = false,
  className = "",
}: KokkurLogoProps) {
  const textColor = variant === "dark" ? "text-white" : "text-[#1B2E1A]";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <KokkurIcon size={iconSize} />
      <div className="flex flex-col">
        <span
          className={`text-xl font-bold tracking-tight leading-none ${textColor}`}
          style={{ fontFamily: "'Urbanist', sans-serif" }}
        >
          kokkur
        </span>
        {showTagline && (
          <span
            className={`text-[9px] font-semibold tracking-[0.2em] uppercase leading-tight mt-0.5 ${
              variant === "dark" ? "text-white/70" : "text-[#5A6B55]"
            }`}
            style={{ fontFamily: "'Urbanist', sans-serif" }}
          >
            LOCAL CHEFS · REAL FOOD
          </span>
        )}
      </div>
    </div>
  );
}
