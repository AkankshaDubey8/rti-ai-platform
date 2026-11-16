import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div><h1 className="text-4xl font-semibold">Page not found</h1><p className="mt-2 text-navy-500">The page you are looking for does not exist or has moved.</p><ButtonLink href="/" className="mt-6">Go to the home page</ButtonLink></div>
    </div>
  );
}
