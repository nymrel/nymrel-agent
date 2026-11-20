import fixture from "../route-request-v2.json";
import { routeV2 } from "../../dist/src/router-entry.js";
import { parsePublicRoutePayloadV2 } from "../../dist/src/validation.js";
import { NymrelError } from "../../dist/src/errors.js";
import { formatUsd as usd, parseCostCeiling, parseLatencyCeiling } from "./inputs.mjs";

const maximumImportBytes = 1024 * 1024;
const byId = (id) => document.getElementById(id);
const objective = byId("objective");
const cost = byId("cost-ceiling");
const latency = byId("latency-ceiling");
const fileInput = byId("metadata-file");
const exportMetadata = byId("export-metadata");
const exportPlan = byId("export-plan");
const reasonLabels = {
  health_unavailable: "The model is unavailable", probe_failed: "Its health probe failed",
  data_boundary_unsupported: "It does not meet the required data boundary", risk_class_unsupported: "It does not support the required risk class",
  tool_use_unsupported: "Tool use is required but unsupported", structured_output_unsupported: "Structured output is required but unsupported",
  context_too_small: "Its context window is too small", modality_unsupported: "A required modality is unsupported",
  cost_budget_exceeded: "Its estimate exceeds the cost ceiling", latency_budget_exceeded: "Its estimate exceeds the latency ceiling",
  duplicate_model_id: "The catalog repeats this model identifier", profile_invalid: "The model profile is invalid",
};
let basePayload = null;
let currentPayload = null;
let currentPlan = null;
let importGeneration = 0;
let catalogKind = "Packaged synthetic catalog";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function fieldsEnabled(enabled) {
  for (const field of [objective, cost, latency]) field.disabled = !enabled;
}

function fieldError(field, id, message) {
  field.setAttribute("aria-invalid", message ? "true" : "false");
  byId(id).textContent = message;
  byId(id).hidden = !message;
}

function clearFieldErrors() {
  fieldError(cost, "cost-error", "");
  fieldError(latency, "latency-error", "");
}

function inactive(state, heading, message) {
  currentPayload = null;
  currentPlan = null;
  exportMetadata.disabled = true;
  exportPlan.disabled = true;
  byId("decision").dataset.state = state;
  byId("decision").setAttribute("aria-busy", state === "loading" ? "true" : "false");
  byId("state-label").textContent = state === "loading" ? "Reading metadata" : "Invalid input";
  byId("winner").textContent = heading;
  byId("state-message").textContent = message;
  for (const id of ["metric-cost", "metric-latency", "metric-eligible", "metric-frontier"]) byId(id).textContent = "—";
  byId("effective-ceilings").textContent = "No current metadata or plan is available for export.";
  byId("eligible-models").replaceChildren();
  byId("rejected-models").replaceChildren();
  byId("eligible-note").textContent = "A valid request is needed to evaluate eligibility.";
  byId("rejected-note").textContent = "Invalid input is different from a valid blocked plan.";
}

function render(payload, plan) {
  currentPayload = payload;
  currentPlan = plan;
  exportMetadata.disabled = false;
  exportPlan.disabled = false;
  const selected = plan.selectedModelId !== null;
  byId("decision").dataset.state = selected ? "selected" : "blocked";
  byId("decision").setAttribute("aria-busy", "false");
  byId("state-label").textContent = selected ? "Selected" : "Blocked";
  byId("winner").textContent = selected ? plan.selectedModelId : "No model meets this policy.";
  byId("state-message").textContent = selected ? plan.explanation : "Review the rejection reasons and catalog evidence against your required constraints. No provider was called.";
  byId("catalog-source").textContent = `${catalogKind} · ${payload.models.length} model(s)`;
  const profiles = new Map(payload.models.map((model) => [model.modelId, model]));
  const selectedProfile = profiles.get(plan.selectedModelId);
  byId("metric-cost").textContent = selectedProfile ? `USD ${usd(selectedProfile.estimatedCostMicroUsd)}` : "—";
  byId("metric-latency").textContent = selectedProfile ? `${selectedProfile.estimatedLatencyMs} ms` : "—";
  byId("metric-eligible").textContent = `${plan.eligible.length} / ${payload.models.length}`;
  byId("metric-frontier").textContent = String(plan.paretoFrontierModelIds.length);
  const ceilings = payload.request.constraints;
  byId("effective-ceilings").textContent = `Effective ceilings: ${ceilings.maxCostMicroUsd === undefined ? "cost not set" : `USD ${usd(ceilings.maxCostMicroUsd)} (${ceilings.maxCostMicroUsd} microUSD)`} · ${ceilings.maxLatencyMs === undefined ? "latency not set" : `${ceilings.maxLatencyMs} ms`}`;
  byId("anchors").textContent = `This request’s score anchors remain USD ${usd(payload.request.normalization.costAnchorMicroUsd)} and ${payload.request.normalization.latencyAnchorMs} ms. Editing a ceiling changes eligibility, not these normalization anchors.`;
  const frontier = new Set(plan.paretoFrontierModelIds);
  const eligible = plan.eligible.map((candidate) => {
    const card = element("li", undefined, `model-card${candidate.modelId === plan.selectedModelId ? " is-selected" : ""}`);
    const top = element("div", undefined, "model-top");
    top.append(element("span", candidate.modelId, "model-name"), element("span", `Score ${candidate.score}`, "model-score"));
    card.append(top);
    if (candidate.modelId === plan.selectedModelId) card.append(element("span", "Selected", "badge selected"));
    card.append(element("span", frontier.has(candidate.modelId) ? "Pareto frontier" : "Outside frontier", "badge"));
    const model = profiles.get(candidate.modelId);
    const facts = element("p", undefined, "model-facts");
    facts.append(element("span", `USD ${usd(model.estimatedCostMicroUsd)}`), element("span", `${model.estimatedLatencyMs} ms`));
    card.append(facts);
    return card;
  });
  byId("eligible-models").replaceChildren(...(eligible.length ? eligible : [element("li", "No eligible models.", "empty-list")]));
  const rejected = plan.rejected.map((candidate) => {
    const card = element("li", undefined, "model-card");
    card.append(element("span", candidate.modelId, "model-name"));
    const reasons = element("ul", undefined, "reason-list");
    for (const code of candidate.reasonCodes) {
      const row = element("li", reasonLabels[code] ?? "Rejected by the required policy");
      row.append(element("code", code));
      reasons.append(row);
    }
    card.append(reasons);
    return card;
  });
  byId("rejected-models").replaceChildren(...(rejected.length ? rejected : [element("li", "No rejected models.", "empty-list")]));
  byId("eligible-note").textContent = `${plan.eligible.length} eligible. Canonical score order; selection uses only the frontier.`;
  byId("rejected-note").textContent = `${plan.rejected.length} rejected by explicit constraints. Codes are from the existing router.`;
}

