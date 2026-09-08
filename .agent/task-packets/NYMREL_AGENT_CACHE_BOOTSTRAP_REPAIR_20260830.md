# Nymrel Agent cache-bootstrap repair

Date: 2026-08-30
Owner: Codex
Claim: `codex-nymrel-agent-cache-bootstrap-20260830-v2`
Goal: `01a04d87-73f3-73e0-bd2f-8c89ee2b1023`
Pull request: `nymrel/nymrel-agent#1`
Base: `7df0fcb41088b8043d11d5cb1e4e8b8ac08ea637`
Starting candidate: `c299db0c4e9848312e1df990867f76eece55cba3`

## Defect

The candidate requires npm 11.19.1 through `devEngines`, while `actions/setup-node` probes the repository for npm cache metadata before the reviewed npm version is installed. A hosted runner with npm 11.19.0 therefore fails closed with `EBADDEVENGINES` before dependency installation.

## Bounded scope

- Disable setup-node's pre-toolchain package-manager cache probe.
- Enable Node's bundled Corepack npm shim outside the repository so the first repository npm command resolves the exact `packageManager` version.
- Add executable CI-contract assertions that preserve ordering and prevent regression.
- Document the sole elevated CodeQL permission and lock that rationale into the CI contract.
- Preserve the accepted runtime, package, application, security, and release contracts.

## Acceptance

- The mismatch is reproducible with the runner-equivalent npm 11.19.0 cache probe.
- The CI-contract suite proves cache bootstrap cannot run before npm 11.19.1.
- Full repository verification and audits pass under npm 11.19.1.
- Action syntax and workflow security scans pass.
- An independent reviewer accepts the exact commit and tree before push.
- Hosted execution remains an explicit provider gate; no merge, release, deploy, or publication is implied.
