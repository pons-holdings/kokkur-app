import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compareSync } from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kokkur-dev-secret-change-in-production"
);

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "CHEF" | "BUYER";
};

export async function signIn(email: string, password: string): Promise<SessionUser | null> {
  const user = db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user) return null;
  if (!compareSync(password, user.passwordHash)) return null;

  const session: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "CHEF" | "BUYER",
  };

  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return session;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
