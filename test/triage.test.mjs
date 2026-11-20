import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleTriage } from "../server.mjs";

async function post(body) {
  const request = Readable.from([Buffer.from(body)]);
  let status;
  let output;
  const response = {
    writeHead(code) { status = code; },
    end(body) { output = JSON.parse(body); },
  };
  await handleTriage(request, response);
  return { status, body: output };
}

test("rejects invalid input", async () => {
  for (const body of ['{', 'null', '{}', '{"text":1}', '{"text":"  "}']) {
    assert.deepEqual(await post(body), { status: 400, body: { status: "invalid_input" } });
  }
});

test("returns a validated result", async () => {
  assert.deepEqual(await post(JSON.stringify({ text: "Сколько стоит доставка?" })), {
    status: 200,
    body: { status: "ready", topic: "delivery", draft: "Спасибо за обращение. Уточним детали заявки." },
  });
});

test("sends model failures to manual review", async () => {
  for (const marker of ["[error]", "[bad-json]", "[bad-topic]", "[empty-draft]", "[timeout]"]) {
    const start = performance.now();
    assert.deepEqual(await post(JSON.stringify({ text: marker })), {
      status: 200, body: { status: "manual_review", topic: null, draft: null },
    });
    if (marker === "[timeout]") assert.ok(performance.now() - start < 1000);
  }
});
