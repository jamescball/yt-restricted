import { NextResponse } from "next/server";

function clearUidCookie(res: NextResponse) {
  res.cookies.set({
    name: "uid",
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0), // expire immediately
  });
}

// POST /api/signout
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearUidCookie(res);
  return res;
}

export async function GET() {
  const res = NextResponse.json({ ok: true });
  clearUidCookie(res);
  return res;
}
