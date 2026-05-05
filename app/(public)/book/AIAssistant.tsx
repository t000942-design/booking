"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { askAssistantAction } from "@/lib/server/aiActions";
import type { ChatMessage } from "@/lib/ai/types";

const STARTERS: ChatMessage = {
  role: "assistant",
  content:
    "Hey — I'm Coach. Ask me about open slots, prices, or which pitch to pick.",
  suggestions: ["What's open today?", "Cheapest time", "Recommend a pitch", "Where are you?"],
};

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([STARTERS]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  function send(question: string) {
    const q = question.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    startTransition(async () => {
      const reply = await askAssistantAction(q);
      setMessages((m) => [...m, reply]);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-pitch-500 to-pitch-700 text-white shadow-2xl ring-2 ring-white/40 transition hover:scale-105 active:scale-95"
        aria-label="Open AI assistant"
      >
        <SparkleIcon className="h-6 w-6" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[640px] sm:rounded-3xl"
          >
            <header className="flex items-center justify-between bg-gradient-to-br from-pitch-700 to-pitch-900 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
                  <SparkleIcon className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <div className="text-base font-bold">Coach</div>
                  <div className="text-[11px] opacity-80">
                    AI assistant · beta
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/25"
                aria-label="Close"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto bg-pitch-50/40 p-4"
            >
              <ul className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <li key={i}>
                    <Bubble
                      msg={m}
                      onPick={(s) => send(s)}
                      onLink={() => setOpen(false)}
                    />
                  </li>
                ))}
                {pending ? (
                  <li>
                    <Bubble
                      msg={{ role: "assistant", content: "…" }}
                      onPick={() => {}}
                      onLink={() => {}}
                    />
                  </li>
                ) : null}
              </ul>
            </div>

            <form
              className="flex items-center gap-2 border-t border-pitch-100 bg-white p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about slots, prices, or pitches…"
                className="h-11 w-full rounded-xl border border-pitch-100 bg-white px-3 text-sm outline-none focus:border-pitch-500 focus:ring-2 focus:ring-pitch-500/20"
                disabled={pending}
              />
              <Button
                type="submit"
                size="md"
                disabled={pending || !input.trim()}
              >
                Send
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Bubble({
  msg,
  onPick,
  onLink,
}: {
  msg: ChatMessage;
  onPick: (s: string) => void;
  onLink: () => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex flex-col items-start gap-2"}>
      <div
        className={
          "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed " +
          (isUser
            ? "rounded-br-sm bg-pitch-700 text-white"
            : "rounded-bl-sm bg-white text-pitch-950 shadow-sm ring-1 ring-pitch-100")
        }
      >
        {msg.content}
      </div>
      {!isUser && msg.link ? (
        <Link
          href={msg.link.href}
          onClick={onLink}
          className="rounded-full bg-pitch-700 px-3 py-1 text-xs font-semibold text-white hover:bg-pitch-800"
        >
          {msg.link.label} →
        </Link>
      ) : null}
      {!isUser && msg.suggestions && msg.suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {msg.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-full border border-pitch-200 bg-white px-3 py-1 text-xs font-medium text-pitch-800 hover:bg-pitch-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" fill="currentColor" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