function applyControls() {
  importGeneration += 1;
  clearFieldErrors();
  if (basePayload === null) return;
  let costValue, latencyValue, message = "";
  try { costValue = parseCostCeiling(cost.value); } catch (error) { message = error.message; fieldError(cost, "cost-error", message); }
  try { latencyValue = parseLatencyCeiling(latency.value); } catch (error) { message ||= error.message; fieldError(latency, "latency-error", error.message); }
  if (message) { inactive("invalid", "Check your policy inputs.", message); return; }
  try {
    const next = structuredClone(basePayload);
    next.request.objective = objective.value;
    if (costValue === undefined) delete next.request.constraints.maxCostMicroUsd;
    else next.request.constraints.maxCostMicroUsd = costValue;
    if (latencyValue === undefined) delete next.request.constraints.maxLatencyMs;
    else next.request.constraints.maxLatencyMs = latencyValue;
    const payload = parsePublicRoutePayloadV2(next);
    render(payload, routeV2(payload.request, payload.models));
  } catch (error) {
    inactive("invalid", "Metadata needs attention.", error instanceof NymrelError ? error.details[0] ?? error.message : "This metadata could not be evaluated.");
  }
}

function loadPayload(payload, kind) {
  basePayload = parsePublicRoutePayloadV2(payload);
  catalogKind = kind;
  objective.value = basePayload.request.objective;
  const ceilings = basePayload.request.constraints;
  cost.value = ceilings.maxCostMicroUsd === undefined ? "" : usd(ceilings.maxCostMicroUsd);
  latency.value = ceilings.maxLatencyMs === undefined ? "" : String(ceilings.maxLatencyMs);
  fieldsEnabled(true);
  applyControls();
}

byId("policy-form").addEventListener("input", applyControls);
byId("policy-form").addEventListener("submit", (event) => { event.preventDefault(); applyControls(); });
byId("reset").addEventListener("click", () => { importGeneration += 1; fileInput.value = ""; loadPayload(structuredClone(fixture), "Packaged synthetic catalog"); });
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const generation = ++importGeneration;
  basePayload = null;
  fieldsEnabled(false);
  clearFieldErrors();
  byId("catalog-source").textContent = "Reading imported metadata";
  byId("anchors").textContent = "A valid v2 metadata request supplies positive normalization anchors.";
  inactive("loading", "Reading your metadata…", "Exports stay disabled until a complete valid request is available.");
  try {
    if (file.size > maximumImportBytes) throw new Error("size");
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > maximumImportBytes) throw new Error("size");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const payload = parsePublicRoutePayloadV2(JSON.parse(text));
    if (generation !== importGeneration) return;
    fileInput.value = "";
    loadPayload(payload, "Imported metadata");
  } catch (error) {
    if (generation !== importGeneration) return;
    const message = error instanceof NymrelError ? error.details[0] ?? error.message : file.size > maximumImportBytes ? "The metadata file exceeds 1 MiB. Choose a smaller v2 JSON catalog." : "Use complete UTF-8 JSON with a valid v2 request and model catalog.";
    byId("catalog-source").textContent = "Import not accepted";
    inactive("invalid", "Import needs attention.", `${message} Choose another file or reset the example.`);
  } finally {
    if (generation === importGeneration) fileInput.value = "";
  }
});

function download(value, filename) {
  if (value === null) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" }));
  const link = element("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
exportMetadata.addEventListener("click", () => download(currentPayload, "nymrel-routing-metadata.json"));
exportPlan.addEventListener("click", () => download(currentPlan, "nymrel-route-plan.json"));
loadPayload(structuredClone(fixture), "Packaged synthetic catalog");
