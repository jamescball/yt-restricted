// src/app/api/youtube/search/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const YT_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (!q) return NextResponse.json({ items: [] });

    const key = process.env.YT_API_KEY;
    if (!key) {
      console.log("❌ Missing YT_API_KEY in environment variables");
      return NextResponse.json({ error: "Missing YT_API_KEY on server" }, { status: 500 });
    }

    const url = new URL(YT_ENDPOINT);
    url.search = new URLSearchParams({
      key,
      part: "snippet",
      type: "video",
      maxResults: "15",
      q,
      // Only videos that can be embedded outside youtube.com
      videoEmbeddable: "true"
    }).toString();

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.log("YouTube API error:", res.status, text);
      return NextResponse.json({ error: `YouTube API error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const items =
      data.items?.map((it: any) => ({
        id: it.id?.videoId ?? "",
        title: it.snippet?.title ?? "",
        channelTitle: it.snippet?.channelTitle ?? "",
        thumbnail:
          it.snippet?.thumbnails?.medium?.url ??
          it.snippet?.thumbnails?.default?.url ??
          "",
      })) ?? [];

    return NextResponse.json({ items });
  } catch (err: any) {
    console.log("Fetch failed:", err?.message ?? err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
