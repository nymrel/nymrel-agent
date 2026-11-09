import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

type Listener = (event: { preventDefault(): void }) => Promise<void>;
class Element {
  public dataset: Record<string, string> = {};
  public textContent = "";
  public hidden = false;
  public attributes: Record<string, string> = {};
  public listeners = new Map<string, Listener>();
  public children = new Map<string, Element>();
  public setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  public querySelector(selector: string): Element | undefined { return this.children.get(selector); }
  public scrollIntoView(): void {}
  public addEventListener(name: string, listener: Listener): void { this.listeners.set(name, listener); }
}
class Button extends Element { public disabled = false; }
class Anchor extends Element {}
class Select extends Element { public disabled = false; public value = "balanced"; }

function harness(fetcher: typeof fetch) {
  const demo = new Element();
  const run = new Button();
  const copy = new Button();
  const feedback = new Anchor();
  const status = new Element();
  const output = new Element();
  const objective = new Select();
  const summary = new Element();
  for (const [selector, element] of [
    ["[data-copy-demo]", copy], ["[data-demo-feedback]", feedback],
    ["[data-demo-status]", status], ["[data-demo-output]", output],
    ["[data-demo-objective]", objective], ["[data-demo-summary]", summary],
  ] as const) demo.children.set(selector, element);
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  runInNewContext(readFileSync("public/demo.js", "utf8"), {
    HTMLElement: Element, HTMLButtonElement: Button, HTMLAnchorElement: Anchor,
    HTMLSelectElement: Select,
    AbortController, fetch: fetcher,
    document: { querySelector: () => demo, querySelectorAll: () => [run] },
    window: { matchMedia: () => ({ matches: true }) },
    setTimeout: (callback: () => void, milliseconds: number) => {
      assert.equal(milliseconds, 15_000);
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout: (id: number) => timers.delete(id),
  });
  return {
    demo, run, copy, feedback, status, output, objective, summary, timers,
    click: () => run.listeners.get("click")!({ preventDefault() {} }),
    expire: () => { for (const callback of timers.values()) callback(); },
  };
}

const payload = {
  request: { risk: "read", objective: "cost", requirements: {}, constraints: {} },
  models: [{ modelId: "example", providerId: "test", qualityScore: 80 }],
};
const plan = {
  selectedModelId: "example", eligible: [{ modelId: "example", providerId: "test", score: 50 }],
  rejected: [], decisionCodes: [],
};
const example = () => new Response(JSON.stringify(payload));
const result = () => new Response(JSON.stringify({ ok: true, requestId: "test", plan }));
const stalled = (signal: AbortSignal) => new Promise<Response>((_resolve, reject) => {
  signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
});

test("the demo times out a stalled example, resets controls and supports an explicit retry", async () => {
  let calls = 0;
  const ui = harness(async (_input, init) => {
    calls++;
    if (calls === 1) return stalled(init!.signal!);
    return calls === 2 ? example() : result();
  });
  const pending = ui.click();
  assert.equal(ui.run.disabled, true);
  assert.equal(ui.objective.disabled, true);
  assert.equal(ui.demo.attributes["aria-busy"], "true");
  await ui.click();
  assert.equal(calls, 1, "a busy click must not create another request");
  ui.expire();
  await pending;
  assert.equal(ui.run.disabled, false);
  assert.equal(ui.objective.disabled, false);
  assert.equal(ui.demo.attributes["aria-busy"], "false");
  assert.match(ui.status.textContent, /timed out/);
  assert.equal(ui.copy.hidden, true);
  assert.equal(ui.timers.size, 0);
  await ui.click();
  assert.equal(ui.demo.dataset.state, "success");
  assert.equal(ui.copy.hidden, false);
  assert.equal(ui.timers.size, 0);
});

test("the chosen priority reaches the router and gets a readable result while a failed retry preserves it", async () => {
  let calls = 0;
  let sent: typeof payload | undefined;
  const ui = harness(async (_input, init) => {
    calls++;
    if (calls === 1) return example();
    if (calls === 2) {
      sent = JSON.parse(String(init?.body)) as typeof payload;
      return result();
    }
    throw new Error("offline");
  });
  ui.objective.value = "quality";
  await ui.click();
  assert.equal(sent?.request.objective, "quality");
  assert.match(ui.summary.textContent, /For catalog quality.*selected example/);
  assert.match(ui.summary.textContent, /not a model run/);
  const previousSummary = ui.summary.textContent;
  ui.objective.value = "cost";
  await ui.click();
  assert.equal(ui.objective.value, "cost", "the requested priority survives a failed retry");
  assert.equal(ui.summary.textContent, previousSummary);
  assert.match(ui.status.textContent, /previous result is still shown/);
});

test("a blocked plan gives a next step and an unsupported priority makes no request", async () => {
  let calls = 0;
  const ui = harness(async () => ++calls === 1 ? example() : new Response(JSON.stringify({
    ok: true, plan: { ...plan, selectedModelId: null, eligible: [], rejected: [{ modelId: "example", reasonCodes: ["cost_exceeded"] }] },
  })));
  await ui.click();
  assert.match(ui.summary.textContent, /No model meets.*Review the rejection reasons/);
  ui.objective.value = "unexpected";
  await ui.click();
  assert.equal(calls, 2);
  assert.match(ui.status.textContent, /Choose one of the listed priorities/);
});

test("the demo deadline covers the route response body and retains the previous result", async () => {
  let calls = 0;
  let bodyStarted!: () => void;
  const bodyReady = new Promise<void>((resolve) => { bodyStarted = resolve; });
  const ui = harness(async (_input, init) => {
    calls++;
    if (calls % 2 === 1) return example();
    if (calls === 2) return result();
    return {
      ok: true,
      json: () => {
        bodyStarted();
        return stalled(init!.signal!);
      },
    } as unknown as Response;
  });
  await ui.click();
  const previous = ui.output.textContent;
  const pending = ui.click();
  await bodyReady;
  ui.expire();
  await pending;
  assert.equal(ui.output.textContent, previous);
  assert.match(ui.status.textContent, /timed out.*previous result is still shown/);
  assert.equal(ui.copy.hidden, false);
  assert.equal(ui.feedback.hidden, false);
  assert.equal(ui.run.disabled, false);
  assert.equal(ui.timers.size, 0);
});

test("malformed or rejected routing responses recover without displaying server diagnostics", async () => {
  for (const response of [
    () => new Response("private server diagnostic", { status: 500 }),
    () => new Response(JSON.stringify({ ok: false, private: "private server diagnostic" })),
    () => new Response(JSON.stringify({ ok: true, plan: {} })),
  ]) {
    let calls = 0;
    const ui = harness(async () => ++calls === 1 ? example() : response());
    await ui.click();
    assert.equal(ui.demo.dataset.state, "error");
    assert.equal(ui.run.disabled, false);
    assert.doesNotMatch(ui.output.textContent, /private server diagnostic/);
    assert.equal(ui.timers.size, 0);
  }
});
