import assert from "node:assert/strict";
import test from "node:test";
import { planLiveImageDecorations } from "../src/editor/live-preview/images";

test("inactive image lines replace source with the preview", () => {
  assert.deepEqual(planLiveImageDecorations("![alt](assets/a.png)", false), [
    {
      kind: "replace",
      from: 0,
      to: 20,
      alt: "alt",
      source: "assets/a.png",
      sourceFrom: 0,
      sourceTo: 20,
    },
  ]);
});

test("active image lines keep source and add an inline preview at line end", () => {
  assert.deepEqual(planLiveImageDecorations("![alt](assets/a.png)", true), [
    {
      kind: "inline",
      from: 20,
      to: 20,
      alt: "alt",
      source: "assets/a.png",
      sourceFrom: 0,
      sourceTo: 20,
    },
  ]);
});

test("active sized images retain the source occurrence's range separately from their widget position", () => {
  const line = '<img src="assets/a.png" width="240"> ![second](assets/a.png)';
  const plans = planLiveImageDecorations(line, true);
  assert.equal(plans[0].width, 240);
  assert.equal(plans[0].sourceFrom, 0);
  assert.equal(plans[1].sourceFrom, line.indexOf("![second]"));
  assert.ok(plans.every((plan) => plan.from === line.length));
});

test("literal image syntax inside inline code stays editable text", async () => {
  const { cachedLineParse } =
    await import("../src/editor/live-preview/line-cache.ts");
  const parsed = cachedLineParse(
    '`<img src="assets/a.png" width="400">` ![real](assets/b.png)',
    false,
  );
  assert.equal(parsed.images.length, 1);
  assert.equal(parsed.images[0].source, "assets/b.png");
});
