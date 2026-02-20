import { db } from "@/db";
import { userFavorites } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "BUYER") {
    return NextResponse.json({ isFavorite: false });
  }

  const chefId = req.nextUrl.searchParams.get("chefId");
  if (!chefId) {
    return NextResponse.json({ error: "chefId required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(userFavorites)
    .where(and(eq(userFavorites.buyerId, session.id), eq(userFavorites.chefId, parseInt(chefId))))
    .get();

  return NextResponse.json({ isFavorite: !!existing });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "BUYER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chefId } = await req.json();
  if (!chefId) {
    return NextResponse.json({ error: "chefId required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(userFavorites)
    .where(and(eq(userFavorites.buyerId, session.id), eq(userFavorites.chefId, chefId)))
    .get();

  if (existing) {
    await db.delete(userFavorites)
      .where(and(eq(userFavorites.buyerId, session.id), eq(userFavorites.chefId, chefId)))
      .run();
    return NextResponse.json({ isFavorite: false });
  } else {
    await db.insert(userFavorites).values({ buyerId: session.id, chefId }).run();
    return NextResponse.json({ isFavorite: true });
  }
}
