import { LoaderCircle } from "lucide-react";

/**
 * Segment-level loading UI.
 *
 * Every manager screen renders on the server and reads persistence before it can
 * answer, so a navigation used to leave the previous page frozen with no signal
 * that anything was happening. Rendering this from a `loading.tsx` lets the App
 * Router paint feedback immediately while the segment streams in.
 */
export function RouteLoading({
  title = "טוענים את המסך",
  description = "רק רגע, אנחנו מביאים את הנתונים העדכניים.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="route-loading" role="status" aria-live="polite">
      <LoaderCircle
        className="route-loading-spinner"
        size={30}
        aria-hidden="true"
      />
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
