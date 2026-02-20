import { db } from "@/db";
import { users } from "@/db/schema";
import { signIn } from "@/lib/auth";
import { hashSync } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, password, name, role } = await req.json();

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (!["CHEF", "BUYER"].includes(role)) {
    return NextResponse.json({ error: "Role must be CHEF or BUYER" }, { status: 400 });
  }

  try {
    const passwordHash = hashSync(password, 10);
    db.insert(users)
      .values({ email, passwordHash, name, role })
      .run();

    const user = await signIn(email, password);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }
}
