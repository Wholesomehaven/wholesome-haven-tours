import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/admin-dashboard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
  errorComponent: AdminError,
  head: () => ({
    meta: [{ title: "Tour desk | Wholesome Haven" }],
  }),
});

function AdminError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Please refresh and try again.";
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 text-center text-fg">
      <div className="max-w-md">
        <h1 className="font-display text-3xl">Tour desk hit a snag</h1>
        <p className="mt-3 text-sm text-muted">{message}</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Reload desk
        </Button>
      </div>
    </main>
  );
}
