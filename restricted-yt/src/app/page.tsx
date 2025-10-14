import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Page() {
  const uid = (await cookies()).get("uid")?.value;
  if (uid) redirect("/home");

  return (
    <main className="mx-auto max-w-md">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Locked YouTube Browser</h1>
        <p className="text-sm text-neutral-600">
          Enter your numeric User ID to continue.
        </p>
      </header>
      <SignInForm />
      <p className="mt-6 text-xs text-neutral-500">
        After signing in, you’ll be redirected to{" "}
        <Link href="/home" className="underline">
          the home page
        </Link>
        .
      </p>
    </main>
  );
}

function validateId(raw: string) {
  return /^\d{1,12}$/.test(raw.trim());
}

async function setUid(formData: FormData) {
  "use server";
  const id = String(formData.get("uid") ?? "").trim();
  if (!validateId(id)) return;
  (await cookies()).set({
    name: "uid",
    value: id,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/home");
}

function SignInForm() {
  return (
    <form action={setUid} className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm">
      <label htmlFor="uid" className="text-sm font-medium">
        User ID
      </label>
      <input
        id="uid"
        name="uid"
        inputMode="numeric"
        pattern="\d*"
        placeholder="e.g. 123456"
        className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-neutral-900/10"
        required
      />
      <button
        type="submit"
        className="h-10 rounded-md bg-neutral-900 px-4 text-white hover:bg-neutral-800"
      >
        Sign in
      </button>
      <p className="text-xs text-neutral-500">
        Only numeric IDs are accepted.
      </p>
    </form>
  );
}
