const demo = document.querySelector("[data-live-demo]");

if (demo instanceof HTMLElement) {
  const runControls = Array.from(document.querySelectorAll("[data-run-demo]"));
  const copyButton = demo.querySelector("[data-copy-demo]");
  const feedbackLink = demo.querySelector("[data-demo-feedback]");
  const status = demo.querySelector("[data-demo-status]");
  const output = demo.querySelector("[data-demo-output]");
  const objective = demo.querySelector("[data-demo-objective]");
  const summary = demo.querySelector("[data-demo-summary]");

  if (
    runControls.length > 0
    && copyButton instanceof HTMLButtonElement
    && feedbackLink instanceof HTMLAnchorElement
    && status instanceof HTMLElement
    && output instanceof HTMLElement
    && objective instanceof HTMLSelectElement
    && summary instanceof HTMLElement
  ) {
    const setState = (state, message) => {
      demo.dataset.state = state;
      status.textContent = message;
    };

    let running = false;
    let hasResult = false;
    const setRunning = (value) => {
      demo.setAttribute("aria-busy", value ? "true" : "false");
      objective.disabled = value;
      for (const control of runControls) {
        control.setAttribute("aria-busy", value ? "true" : "false");
        if (control instanceof HTMLButtonElement) control.disabled = value;
      }
    };

    const runDemo = async (event) => {
      event.preventDefault();
      if (running) return;
      const chosenObjective = objective.value;
      const priorities = { balanced: "a balanced tradeoff", quality: "catalog quality", cost: "lower estimated cost", latency: "lower estimated latency" };
      if (!Object.hasOwn(priorities, chosenObjective)) {
        setState("error", "Choose one of the listed priorities, then try again.");
        return;
      }
      running = true;
      demo.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      setRunning(true);
      copyButton.hidden = true;
      feedbackLink.hidden = true;
      setState("loading", "Loading the public example and routing it now.");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      try {
        const exampleResponse = await fetch("/examples/route-request-v2.json", {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!exampleResponse.ok) throw new Error("example_unavailable");

        const payload = await exampleResponse.json();
        payload.request.objective = chosenObjective;
        const routeResponse = await fetch("/v2/route", {
          signal: controller.signal,
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await routeResponse.json();
        if (!routeResponse.ok || result?.ok !== true || !result.plan) {
          throw new Error("route_failed");
        }

        const catalogFor = (entry) => {
          const catalogEntry = payload.models.find((model) => model.modelId === entry?.modelId);
          if (!entry || !catalogEntry) return null;
          return {
            modelId: entry.modelId,
            providerId: entry.providerId,
            qualityScore: catalogEntry.qualityScore,
            reliabilityBasisPoints: catalogEntry.reliabilityBasisPoints,
            estimatedCostMicroUsd: catalogEntry.estimatedCostMicroUsd,
            estimatedLatencyMs: catalogEntry.estimatedLatencyMs,
          };
        };
        const winnerEntry = result.plan.eligible.find((entry) => entry.modelId === result.plan.selectedModelId);
        const runnerUpEntry = result.plan.eligible.find((entry) => entry.modelId !== result.plan.selectedModelId);
        const routeDecision = winnerEntry ? {
          selectedModelId: winnerEntry.modelId,
          selectedProviderId: winnerEntry.providerId,
          computedRouteScore: winnerEntry.score,
        } : null;
        const winner = catalogFor(winnerEntry);
        const runnerUp = catalogFor(runnerUpEntry);
        const tradeoffAgainstRunnerUp = winner && runnerUp ? {
          modelId: runnerUp.modelId,
          qualityScoreDelta: winner.qualityScore - runnerUp.qualityScore,
          reliabilityBasisPointsDelta: winner.reliabilityBasisPoints - runnerUp.reliabilityBasisPoints,
          estimatedCostMicroUsdDelta: winner.estimatedCostMicroUsd - runnerUp.estimatedCostMicroUsd,
          estimatedLatencyMsDelta: winner.estimatedLatencyMs - runnerUp.estimatedLatencyMs,
        } : null;

        const visibleResult = {
          ok: true,
          requestId: result.requestId,
          requestConstraints: {
            risk: payload.request.risk,
            objective: payload.request.objective,
            toolUse: payload.request.requirements.toolUse,
            structuredOutput: payload.request.requirements.structuredOutput,
            minContextTokens: payload.request.requirements.minContextTokens,
            dataBoundary: payload.request.constraints.dataBoundary,
            maxCostMicroUsd: payload.request.constraints.maxCostMicroUsd,
            maxLatencyMs: payload.request.constraints.maxLatencyMs,
          },
          rejected: result.plan.rejected,
          routeDecision,
          callerSuppliedCatalogEvidence: winner ? {
            selectedModel: winner,
            derivedTradeoffAgainstRunnerUp: tradeoffAgainstRunnerUp,
          } : null,
          decisionCodes: result.plan.decisionCodes,
        };
        output.textContent = JSON.stringify(visibleResult, null, 2);
        summary.textContent = winner
          ? `For ${priorities[chosenObjective]}, the router selected ${winner.modelId}. The router found ${result.plan.eligible.length} eligible models and excluded ${result.plan.rejected.length}. This is a routing decision using the example catalog, not a model run.`
          : `No model meets the example's requirements. Review the rejection reasons in the routing details before changing constraints. No model was run.`;
        hasResult = true;
        copyButton.hidden = false;
        feedbackLink.hidden = false;
        setState("success", `Selected ${result.plan.selectedModelId ?? "no eligible model"} from ${result.plan.eligible.length} eligible models; ${result.plan.rejected.length} rejected. This response came from the live router.`);
      } catch {
        if (!hasResult) {
          output.textContent = JSON.stringify({
            ok: false,
            error: "The live example could not complete. The API and CLI quickstarts remain available in the docs.",
          }, null, 2);
        }
        copyButton.hidden = !hasResult;
        feedbackLink.hidden = !hasResult;
        const failure = controller.signal.aborted ? "The live example timed out." : "The live example did not complete.";
        setState("error", `${failure}${hasResult ? " Your previous result is still shown." : ""} Try again or use the documented curl request.`);
      } finally {
        clearTimeout(timeout);
        running = false;
        setRunning(false);
      }
    };

    for (const control of runControls) control.addEventListener("click", runDemo);

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(output.textContent ?? "");
        setState("success", "Copied the displayed routing result.");
      } catch {
        setState("error", "Copy was unavailable. Select the result text instead.");
      }
    });
  }
}
