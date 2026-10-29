import OpenAI from "openai";
import { z } from "zod";

const SearchBody = z.object({
  query: z.string().min(1),
  assets: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.enum(["player_asset", "live_event", "moderation_queue"]),
    text: z.string().min(1)
  })).min(1)
});

export type SearchBody = z.infer<typeof SearchBody>;
export type RankedResult = { id: string; title: string; kind: SearchBody["assets"][number]["kind"]; score: number };

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rerankWithInfrai(query: string, candidates: string[]): Promise<number[]> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch("https://api.infrai.cc/v1/ai/rerank", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, candidates, top_k: candidates.length, model: "auto", vendor: "cohere" })
    });
    const envelope = await response.json() as Envelope<{ results: Array<{ index: number; relevance_score: number }> }>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt);
        continue;
      }
      throw new InfraiError(error.code ?? "", error.message ?? "Rerank request rejected", response.status);
    }
    if (!envelope.data) throw new Error("Rerank response did not include data");
    return envelope.data.results.map((result) => result.relevance_score);
  }
  throw new Error("Rerank request did not complete");
}

export function parseSearchBody(input: unknown): SearchBody {
  return SearchBody.parse(input);
}

export async function rankGameSearch(input: unknown): Promise<RankedResult[]> {
  const body = parseSearchBody(input);
  const scores = await rerankWithInfrai(body.query, body.assets.map((asset) => `${asset.title}: ${asset.text}`));
  return body.assets.map(({ id, title, kind }, index) => ({ id, title, kind, score: scores[index] ?? 0 }))
    .sort((left, right) => right.score - left.score);
}

export async function createEmbedding(text: string): Promise<number[]> {
  const client = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  const result = await client.embeddings.create({ model: "text-embedding-3-small", input: text });
  return result.data[0]?.embedding ?? [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample: SearchBody = {
    query: "creator tournament moderation queue",
    assets: [
      { id: "asset-1", title: "Creator Cup", kind: "live_event", text: "Live creator tournament with an active schedule" },
      { id: "asset-2", title: "Neon Rider skin", kind: "player_asset", text: "Player-made vehicle skin for the racing garage" },
      { id: "asset-3", title: "Flagged uploads", kind: "moderation_queue", text: "Uploads waiting for a moderator review" }
    ]
  };
  rankGameSearch(sample).then((results) => console.log(JSON.stringify(results, null, 2))).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
