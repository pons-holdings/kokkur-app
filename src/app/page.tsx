import { HomeSearch } from "@/components/home-search";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Fresh, local food from
          <span className="text-emerald-600"> your neighborhood chefs</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Full transparency on every ingredient. Discover amazing homemade food from independent chefs near you.
        </p>
      </div>

      <HomeSearch userId={session?.id ?? null} />
    </div>
  );
}
