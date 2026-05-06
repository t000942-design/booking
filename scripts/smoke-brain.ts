import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { think } from "../lib/ai/brain";

const cases: { q: string; ctx?: { phone?: string; name?: string } }[] = [
  { q: "is there parking?" },
  { q: "what time do you close?" },
  { q: "can you book me Friday 7pm pitch 1?", ctx: { phone: "+96599999999", name: "Test User" } },
  { q: "i want to book a slot" },
  { q: "any discounts?" },
];

(async () => {
  for (const c of cases) {
    console.log("\nQ:", c.q);
    try {
      const reply = await think(c.q, c.ctx);
      console.log("  text:", reply.content.slice(0, 220).replace(/\n/g, " ⏎ "));
      if (reply.suggestions) console.log("  suggestions:", reply.suggestions);
      if (reply.actions) console.log("  actions:", reply.actions.map((a) => `${a.kind}:${a.label}`));
      if (reply.link) console.log("  link:", reply.link);
      if (reply.bookingList) console.log("  bookingList rows:", reply.bookingList.length);
    } catch (err) {
      console.log("  ERROR:", err instanceof Error ? err.message : err);
    }
  }
})();
