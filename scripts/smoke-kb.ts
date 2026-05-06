import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { searchKnowledgeBase } from "../lib/ai/knowledge";

const queries = [
  "parking",
  "can I bring food?",
  "how much for an hour",
  "what time do you open",
  "cancel my booking",
  "rain plan",
  "is pitch 2 indoor",
  "kids birthday party",
];

(async () => {
  for (const q of queries) {
    const hits = await searchKnowledgeBase(q, 2);
    const summary = hits.length > 0 ? hits.map((h) => h.slug).join(", ") : "(none)";
    console.log(`${q.padEnd(28)} → ${summary}`);
  }
})();
