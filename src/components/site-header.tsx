import { Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader({
  variant = "public",
  trailing,
}: {
  variant?: "public" | "admin";
  trailing?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img
            src="/images/logo.png"
            alt=""
            className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12"
          />
          <span className="min-w-0">
            <span className="font-display block truncate text-[1.05rem] leading-tight text-fg sm:text-lg">
              {SITE.shortName}
            </span>
            <span className="block truncate text-[0.7rem] tracking-[0.14em] text-muted uppercase">
              {variant === "admin" ? "Tour desk" : "Senior Living"}
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {trailing}
          {variant === "public" ? (
            <a
              href={SITE.phoneHref}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-fg",
                "transition-colors duration-150 hover:bg-primary-dark sm:px-4",
              )}
            >
              <Phone className="size-4" />
              <span className="hidden sm:inline">{SITE.phone}</span>
              <span className="sm:hidden">Call</span>
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
