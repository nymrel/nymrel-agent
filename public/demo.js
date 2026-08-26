const demo = document.querySelector("[data-live-demo]");

if (demo instanceof HTMLElement) {
  const runControls = Array.from(document.querySelectorAll("[data-run-demo]"));
  const copyButton = demo.querySelector("[data-copy-demo]");
  const feedbackLink = demo.querySelector("[data-demo-feedback]");
  const status = demo.querySelector("[data-demo-status]");
  const output = demo.querySelector("[data-demo-output]");

  if (
    runControls.length > 0
    && copyButton instanceof HTMLButtonElement
    && feedbackLink instanceof HTMLAnchorElement
    && status instanceof HTMLElement
    && output instanceof HTMLElement
  ) {
    const setState = (state, message) => {
      demo.dataset.state = state;
      status.textContent = message;
    };

    let running = false;
    const setRunning = (value) => {
      for (const control of runControls) {
        control.setAttribute("aria-busy", value ? "true" : "false");
        if (control instanceof HTMLButtonElement) control.disabled = value;
      }
    };

    const runDemo = async (event) => {
      event.preventDefault();
      if (running) return;
      running = true;
      demo.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      setRunning(true);
      copyButton.hidden = true;
      feedbackLink.hidden = true;
      setState("loading", "Loading the public example and routing it now.");

      try {
        const exampleResponse = await fetch("/examples/route-request.json", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!exampleResponse.ok) throw new Error("example_unavailable");

        const payload = await exampleResponse.json();
        const routeResponse = await fetch("/v1/route", {
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
        copyButton.hidden = false;
        feedbackLink.hidden = false;
        setState("success", `Selected ${result.plan.selectedModelId ?? "no eligible model"} from ${result.plan.eligible.length} eligible models; ${result.plan.rejected.length} rejected. This response came from the live router.`);
      } catch {
        output.textContent = JSON.stringify({
          ok: false,
          error: "The live example could not complete. The API and CLI quickstarts remain available in the docs.",
        }, null, 2);
        setState("error", "The live example did not complete. Try again or use the documented curl request.");
      } finally {
        running = false;
        setRunning(false);
      }
    };

    for (const control of runControls) control.addEventListener("click", runDemo);

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(output.textContent ?? "");
        setState("success", "Copied the live routing result.");
      } catch {
        setState("error", "Copy was unavailable. Select the result text instead.");
      }
    });
  }
}
