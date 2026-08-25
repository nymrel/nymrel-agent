# Security policy

## Supported version

Security fixes are applied to the latest released minor version. v0.1 is the current supported line.

## Report privately

Email `contact@jalenbuilds.com` with the subject `Nymrel Agent security`. Include the affected version, impact, and minimum reproduction. Do not include provider credentials, customer data, or live exploit payloads in the first message.

Please do not open a public issue for a suspected vulnerability. We will acknowledge a usable report and coordinate disclosure after validating it; no response-time guarantee or bounty program is currently offered.

## Security boundary

The public service accepts routing metadata only. It rejects unknown fields, including prompt-like fields, and does not intentionally persist request bodies in application code. Hosting infrastructure may process standard network metadata for delivery, abuse protection, and operational telemetry.

The local execution harness reads credentials from environment-variable names declared in local configuration. Credentials are sent from the customer's machine to the configured provider and are not printed or placed in receipts. v0.1 local execution is read-only and has no shell or filesystem-write tool.

Run receipts contain unkeyed SHA-256 digests of task and output bodies. Those digests are for local correlation and can confirm a guessed low-entropy value; they are not encryption, redaction, or a confidentiality boundary.

## Out of scope for v0.1

Hosted provider-key custody, user accounts, billing, customer-data storage, write-capable tools, autonomous external side effects, and operating-system sandbox claims are not part of v0.1.
