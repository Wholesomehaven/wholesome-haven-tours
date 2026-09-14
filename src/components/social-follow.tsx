import { SITE } from "@/lib/site";
import { FacebookIcon, InstagramIcon } from "./social-icons";

export function SocialFollow({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <img
        src="/images/social-follow.png"
        alt="Life at Wholesome Haven Senior Living"
        className="w-full object-contain"
      />
      <div className="p-4 sm:p-5">
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Follow along</p>
        <p className="font-display mt-1 text-xl">See daily life at the house</p>
        <p className="mt-1 text-sm text-muted">
          Photos, meals, and moments from {SITE.shortName} on Facebook and Instagram.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a
            href={SITE.facebookUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-20 flex-1 items-center justify-center gap-3 rounded-md bg-[#1877F2] px-5 text-lg font-medium text-white hover:opacity-90"
          >
            <FacebookIcon className="size-7" />
            Facebook
          </a>
          <a
            href={SITE.instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-20 flex-1 items-center justify-center gap-3 rounded-md bg-[#E4405F] px-5 text-lg font-medium text-white hover:opacity-90"
          >
            <InstagramIcon className="size-7" />
            Instagram
          </a>
        </div>
      </div>
    </div>
  );
}
