import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const tones: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  confirmed: "bg-primary/15 text-primary-dark",
  completed: "bg-success/15 text-success",
  cancelled: "bg-fg/10 text-muted",
  no_show: "bg-danger/12 text-danger",
  default: "bg-bg-warm text-fg",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        tones[tone] ?? tones.default,
        className,
      )}
      {...props}
    />
  );
}
