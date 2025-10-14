import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Restricted YouTube Browser",
  description: "Sign in with an ID and watch YouTube videos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <div className="mx-auto max-w-6xl p-4 md:p-6">{children}</div>
      </body>
    </html>
  );
}
