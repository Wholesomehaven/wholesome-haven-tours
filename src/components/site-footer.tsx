import { Link } from "@tanstack/react-router";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-primary-dark text-primary-fg">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-display text-xl">{SITE.shortName}</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-primary-fg/75">
            Personalized residential care in a warm six-bed home in Spring Valley.
          </p>
        </div>
        <div className="text-sm leading-relaxed">
          <p className="text-xs tracking-[0.16em] text-primary-fg/55 uppercase">Visit</p>
          <p className="mt-2">{SITE.addressLine}</p>
          <p>{SITE.cityLine}</p>
          <a
            href={SITE.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-primary-fg/85 underline-offset-4 hover:underline"
          >
            Get directions
          </a>
        </div>
        <div className="text-sm leading-relaxed">
          <p className="text-xs tracking-[0.16em] text-primary-fg/55 uppercase">Talk with us</p>
          <a href={SITE.phoneHref} className="mt-2 block hover:underline">
            {SITE.phone}
          </a>
          <a href={SITE.emailHref} className="block hover:underline">
            {SITE.email}
          </a>
          <Link
            to="/admin"
            className="mt-6 inline-block text-xs tracking-wide text-primary-fg/45 hover:text-primary-fg"
          >
            Staff login
          </Link>
        </div>
      </div>
      <div className="border-t border-primary-fg/10 px-4 py-4 text-center text-xs text-primary-fg/50">
        © {new Date().getFullYear()} {SITE.name}
      </div>
    </footer>
  );
}
