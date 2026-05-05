"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  askAssistantAction,
  chatActionAction,
} from "@/lib/server/aiActions";
import type {
  BookingSummary,
  ChatAction,
  ChatMessage,
} from "@/lib/ai/types";

const STARTERS: ChatMessage = {
  role: "assistant",
  content:
    "Hey — I'm Coach. Tell me what to do: book a slot, cancel one, list your bookings, or just ask a question.",
  suggestions: [
    "Book me Friday 7pm",
    "My bookings",
    "Any discounts?",
    "What's open today?",
  ],
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

  function runAction(action: ChatAction) {
    setMessages((m) => [
      ...m,
      { role: "user", content: `→ ${action.label}` },
    ]);
    startTransition(async () => {
      const reply = await chatActionAction(action);
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
                    AI assistant · takes commands
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

            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-pitch-50/40 p-4">
              <ul className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <li key={i}>
                    <Bubble
                      msg={m}
                      onPick={(s) => send(s)}
                      onLink={() => setOpen(false)}
                      onAction={runAction}
                      pending={pending}
                    />
                  </li>
                ))}
                {pending ? (
                  <li>
                    <Bubble
                      msg={{ role: "assistant", content: "…" }}
                      onPick={() => {}}
                      onLink={() => {}}
                      onAction={() => {}}
                      pending
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
                placeholder="Tell Coach what to do…"
                className="h-11 w-full rounded-xl border border-pitch-100 bg-white px-3 text-sm outline-none focus:border-pitch-500 focus:ring-2 focus:ring-pitch-500/20"
                disabled={pending}
              />
              <Button type="submit" size="md" disabled={pending || !input.trim()}>
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
  onAction,
  pending,
}: {
  msg: ChatMessage;
  onPick: (s: string) => void;
  onLink: () => void;
  onAction: (a: ChatAction) => void;
  pending: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex flex-col items-start gap-2"}>
      <div
        className={
          "max-w-[92%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed " +
          (isUser
            ? "rounded-br-sm bg-pitch-700 text-white"
            : "rounded-bl-sm bg-white text-pitch-950 shadow-sm ring-1 ring-pitch-100")
        }
      >
        {msg.content}
      </div>

      {!isUser && msg.bookingList && msg.bookingList.length > 0 ? (
        <ul className="flex w-full max-w-[92%] flex-col gap-1.5">
          {msg.bookingList.map((b) => (
            <BookingCard key={b.ref} booking={b} onAction={onAction} pending={pending} />
          ))}
        </ul>
      ) : null}

      {!isUser && msg.actions && msg.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {msg.actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onAction(a)}
              disabled={pending}
              className={
                "rounded-full px-3 py-1.5 text-xs font-bold shadow-sm disabled:opacity-50 " +
                actionToneClass(a.tone)
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {!isUser && msg.link ? (
        <Link
          href={msg.link.href}
          onClick={onLink}
          className="rounded-full bg-pitch-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-pitch-800"
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
              disabled={pending}
              className="rounded-full border border-pitch-200 bg-white px-3 py-1 text-xs font-medium text-pitch-800 hover:bg-pitch-50 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BookingCard({
  booking,
  onAction,
  pending,
}: {
  booking: BookingSummary;
  onAction: (a: ChatAction) => void;
  pending: boolean;
}) {
  const due = booking.priceFils - booking.discountFils;
  const isFinal = booking.status === "CANCELLED" || booking.status === "DONE";
  return (
    <li className="flex items-start gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-pitch-100">
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="font-bold text-pitch-950">{booking.pitch}</span>
          <span className="text-xs text-pitch-900/70">
            {booking.dateLabel} · {booking.timeLabel}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-mono text-pitch-900/60">{booking.ref}</span>
          <StatusBadge booking={booking} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="text-xs font-bold text-pitch-950">
          {booking.currency} {(due / 1000).toFixed(0)}
        </div>
        {!isFinal ? (
          <div className="flex flex-col items-end gap-1">
            {booking.paymentStatus !== "PAID" ? (
              <Link
                href={`/pay/${booking.ref}`}
                className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
              >
                Pay →
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() =>
                onAction({
                  kind: "cancel",
                  label: "Cancel",
                  payload: { ref: booking.ref },
                  tone: "danger",
                })
              }
              disabled={pending}
              className="rounded-full border border-red-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function StatusBadge({ booking }: { booking: BookingSummary }) {
  const tone =
    booking.status === "CANCELLED"
      ? "bg-red-100 text-red-800"
      : booking.status === "DONE"
      ? "bg-slate-100 text-slate-700"
      : booking.paymentStatus === "PAID"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-amber-100 text-amber-800";
  const label =
    booking.status === "CANCELLED"
      ? "Cancelled"
      : booking.status === "DONE"
      ? "Done"
      : booking.paymentStatus === "PAID"
      ? "Paid"
      : "Awaiting pay";
  return (
    <span className={`rounded-full px-1.5 py-0.5 font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function actionToneClass(tone?: "primary" | "danger" | "muted"): string {
  if (tone === "danger") return "bg-red-600 text-white hover:bg-red-700";
  if (tone === "muted") return "bg-slate-200 text-slate-800 hover:bg-slate-300";
  return "bg-pitch-700 text-white hover:bg-pitch-800";
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
