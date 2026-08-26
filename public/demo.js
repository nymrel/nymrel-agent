const demo = document.querySelector("[data-live-demo]");

if (demo instanceof HTMLElement) {
  const runButton = demo.querySelector("[data-run-demo]");
  const copyButton = demo.querySelector("[data-copy-demo]");
  const feedbackLink = demo.querySelector("[data-demo-feedback]");
  const status = demo.querySelector("[data-demo-status]");
  const output = demo.querySelector("[data-demo-output]");

  if (
    runButton instanceof HTMLButtonElement
    && copyButton instanceof HTMLButtonElement
    && feedbackLink instanceof HTMLAnchorElement
    && status instanceof HTMLElement
    && output instanceof HTMLElement
  ) {
    const setState = (state, message) => {
      demo.dataset.state = state;
      status.textContent = message;
    };

    runButton.addEventListener("click", async () => {
      runButton.disabled = true;
      runButton.setAttribute("aria-busy", "true");
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

        const visibleResult = {
          ok: true,
          requestId: result.requestId,
          selectedModelId: result.plan.selectedModelId,
          selectedProviderId: result.plan.selectedProviderId,
          objective: result.plan.objective,
          rejected: result.plan.rejected,
          decisionCodes: result.plan.decisionCodes,
        };
        output.textContent = JSON.stringify(visibleResult, null, 2);
        copyButton.hidden = false;
        feedbackLink.hidden = false;
        setState("success", `Selected ${result.plan.selectedModelId ?? "no eligible model"}. This response came from the live router.`);
      } catch {
        output.textContent = JSON.stringify({
          ok: false,
          error: "The live example could not complete. The API and CLI quickstarts remain available in the docs.",
        }, null, 2);
        setState("error", "The live example did not complete. Try again or use the documented curl request.");
      } finally {
        runButton.disabled = false;
        runButton.removeAttribute("aria-busy");
      }
    });

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
