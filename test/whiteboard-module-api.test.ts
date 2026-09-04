import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../packages/whiteboard/node_modules/vite/dist/node/index.js";

test("app and node modules load with label layout helpers owned by the pure document API", async (t) => {
  const server = await createServer({
    root: "packages/whiteboard",
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
  });
  t.after(() => server.close());

  assert.equal(server.config.optimizeDeps.noDiscovery, true);
  assert.deepEqual(server.config.optimizeDeps.include, []);

  const document = await server.ssrLoadModule("/src/whiteboard/document.ts");
  const shapes = await server.ssrLoadModule("/src/nodes/shapes.tsx");
  const app = await server.ssrLoadModule("/src/whiteboard/app.tsx");
  const entrypoint = await server.ssrLoadModule("/src/index.ts");

  assert.equal(typeof document.labelTextStyle, "function");
  assert.equal(typeof document.verticalAlignmentStyle, "function");
  assert.equal(typeof shapes.RectNode, "function");
  assert.equal(typeof app.WhiteboardApp, "function");
  assert.equal(typeof entrypoint.canvasNodeTypes, "object");
  assert.equal(typeof entrypoint.createBasicNode, "function");
  assert.equal(typeof entrypoint.createAcademicNode, "function");
  assert.equal(typeof entrypoint.createAcademicConnection, "function");
});
