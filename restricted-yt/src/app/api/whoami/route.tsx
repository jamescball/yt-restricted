// src/app/api/whoami/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const store = await cookies();
  const uid = store.get("uid")?.value ?? null;
  return NextResponse.json({ uid });
}
