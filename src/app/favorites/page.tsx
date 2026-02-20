import { db } from "@/db";
import { userFavorites, chefProfiles, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, ChefHat, MapPin, Truck } from "lucide-react";
import Link from "next/link";

export default async function FavoritesPage() {
  const session = await getSession();
  if (!session || session.role !== "BUYER") redirect("/login");

  const favorites = db
    .select({
      chef: chefProfiles,
      chefName: users.name,
    })
    .from(userFavorites)
    .innerJoin(chefProfiles, eq(chefProfiles.id, userFavorites.chefId))
    .innerJoin(users, eq(users.id, chefProfiles.userId))
    .where(eq(userFavorites.buyerId, session.id))
    .all();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="h-6 w-6 text-emerald-600 fill-emerald-600" />
        <h1 className="text-2xl font-bold text-slate-900">My Favorite Chefs</h1>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Heart className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No favorites yet</h3>
            <p className="text-muted-foreground mt-1">
              Browse chefs and click the heart icon to save your favorites.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-emerald-600 hover:underline font-medium"
            >
              Discover chefs
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {favorites.map((fav) => {
            const cuisineTags = JSON.parse(fav.chef.cuisineTags || "[]");
            return (
              <Link key={fav.chef.id} href={`/chef/${fav.chef.slug}`}>
                <Card className="hover:border-emerald-200 transition-colors h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <ChefHat className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{fav.chefName}</CardTitle>
                        <div className="flex gap-1 mt-0.5">
                          {cuisineTags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{fav.chef.bio}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {fav.chef.serviceRadius} mi
                      </span>
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {fav.chef.fulfillmentMethods === "BOTH"
                          ? "Pickup & Delivery"
                          : fav.chef.fulfillmentMethods === "PICKUP"
                          ? "Pickup"
                          : "Delivery"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
