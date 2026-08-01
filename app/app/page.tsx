"use client";

import { Button, Card, CardBody, Chip, Progress, Textarea } from "@heroui/react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

type Signal = {
  id: string;
  label: string;
  score: number;
  note: string;
};

type Analysis = {
  score: number;
  verdict: string;
  signals: Signal[];
  suggestions: string[];
};

type HistoryItem = {
  id: string;
  title: string;
  score: number;
  createdAt: string;
};

const HISTORY_KEY = "veriguard_history_v1";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const countMatches = (text: string, regex: RegExp) => (text.match(regex) ?? []).length;

const analyzeText = (text: string): Analysis => {
  const clean = text.trim();
  if (!clean) {
    return {
      score: 0,
      verdict: "paste text to analyze",
      signals: [],
      suggestions: ["paste the response you want to check"],
    };
  }

  const hasLinks = /https?:\/\//i.test(clean);
  const numbers = countMatches(clean, /\b\d+(?:\.\d+)?\b/g);
  const hedgeWords = countMatches(clean, /\b(might|may|could|possibly|generally|often|typically|likely|suggests)\b/gi);
  const strongClaims = countMatches(clean, /\b(always|never|guaranteed|proves|definitely|undeniably)\b/gi);
  const quotes = countMatches(clean, /"[^"]+"/g);
  const longSentences = clean.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length >= 26).length;

  const signalScores: Signal[] = [
    {
      id: "sources",
      label: "sources or links",
      score: hasLinks ? 90 : 30,
      note: hasLinks ? "links found" : "no links found",
    },
    {
      id: "numbers",
      label: "numbers with context",
      score: numbers > 0 ? 70 : 40,
      note: numbers > 0 ? `${numbers} numeric claim${numbers > 1 ? "s" : ""}` : "no numeric claims",
    },
    {
      id: "hedging",
      label: "uncertainty language",
      score: hedgeWords > 0 ? 75 : 45,
      note: hedgeWords > 0 ? `${hedgeWords} cautious phrase${hedgeWords > 1 ? "s" : ""}` : "no cautious phrases",
    },
    {
      id: "absolutes",
      label: "absolute claims",
      score: strongClaims > 0 ? 35 : 75,
      note: strongClaims > 0 ? `${strongClaims} absolute claim${strongClaims > 1 ? "s" : ""}` : "no absolute claims",
    },
    {
      id: "quotes",
      label: "quoted evidence",
      score: quotes > 0 ? 80 : 45,
      note: quotes > 0 ? `${quotes} quote${quotes > 1 ? "s" : ""}` : "no quotes",
    },
    {
      id: "readability",
      label: "clarity",
      score: longSentences > 2 ? 45 : 75,
      note: longSentences > 2 ? "many long sentences" : "readable length",
    },
  ];

  const base = signalScores.reduce((sum, s) => sum + s.score, 0) / signalScores.length;
  const penalty = strongClaims * 3 + (hasLinks ? 0 : 6);
  const score = clamp(Math.round(base - penalty), 5, 95);

  let verdict = "medium confidence";
  if (score >= 80) verdict = "high confidence";
  if (score <= 50) verdict = "low confidence";

  const suggestions: string[] = [];
  if (!hasLinks) suggestions.push("add one or two trusted sources");
  if (numbers > 0 && !hasLinks) suggestions.push("attach numbers to a source");
  if (strongClaims > 0) suggestions.push("soften absolute language unless proven");
  if (hedgeWords === 0) suggestions.push("add uncertainty language when unsure");

  return {
    score,
    verdict,
    signals: signalScores,
    suggestions: suggestions.length ? suggestions : ["looks balanced - double-check sources anyway"],
  };
};

const extractLinks = (text: string) => {
  const matches = text.match(/https?:\/\/[^\s)\]]+/gi) ?? [];
  return Array.from(new Set(matches));
};

const buildSummary = (analysis: Analysis) => {
  if (analysis.signals.length === 0) return "Paste a response to see a paragraph-level fact check.";
  const highs = analysis.signals.filter((s) => s.score >= 70).map((s) => s.label);
  const lows = analysis.signals.filter((s) => s.score <= 50).map((s) => s.label);
  const positive = highs.length ? `Strong signals: ${highs.join(", ")}.` : "Signals are mixed.";
  const caution = lows.length ? `Watch out for: ${lows.join(", ")}.` : "No major red flags detected.";
  return `${positive} ${caution}`;
};

