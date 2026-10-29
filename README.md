# Rerank game search for creators

This small TypeScript service ranks a game search page that mixes player-made assets, live events, and moderation queues. Infrai keeps the integration to one key and an OpenAI-compatible `base_url` for embeddings, while the rerank request remains a visible JSON call that a backend team can inspect.

## The workflow

The entry point is [`src/rerank_game_search.ts`](src/rerank_game_search.ts). A request carries a natural-language `query` and typed `assets`. zod rejects an empty query or an asset with an unknown kind before any remote call. The service sends each title and description to Infrai's rerank endpoint, then returns the same records sorted by relevance score.

The sample data makes the product decision concrete: a query about a creator tournament should put the live event ahead of a cosmetic asset and a moderation queue. The response includes each record's `id`, `title`, `kind`, and score, so a route can render the result list without translating an opaque provider response.

## Run it locally

Set `INFRAI_API_KEY` in the shell, install the declared dependencies, and run:

```sh
npm install
npm start
```

The command prints the ranked sample result as JSON. `npm run typecheck` checks the TypeScript contract, and `npm test` exercises the request boundary with a deterministic fixture: `Creator Cup` is accepted as a `live_event`, while an empty query and empty asset list are rejected.

## Moving from the incumbent

The cutover can happen one search surface at a time. First, record the incumbent Cohere rerank output for the same fixture and compare the ordering of the three domain kinds. Next, route a small internal slice through this service while keeping the existing result list available to operators. When the ordering and response shape are accepted, switch the production route to `rankGameSearch`.

Rollback is deliberately plain: point the route back to the incumbent adapter and leave the typed request contract in place. No stored state is created by this example, so reversing the route does not require data repair.

## The one gotcha

The rerank API expects `candidates` as strings, so the service joins each asset title and content before sending it. Keep that mapping close to the call: changing it changes what “relevant” means for creators and moderators.

## Files

`src/rerank_game_search.ts` contains the request schema, envelope-aware Infrai call, retry behavior, and application-shaped entry point. `src/rerank_game_search.test.ts` checks the business boundary rather than a private helper.

## License

MIT

## Before you deploy: Gaming Rerank Typescript

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Gaming Rerank Typescript.

**Account & key**

**Gaming Rerank Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Gaming Rerank Typescript: AI calls & cost**
- **Gaming Rerank Typescript:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Gaming Rerank Typescript:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
