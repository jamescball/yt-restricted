import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import PlayerClient from "./player-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VideoMeta = {
  title: string;
  channelTitle: string;
  viewCount: string | null;
  publishedAt: string | null;
};

async function fetchVideoMeta(id: string): Promise<VideoMeta | null> {
  const key = process.env.YT_API_KEY;
  if (!key) return null;

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({
    part: "snippet,statistics",
    id,
    key,
  }).toString();

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;

  const data = (await res.json()) as any;
  const item = data?.items?.[0];
  if (!item) return null;

  return {
    title: item?.snippet?.title ?? "",
    channelTitle: item?.snippet?.channelTitle ?? "",
    viewCount: item?.statistics?.viewCount ?? null,
    publishedAt: item?.snippet?.publishedAt ?? null,
  };
}

function formatViews(n: string | null) {
  if (!n) return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return `${x.toLocaleString()} views`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Promise<{ search?: string }>;
}) {
  const store = await cookies();
  const uid = store.get("uid")?.value;
  if (!uid) redirect("/");

  const id = await params.id;
  const qp = await searchParams;
  const search = qp?.search ?? "";
  const backLink = search ? `/home?search=${encodeURIComponent(search)}` : "/home";

  const meta = await fetchVideoMeta(id);
  const title = meta?.title ?? `Video ${id}`;
  const channelTitle = meta?.channelTitle ?? "Unknown channel";
  const views = formatViews(meta?.viewCount ?? null);
  const dateStr = formatDate(meta?.publishedAt ?? null);

  return (
    <main className="mx-auto max-w-[90rem] px-3 py-4 md:px-8 md:py-6">
      <header className="sticky top-0 z-10 mb-4 border-b bg-white/80 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex items-center justify-between">
          <Link
            href={backLink}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            ← Back to search
          </Link>
          <div className="text-xs text-neutral-500">Signed in as {uid}</div>
        </div>
      </header>

      <section className="flex flex-col items-center">
        <div
          className="
            relative w-full max-w-[1600px] aspect-video
            overflow-hidden rounded-xl border bg-black
          "
          id="player-container"
        >
          <PlayerClient videoId={id} />
        </div>

        <div className="mt-5 w-full max-w-[1600px] px-2 md:px-0">
          <h1 className="text-xl font-semibold leading-snug md:text-2xl">{title}</h1>
          <div className="mt-2 text-sm text-neutral-600">
            {[views, dateStr].filter(Boolean).join(" • ")}
          </div>
          <div className="mt-3 text-sm font-medium text-neutral-800">{channelTitle}</div>
        </div>
      </section>
    </main>
  );
}
