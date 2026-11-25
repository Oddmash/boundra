import { test, expect } from "@playwright/test";

test("agent-readable documentation is served as text from the production base", async ({ request }) => {
  const index = await request.get("./llms.txt");
  expect(index.ok()).toBe(true);
  expect(index.headers()["content-type"]).toMatch(/^text\/(?:plain|markdown)(?:;|$)/i);
  const text = await index.text();
  expect(text.startsWith("# Boundra\n")).toBe(true);
  const references = [...text.matchAll(/https:\/\/oddmash\.github\.io\/boundra\/llms\/(en|ko|ja|zh-cn)\/[a-z0-9-]+\.md/g)];
  expect(new Set(references.map(match => match[0])).size).toBe(76);
  expect(text).not.toContain("<!DOCTYPE html>");

  const reference = await request.get("./llms/ko/user-guide.md");
  expect(reference.ok()).toBe(true);
  expect(reference.headers()["content-type"]).toMatch(/^text\/(?:plain|markdown)(?:;|$)/i);
  const markdown = await reference.text();
  expect(markdown).toContain("# Boundra 사용 가이드");
  expect(markdown).toContain("pnpm add boundra zod");
  expect(markdown).not.toContain("<!DOCTYPE html>");
});
