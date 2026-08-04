import assert from "node:assert";
import { test } from "node:test";
import { writeToClipboard } from "@/lib/utils/clipboard";

test("a clipboard that accepts the text reports success", async () => {
  const written: string[] = [];

  const result = await writeToClipboard("https://example.test/s/ABC", {
    writeText: async (text: string) => {
      written.push(text);
    },
  });

  assert.strictEqual(result, true);
  assert.deepStrictEqual(written, ["https://example.test/s/ABC"]);
});

test("a refused permission is a failure, not a silent success", async () => {
  const result = await writeToClipboard("link", {
    writeText: async () => {
      throw new Error("NotAllowedError");
    },
  });

  assert.strictEqual(result, false);
});

test("a browser without a clipboard API is a failure too", async () => {
  assert.strictEqual(await writeToClipboard("link", undefined), false);
  assert.strictEqual(
    await writeToClipboard("link", {} as unknown as Clipboard),
    false,
  );
});
