"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { routes, shouldRenewSession } from "@/lib/navigation";

/**
 * How long after the last renewal another one is worth making.
 *
 * Mirrors `SESSION_RENEWAL_INTERVAL_SECONDS`, restated in milliseconds rather
 * than imported: this module is shipped to the browser and the lifetime module
 * is server configuration. The server also answers with `renewAfterSeconds`,
 * which is what actually paces the loop after the first renewal — this is only
 * the value used before the first answer arrives.
 */
const DEFAULT_RENEWAL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * The events that count as the manager still being here.
 *
 * Deliberately coarse — a scroll or a keystroke, not a mouse move. Reading the
 * map is the case this has to cover, and reading it involves scrolling and
 * clicking stones; a mouse crossing the window on the way to another
 * application is not somebody working.
 */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "focus",
] as const;

/**
 * Keeps a working manager signed in, and lets an idle one be signed out.
 *
 * The session is fifteen minutes long and this is what extends it: the
 * manager's own activity, throttled so that a busy screen costs one database
 * read every five minutes rather than one per click. Nothing here is a timer —
 * a component that renewed on a schedule would keep a forgotten tab signed in
 * for as long as the browser was open, which is exactly the variant the owner
 * turned down on 2026-08-21. No activity, no renewal, and the token expires on
 * its own.
 *
 * The other half is what a refusal means. Renewal re-reads memberships from the
 * database, so a `401` is not a network hiccup — it is this person's access
 * having been taken away, or their twelve hours being up. The answer is a
 * document load to `/login`, the same one signing out uses and for the same
 * reason: the client router is holding every manager screen this session
 * rendered, and only a real navigation discards it.
 */
export function SessionRenewal() {
  const pathname = usePathname();
  const active = shouldRenewSession(pathname);

  // Refs rather than state throughout: nothing here renders, and re-rendering
  // the tree on every scroll event is the one thing this component must not do.
  const lastRenewalRef = useRef(0);
  const intervalMsRef = useRef(DEFAULT_RENEWAL_INTERVAL_MS);
  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function renew() {
      if (stoppedRef.current || inFlightRef.current) return;

      const now = Date.now();
      if (now - lastRenewalRef.current < intervalMsRef.current) return;

      inFlightRef.current = true;
      lastRenewalRef.current = now;

      try {
        const response = await fetch("/api/auth/session/renew", {
          method: "POST",
        });

        if (response.status === 401) {
          // The server has already cleared the cookie. Stop asking, and take
          // the manager to the screen that can explain itself.
          stoppedRef.current = true;
          if (!cancelled) window.location.assign(routes.login);
          return;
        }

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (typeof data?.renewAfterSeconds === "number") {
            intervalMsRef.current = data.renewAfterSeconds * 1000;
          }
          return;
        }

        // Any other answer — a 503 from a runtime that cannot mint, a proxy
        // error — is about the server, not about this session. Back off one
        // interval and let the next activity try again; the token is still
        // valid until it is not.
      } catch {
        // Offline, or the request was cut short by a navigation. Same reading:
        // it says nothing about whether this person may still be here.
      } finally {
        inFlightRef.current = false;
      }
    }

    // Once on arrival, so a manager who navigates after a long read is renewed
    // by the navigation itself rather than by whatever they touch next. The
    // throttle keeps this from firing on every route change.
    void renew();

    const onActivity = () => void renew();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void renew();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, pathname]);

  return null;
}
