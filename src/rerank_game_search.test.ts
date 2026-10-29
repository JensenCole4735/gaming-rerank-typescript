import assert from "node:assert/strict";
import test from "node:test";
import { parseSearchBody } from "./rerank_game_search.ts";

test("the request boundary keeps a creator search focused on content-shaped records", () => {
  const body = parseSearchBody({
    query: "live creator tournament",
    assets: [
      { id: "event-1", title: "Creator Cup", kind: "live_event", text: "Live tournament schedule" },
      { id: "asset-1", title: "Blue racer", kind: "player_asset", text: "Player-made car skin" }
    ]
  });
  assert.equal(body.assets[0].kind, "live_event");
  assert.throws(() => parseSearchBody({ query: "", assets: [] }));
});
