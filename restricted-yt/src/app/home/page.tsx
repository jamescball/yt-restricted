"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Video = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
};

// Force dynamic rendering to avoid prerender errors with searchParams
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uid, setUid] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Video[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check authentication
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/whoami", { cache: "no-store" });
        if (!alive) return;
        if (!r.ok) return router.push("/");
        const data = (await r.json()) as { uid?: string | null };
        if (!data.uid) return router.push("/");
        setUid(data.uid ?? null);
      } catch {
        router.push("/");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // Load initial search from URL (?search=)
  useEffect(() => {
    const searchQuery = searchParams.get("search");
    if (searchQuery && !results.length) {
      setQ(searchQuery);
      runSearch(searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(term: string) {
    const clean = term.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/youtube/search?q=${encodeURIComponent(clean)}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`Search failed (${r.status})`);
      const data = (await r.json()) as { items: Video[]; error?: string };
      if ((data as any).error) throw new Error((data as any).error);
      setResults(data.items ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    router.replace(`/home?search=${encodeURIComponent(q.trim())}`);
    runSearch(q.trim());
  }

  async function signOut() {
    try {
      setSigningOut(true);
      await fetch("/api/signout", { method: "POST", cache: "no-store" });
    } catch {
      // ignore
    } finally {
      router.replace("/");
      router.refresh();
      setSigningOut(false);
    }
  }

  // Keyboard: '/' focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!uid) {
    return (
      <main className="grid gap-4 p-4 md:p-6">
        <div className="h-10 w-64 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-10 w-full animate-pulse rounded-md bg-neutral-200" />
        <div className="h-[60vh] w-full animate-pulse rounded-xl bg-neutral-200" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-white p-2 md:block">
        <div className="mt-2 grid gap-1">
          <SideItem label="Home" active onClick={() => router.push("/home")} />
          <SideItem label="My Playlists" onClick={() => router.push("/playlists")} />
          <SideItem label="History" onClick={() => router.push("/history")} />
        </div>

        <div className="mt-6 border-t pt-3 text-xs text-neutral-500">
          Signed in as <span className="font-medium text-neutral-700">{uid}</span>
        </div>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="mt-2 h-8 w-full rounded-md border text-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1">
        <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto flex max-w-6xl items-center gap-3 p-3 md:p-4">
            <div className="hidden text-base font-semibold md:block">Locked YouTube</div>
            <form onSubmit={onSearch} className="flex w-full items-center gap-2">
              <div className="flex w-full items-center rounded-full border bg-white pl-4">
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  aria-label="Search"
                  className="h-10 w-full bg-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 shrink-0 rounded-full bg-neutral-900 px-5 text-sm text-white hover:bg-neutral-800 disabled:opacity-70"
                >
                  {loading ? "Searching…" : "Search"}
                </button>
              </div>
            </form>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-3 md:p-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            {loading && !results.length
              ? Array.from({ length: 8 }).map((_, i) => <ResultSkeleton key={i} />)
              : results.length
              ? results.map((v) => (
                  <button
                    key={v.id}
                    onClick={() =>
                      router.push(`/player/${v.id}?search=${encodeURIComponent(q)}`)
                    }
                    className="group flex w-full gap-4 rounded-xl p-2 text-left hover:bg-neutral-50"
                    aria-label={`Open ${v.title}`}
                  >
                    <div className="relative aspect-[16/9] w-56 overflow-hidden rounded-lg border bg-black md:w-64">
                      <img
                        src={v.thumbnail}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-base font-medium group-hover:underline">
                        {v.title}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-600">{v.channelTitle}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-500">
                        Video description preview goes here.
                      </p>
                    </div>
                  </button>
                ))
              : (
                <div className="rounded-xl border bg-white p-6 text-center text-sm text-neutral-500">
                  Try a search to see results.
                </div>
              )}
          </div>
        </main>
      </div>
    </div>
  );
}

function HomeFallback() {
  return (
    <main className="grid gap-4 p-4 md:p-6">
      <div className="h-10 w-64 animate-pulse rounded-md bg-neutral-200" />
      <div className="h-10 w-full animate-pulse rounded-md bg-neutral-200" />
      <div className="h-[60vh] w-full animate-pulse rounded-xl bg-neutral-200" />
    </main>
  );
}

function SideItem({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${
        active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
      }`}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function ResultSkeleton() {
  return (
    <div className="flex gap-4">
      <div className="aspect-[16/9] w-56 animate-pulse rounded-lg bg-neutral-200 md:w-64" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200" />
      </div>
    </div>
  );
}
