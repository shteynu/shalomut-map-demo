/**
 * Put text on the clipboard and say whether it actually got there.
 *
 * Every failure is the same failure from the manager's point of view — no
 * clipboard API, a permission the browser refused, an embedded webview that
 * blocks it — so this reports a boolean rather than an error to classify. What
 * the screen does about it is the caller's business.
 */
export async function writeToClipboard(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator
    ?.clipboard,
): Promise<boolean> {
  if (!clipboard?.writeText) return false;

  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
