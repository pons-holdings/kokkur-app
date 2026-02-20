"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { ShoppingCart, ChefHat, Heart, LogOut, User } from "lucide-react";
import { Button } from "./ui/button";
import type { SessionUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NavbarClient({ session }: { session: SessionUser | null }) {
  const { totalItems } = useCart();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      {session ? (
        <>
          {session.role === "CHEF" && (
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ChefHat className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          )}
          {session.role === "BUYER" && (
            <Link href="/favorites">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Heart className="h-4 w-4" />
                Favorites
              </Button>
            </Link>
          )}
          <Link href="/cart">
            <Button variant="ghost" size="sm" className="gap-1.5 relative">
              <ShoppingCart className="h-4 w-4" />
              Cart
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                  {totalItems}
                </span>
              )}
            </Button>
          </Link>
          <div className="flex items-center gap-2 pl-2 border-l">
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <User className="h-4 w-4" />
              {session.name}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <Link href="/cart">
            <Button variant="ghost" size="sm" className="gap-1.5 relative">
              <ShoppingCart className="h-4 w-4" />
              Cart
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                  {totalItems}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Log In
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Sign Up</Button>
          </Link>
        </>
      )}
    </div>
  );
}
