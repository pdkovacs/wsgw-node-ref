# wsgw-node-ref — Node.js reference backend for wsgw

A small Fastify/TypeScript backend that implements the contract expected by [`pdkovacs/wsgw`](https://github.com/pdkovacs/wsgw) — the WebSocket gateway that owns client WS connections so application backends can stay stateless and speak plain HTTP.

This repo exists for two reasons:

1. **A reference implementation of the wsgw backend contract**, in something more accessible than the Go [`test/mockapp/`](https://github.com/pdkovacs/wsgw) inside the gateway repo.
2. **The end-to-end test app** used to exercise wsgw under realistic conditions — multiple concurrent users, pluggable connection tracking (in-memory / DynamoDB / Valkey), HTTP/2 between app and gateway, OpenTelemetry traces and metrics.

If you're integrating with wsgw in a Node service, this is the shape your backend needs to take.

## How it fits with wsgw

```
Client                wsgw                       wsgw-node-ref (this repo)
  |                     |                                  |
  |--- GET /connect --->|--- GET  /ws/connect ------------>|  auth + register conn
  |<---- 101 -----------|<--------- 200 OK ----------------|
  |                     |                                  |
  |---- WS frame ------>|--- POST /ws/message ------------>|  ingest from client
  |                     |<--------- 200 OK ----------------|
  |                     |                                  |
  |                     |<-- POST /message/{id} -----------|  push to client
  |<--- WS frame -------|----------- 204 ---------------- >|     (via /api/message)
  |                     |                                  |
  |--- WS close ------->|--- POST /ws/disconnected ------->|  drop conn
```

Roles of this app:

- **As a wsgw backend** — serves `/ws/connect`, `/ws/message`, `/ws/disconnected` (mounted under the `/ws` prefix). wsgw forwards client traffic and lifecycle events here.
- **As a sender** — exposes `/api/message` and `/api/messages-in-bulk`. Other parts of the system (or the smoke test) post here to fan a payload out to a user's live WebSocket connections, which the app does by `POST`ing to wsgw's `/message/{connectionId}` for each tracked connection ID.

The app is the source of truth for "which connection IDs belong to which user". Tracking is pluggable so this repo also serves as a place to compare backends (in-process map vs. DynamoDB vs. Valkey) under load.

## Quick start

```bash
task run             # build + run against a local wsgw on E2EAPP_WSGW_HOST:PORT
task smoke-test      # round-trip a message through wsgw and assert delivery
task app:image       # build a container image (uses minikube's docker daemon if available)
```

`task run` auto-generates 30 demo users (`user1`..`user30` / `crixcrax1`..`crixcrax30`) and listens on `:45678`, expecting wsgw at `localhost:45679`. To point at a different gateway:

```bash
export E2EAPP_SERVER_PORT=45678
export E2EAPP_WSGW_HOST=localhost
export E2EAPP_WSGW_PORT=45679
export E2EAPP_PASSWORD_CREDENTIALS='[{"username":"alice","password":"hunter2"}]'
node app/dist/app/src/index.js
```

## Endpoint reference

### Served to wsgw (the backend contract)

Mounted under `/ws`. Authentication is Basic Auth, applied as a Fastify `preHandler` to every protected route — wsgw forwards the client's `Authorization` header through unchanged on `GET /ws/connect`, and the smoke test/sender uses the same scheme.

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/ws/connect` | Authenticate the upgrading client, register `(userId, connectionId)` in the tracker, return `200`. `401` if Basic Auth fails, `400` if `X-WSGW-CONNECTION-ID` is missing, `403` if the session has no user. |
| `POST` | `/ws/message` | Ingest a frame the client sent. Currently logs and returns `200` — replace this with whatever your application does with inbound messages. |
| `POST` | `/ws/disconnected` | Drop the connection from the tracker. `200` on success, `400` if connection-id or user is missing. |

### Served to other clients (the sender API)

Mounted under `/api`. Same Basic Auth.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/message` | Send a single `E2EMessage` to its `recipients`. The app looks up each recipient's tracked connection IDs and `POST`s the payload to wsgw's `/message/{id}`. Stale IDs (`404` from wsgw) are evicted from the tracker. Returns `204`. |
| `POST` | `/api/messages-in-bulk` | Same, but for an array of messages. Used by the e2e load harness. |

### Always available

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/app-info` | Build/version info from `app/image/version.json`. |
| `GET`  | `/user`, `/users` | User info / listing (Basic Auth). |
| `GET`  | `/config` | Effective runtime configuration. |
| `GET`  | `/test-otel` | Toy handler that emits a span and a counter — useful when wiring up an OTel collector. |

### Headers

- **`X-WSGW-CONNECTION-ID`** — set by wsgw on every call into this app. Read lower-cased (`x-wsgw-connection-id`) because Node normalises header names.
- **`Authorization`** — Basic, validated against `E2EAPP_PASSWORD_CREDENTIALS`. wsgw does no auth itself; it just forwards the client header.

## Configuration

All variables are prefixed `E2EAPP_`.

| Variable | Default | Description |
|---|---|---|
| `E2EAPP_SERVER_PORT` | `8080` | Listening port. |
| `E2EAPP_HTTP2` | `false` | Serve h2c (cleartext HTTP/2) toward wsgw. Pair with `WSGW_HTTP2=true` on the gateway side. |
| `E2EAPP_PASSWORD_CREDENTIALS` | — | **Required.** JSON array of `{username, password}`. Used for Basic Auth on every protected route. |
| `E2EAPP_WSGW_HOST` | — | **Required.** Hostname of the wsgw instance to push outgoing messages to. |
| `E2EAPP_WSGW_PORT` | — | **Required.** Port of the wsgw instance. |
| `E2EAPP_CONNECTION_TRACKING` | `in-memory` | Tracker backend: `in-memory`, `dynamodb`, or `valkey`. |
| `E2EAPP_CONNECTION_TRACKING_URL` | — | Endpoint URL. Required for `valkey` (e.g. `valkey://host:6379/0`), optional for `dynamodb` (overrides the default AWS endpoint — useful for DynamoDB Local), forbidden for `in-memory`. |

Standard OpenTelemetry env vars (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, etc.) are honored via `@opentelemetry/sdk-node`.

## Connection tracking backends

Selected via `E2EAPP_CONNECTION_TRACKING`:

- **`in-memory`** — a `Map<userId, Set<connectionId>>`. Fast, zero deps, single-process only. Default; right for local dev and the smoke test.
- **`dynamodb`** — table `WsgwConnectionIds` keyed by `(UserId, ConnectionId)`. Region is hardcoded to `eu-west-2`; override the endpoint via `E2EAPP_CONNECTION_TRACKING_URL` when running against DynamoDB Local.
- **`valkey`** — one Set per user under key `WsgwConnectionIds:{userId}`. URL accepts `valkey://`, `valkeys://`, `redis://`, `rediss://`; path component selects the DB index.

## Observability

OpenTelemetry traces and metrics are wired up via `@opentelemetry/sdk-node` with auto-instrumentation for `http` and Fastify. Notable custom signals:

- `e2e-app.handler.call.count` and per-handler request counters (`connectRequestCounter`, `disconnectRequestCounter`, `messageRequestCounter`).
- `staleWsConnIdCounter` — incremented when wsgw returns `404` for a connection ID and the tracker evicts it.
- Spans for `new-ws-connection`, `ws-disconnect`, `handle-send-message-request`, and `find-user-devices`.

Trace context propagates end-to-end: the sender API extracts incoming context, attaches it to the `E2EMessage.traceData` field, and re-injects it on the outgoing request to wsgw — so a single trace covers `client → wsgw → app → wsgw → other client`.

Logs are structured JSON via Winston (see [common/src/logger.ts](common/src/logger.ts)).

## Smoke test

[`test/src/smoke-test.ts`](test/src/smoke-test.ts) opens a WebSocket through wsgw, posts a message via this app's `/api/message`, and asserts it arrives on the WebSocket. Defaults target a minikube layout; override with `E2ECLIENT_WSGW_URI`, `E2ECLIENT_APP_SERVICE_URL`, and `E2ECLIENT_PASSWORD_CREDENTIALS`.

## Deployment

Reference Kubernetes manifests live in [`deploy/k8s/`](deploy/k8s/) — a Deployment/Service for the app and a Contour `HTTPProxy`. The `app:image` and `k8s` tasks in [`taskfile.yaml`](taskfile.yaml) build the container image and apply the manifests against a local cluster.

## Status

Reference / test code. The wire contract toward wsgw is stable (it has to be — wsgw's integration suite depends on it); everything else is subject to change. Released under the MIT License — see [LICENSE](LICENSE).
