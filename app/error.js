"use client";
import { Button } from "@/components/ui";

export default function Error({ error, reset }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center" role="alert">
      <div><h1 className="text-3xl font-semibold">Something went wrong</h1><p className="mt-2 text-navy-500">{error?.message || "An unexpected error occurred."}</p><Button className="mt-6" onClick={reset}>Try again</Button></div>
    </div>
  );
}
