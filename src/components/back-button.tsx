"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";

// The trail of in-site pages in this tab (client-side navigations), so "back"
// only goes back while the previous page is ours. Module state: it survives
// page changes but not a full reload, which is exactly when there's no in-site
// page to go back to. Returning to the previous entry is treated as a step back.
const trail: string[] = [];

// Round "back" button, the companion of BackToTop: same size and colours, with
// a "return" arrow, at the opposite bottom corner (right in RTL, the "back"
// direction). Hidden on `homeHref` (nothing to go back to). Goes to the
// previous page when the visitor came from inside the site, otherwise to
// `homeHref` (e.g. a product link opened straight from WhatsApp).
export function BackButton({ homeHref, bottomClass = "bottom-5" }: { homeHref: string; bottomClass?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (trail[trail.length - 1] === pathname) return;
    if (trail[trail.length - 2] === pathname) trail.pop();
    else trail.push(pathname);
  }, [pathname]);

  if (pathname === homeHref) return null;

  function goBack() {
    if (trail.length > 1) router.back();
    else router.push(homeHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={t("nav.back")}
      className={`fixed start-4 ${bottomClass} z-20 w-10 h-10 rounded-full bg-[var(--accent)] text-white ring-2 ring-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center`}
    >
      {/* A "return" arrow pointing toward the RTL "back" direction (the app
          has no LTR locale yet). */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 14l5-5-5-5" />
        <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
      </svg>
    </button>
  );
}
