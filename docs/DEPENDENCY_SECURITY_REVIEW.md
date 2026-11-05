# Dependency security update

The full dependency audit on source commit
`0309940f769838c1a5ce54ed82263f441b35566c` reported seven affected dependency entries
(six high, one moderate). This candidate pins the following replacements:

| Direct package | Previous | Candidate |
| --- | --- | --- |
| `@modelcontextprotocol/server` | 2.0.0 | 2.4.0 |
| `hono` | 4.13.5 | 4.13.16 |
| `zod` | 4.5.4 | 4.6.7 |
| `wrangler` (development) | 4.127.1 | 4.157.0 |

The Wrangler update replaces affected Sharp and Undici transitives. Existing
Dependabot PR #4 targets Wrangler 4.129.0, which remains inside the reported
affected range. PR #9 overlaps the runtime dependency updates; review these
candidates together before integrating either.

The lockfile retains registry URLs and SHA-512 integrity checks. The exact
`esbuild` 0.28.2 and `workerd` 1.20261103.1 tarballs were downloaded without
running their lifecycle scripts and checked against those integrity values.
Their package manifests and `install.js` scripts were inspected before updating
the exact-version script allowlist. Both scripts locate a platform-specific
optional binary, with npm-registry fallback installation/download and a binary
version check. This inspection is bounded and is not a general upstream audit.

Reviewed tarball SHA-256 digests:

- `esbuild` 0.28.2: `e045f94c235c7adc50e77ba2a579c7bec41b496b6b47c3a7845f7c1e19959a88`
- `workerd` 1.20261103.1: `229b67b764db2bbd73133baebc0540117ed9338fe2d98d4040e2d53e783bb46f`

Historical versioned source/package archives, manifests, tags, and release
receipts are retained byte-for-byte. This is a source candidate and grants no
registry-publication, deployment, promotion, or runtime-activation authority.
