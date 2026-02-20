import { db } from "@/db";
import { menus, chefProfiles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "CHEF") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chefProfileId, title, orderCutoffDate, fulfillmentDate, status } = await req.json();

  // Verify this chef profile belongs to the user
  const profile = await db
    .select()
    .from(chefProfiles)
    .where(eq(chefProfiles.id, chefProfileId))
    .get();

  if (!profile || profile.userId !== session.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!title || !orderCutoffDate || !fulfillmentDate) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const menuRows = await db
    .insert(menus)
    .values({
      chefProfileId,
      title,
      orderCutoffDate,
      fulfillmentDate,
      status: status || "DRAFT",
    })
    .returning();

  return NextResponse.json({ menu: menuRows[0] });
}
