import Link from "next/link";
import { getSession } from "@/lib/auth";
import { NavbarClient } from "./navbar-client";

export async function Navbar() {
  const session = await getSession();

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-lg">
            K
          </div>
          <span className="text-xl font-bold text-slate-900">Kokkur</span>
        </Link>

        <NavbarClient session={session} />
      </div>
    </nav>
  );
}