const buildTitle = (text: string) => {
  const first = text.trim().split(/[.!?]+/)[0] ?? "";
  const compact = first.replace(/\s+/g, " ").trim();
  return compact.length > 72 ? `${compact.slice(0, 72)}...` : compact || "Untitled check";
};

const saveHistory = (text: string, score: number) => {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(HISTORY_KEY);
  let list: HistoryItem[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed as HistoryItem[];
    } catch {
      list = [];
    }
  }
  const item: HistoryItem = {
    id: `${Date.now()}`,
    title: buildTitle(text),
    score,
    createdAt: new Date().toLocaleString(),
  };
  const next = [item, ...list].slice(0, 6);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
};

export default function Page() {
  const title = "VeriGuard";
  const tagline = "Stop AI hallucinations before they shape your reality.";
  const [input, setInput] = useState("");
  const [analyzedText, setAnalyzedText] = useState("");

  const analysis = useMemo(() => analyzeText(analyzedText), [analyzedText]);
  const summary = useMemo(() => buildSummary(analysis), [analysis]);
  const links = useMemo(() => extractLinks(analyzedText), [analyzedText]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f8fb,_#eef2f7_50%,_#e7edf4_100%)] px-4 py-10 text-slate-900 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-6xl space-y-8"
      >
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white">VG</div>
            <div>
              <p className="text-lg font-semibold">{title}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">truth check</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Card className="border border-slate-200 bg-white/90 shadow-[0_10px_40px_-30px_rgba(15,23,42,0.3)]">
            <CardBody className="gap-4 p-6">
              <Chip variant="flat" className="w-fit font-mono uppercase tracking-[0.18em] text-emerald-700">
                document text
              </Chip>
              <Textarea
                label="paste ai output"
                placeholder=""
                minRows={16}
                value={input}
                onValueChange={setInput}
                variant="flat"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  color="success"
                  className="font-semibold"
                  onPress={() => {
                    if (!input.trim()) return;
                    setAnalyzedText(input);
                    const result = analyzeText(input);
                    saveHistory(input, result.score);
                  }}
                >
                  analyze
                </Button>
                <Chip variant="flat" className="font-mono uppercase tracking-[0.16em] text-emerald-700">
                  {tagline}
                </Chip>
              </div>
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card className="border border-slate-200 bg-white/90 shadow-[0_10px_40px_-30px_rgba(15,23,42,0.3)]">
              <CardBody className="gap-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">paragraph fact-check</p>
                    <p className="text-lg font-semibold text-slate-900">{analysis.verdict}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold text-slate-900">{analysis.score}%</p>
                    <Chip variant="flat" className="mt-1 font-mono uppercase tracking-[0.16em] text-emerald-700">
                      {analysis.verdict}
                    </Chip>
                  </div>
                </div>
                <Progress value={analysis.score} color="success" className="mt-2" />
              </CardBody>
            </Card>

            <Card className="border border-slate-200 bg-white/90 shadow-[0_10px_40px_-30px_rgba(15,23,42,0.3)]">
              <CardBody className="gap-4 p-6">
                <p className="text-sm font-semibold text-slate-900">Analysis</p>
                <p className="text-sm text-slate-600">{summary}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {analysis.signals.map((signal) => (
                    <div key={signal.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">{signal.label}</span>
                        <span className="font-mono text-emerald-700">{signal.score}</span>
                      </div>
                      <p className="text-slate-500">{signal.note}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="border border-slate-200 bg-white/90 shadow-[0_10px_40px_-30px_rgba(15,23,42,0.3)]">
              <CardBody className="gap-3 p-6">
                <p className="text-sm font-semibold text-slate-900">Sources</p>
                {links.length === 0 ? (
                  <p className="text-sm text-slate-600">No sources detected. Add links to strengthen verification.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-emerald-700">
                    {links.map((link) => (
                      <li key={link}>
                        <a href={link} className="underline decoration-emerald-400" target="_blank" rel="noreferrer">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </section>
      </motion.div>
    </main>
  );
}
