# HTTP API

The complete GymBuddy HTTP API — every route of `api/server.js`, with auth,
request/response schemas and the env-dependent behavior — is documented as a
hand-written OpenAPI 3.1 spec:

- **Spec (source of truth):** [`api/openapi.yaml`](../api/openapi.yaml)

Lint it after changing routes:

```sh
npx --yes @redocly/cli lint api/openapi.yaml
```
