import { Link } from "react-router";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Compass className="h-12 w-12 text-primary" />
      <h1 className="mt-4 text-3xl font-bold">Lost the beat?</h1>
      <p className="mt-2 text-muted-foreground">This page doesn't exist in your library.</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Back to Home
      </Link>
    </div>
  );
}
