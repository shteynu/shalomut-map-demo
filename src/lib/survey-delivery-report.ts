/**
 * Telling the server about a submission it very nearly never received.
 *
 * `sendWithRetry` repairs the lost first submit silently, which is what the
 * respondent needs and what leaves nobody able to say how often it happens. The
 * client is the only process that knows: the request that dies never reaches
 * the function at all. So after the outcome is decided — and only then — it
 * says how many attempts the delivery took.
 *
 * Fired only when the first attempt threw. A submission delivered the ordinary
 * way reports nothing and costs exactly the one request it always cost.
 *
 * Nothing here may ever surface to the respondent. The report is about a
 * failure that has already been survived, and a failure to report it is worth
 * strictly less than the answers it must not disturb — so every error is
 * swallowed, including the one where the report itself is what dies.
 */

export interface SubmissionDeliveryReport {
  shareCode: string;
  /** `recovered`: a later attempt got through. `lost`: none of them did. */
  outcome: 'recovered' | 'lost';
  /** Attempts the delivery took, including the first. Always at least 2. */
  attempts: number;
  /** Seam for tests, so nothing here touches the network. */
  send?: typeof fetch;
}

export async function reportSubmissionDelivery({
  shareCode,
  outcome,
  attempts,
  send = fetch,
}: SubmissionDeliveryReport): Promise<void> {
  if (attempts < 2) return;

  try {
    await send(`/api/survey/${encodeURIComponent(shareCode)}/delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, attempts }),
      // The thank-you screen is one state change away and a respondent closes
      // the tab on it. `keepalive` is the difference between a report that
      // survives that and one that is cancelled on the way out.
      keepalive: true,
    });
  } catch {
    // Deliberately empty. See the note at the top of the file: the one thing
    // this must never do is make a survived failure visible.
  }
}
