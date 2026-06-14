import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../app";
import { pool } from "@workspace/db";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await pool.end();
});

type CandidatesPage = {
  items: Array<{ id: string; name: string; level: string }>;
  total: number;
};

async function listCandidates(query = ""): Promise<CandidatesPage> {
  const res = await fetch(`${baseUrl}/api/candidates${query}`);
  expect(res.status).toBe(200);
  return (await res.json()) as CandidatesPage;
}

describe("GET /candidates contract", () => {
  it("returns a { items, total } object, not a bare array", async () => {
    const page = await listCandidates("?limit=5");
    expect(Array.isArray(page)).toBe(false);
    expect(Array.isArray(page.items)).toBe(true);
    expect(typeof page.total).toBe("number");
  });

  it("respects the limit and total is never less than the page", async () => {
    const page = await listCandidates("?limit=5");
    expect(page.items.length).toBeLessThanOrEqual(5);
    expect(page.total).toBeGreaterThanOrEqual(page.items.length);
  });

  it("reports a total that is unaffected by limit", async () => {
    const [small, large] = await Promise.all([
      listCandidates("?limit=1"),
      listCandidates("?limit=600"),
    ]);
    expect(small.total).toBe(large.total);
    // items returned is always min(total, limit), regardless of dataset size.
    expect(large.items.length).toBe(Math.min(large.total, 600));
    expect(small.items.length).toBe(Math.min(small.total, 1));
  });

  it("applies the level filter to both items and total", async () => {
    const all = await listCandidates("?limit=600");
    if (all.total === 0) return; // empty DB: nothing more to assert

    const senate = await listCandidates("?level=senate&limit=600");
    expect(senate.items.every((c) => c.level === "senate")).toBe(true);
    expect(senate.items.length).toBe(Math.min(senate.total, 600));
    expect(senate.total).toBeLessThanOrEqual(all.total);
  });

  it("applies the search query to both items and total", async () => {
    const all = await listCandidates("?limit=600");
    if (all.total === 0) return;

    // Derive a real name fragment so the test is not pinned to a specific person.
    const sample = all.items[0];
    const fragment = sample.name.split(" ").pop()!.slice(0, 4).toLowerCase();

    const found = await listCandidates(`?q=${encodeURIComponent(fragment)}&limit=600`);
    expect(found.items.length).toBe(Math.min(found.total, 600));
    expect(found.total).toBeGreaterThan(0);
    expect(found.total).toBeLessThanOrEqual(all.total);
    expect(found.items.every((c) => c.name.toLowerCase().includes(fragment))).toBe(true);
  });
});
