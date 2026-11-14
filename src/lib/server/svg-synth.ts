import type { AspectRatio } from "@/lib/types";

const DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "16:9": { w: 1344, h: 756 },
  "9:16": { w: 756, h: 1344 },
  "4:3": { w: 1024, h: 768 },
  "3:2": { w: 1200, h: 800 },
};

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > perLine) {
      if (current) lines.push(current.trim());
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current && lines.length < maxLines) lines.push(current.trim());
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length + 3) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:]$/, "")}…`;
  }
  return lines;
}

/**
 * Deterministic generative SVG synthesizer.
 * Produces a bespoke obsidian/cyan "cyber-editorial" poster from the prompt hash —
 * used when the inference engine has no image endpoint configured.
 */
export function synthesizeImage(prompt: string, aspect: AspectRatio): string {
  const { w, h } = DIMENSIONS[aspect];
  const seed = hash(prompt);
  const rand = (n: number) => ((seed * (n + 7) * 9301 + 49297) % 233280) / 233280;
  const palettes = [
    ["#22d3ee", "#6366f1", "#a855f7"],
    ["#38bdf8", "#818cf8", "#f472b6"],
    ["#2dd4bf", "#22d3ee", "#7c3aed"],
    ["#a855f7", "#22d3ee", "#f59e0b"],
  ];
  const palette = palettes[seed % palettes.length];
  const cx = w * (0.3 + rand(1) * 0.4);
  const cy = h * (0.25 + rand(2) * 0.35);
  const rings = 16;

  const orbit = Array.from({ length: rings }, (_, i) => {
    const r = (Math.min(w, h) / 2.4) * (i / rings) + 18;
    const dash = `${(seed % 9) + 3} ${(seed % 13) + 8}`;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(
      1,
    )}" fill="none" stroke="url(#stroke)" stroke-width="${(1.6 - i * 0.07).toFixed(
      2,
    )}" stroke-dasharray="${dash}" opacity="${(0.55 - i * 0.028).toFixed(3)}" />`;
  }).join("\n    ");

  const nodes = Array.from({ length: 26 }, (_, i) => {
    const angle = rand(i + 3) * Math.PI * 2;
    const radius = rand(i + 11) * Math.min(w, h) * 0.42;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.85;
    const size = 1.2 + rand(i + 5) * 2.6;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(
      2,
    )}" fill="${palette[i % palette.length]}" opacity="${(0.35 + rand(i + 9) * 0.5).toFixed(2)}" />`;
  }).join("\n    ");

  const links = Array.from({ length: 12 }, (_, i) => {
    const a1 = rand(i + 21) * Math.PI * 2;
    const a2 = a1 + 0.5 + rand(i + 33) * 1.6;
    const r1 = rand(i + 41) * Math.min(w, h) * 0.3;
    const r2 = r1 + 40 + rand(i + 51) * 160;
    const x1 = cx + Math.cos(a1) * r1;
    const y1 = cy + Math.sin(a1) * r1 * 0.85;
    const x2 = cx + Math.cos(a2) * r2;
    const y2 = cy + Math.sin(a2) * r2 * 0.85;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(
      1,
    )}" y2="${y2.toFixed(1)}" stroke="${palette[i % palette.length]}" stroke-width="0.8" opacity="${(
      0.1 +
      rand(i + 61) * 0.25
    ).toFixed(2)}" />`;
  }).join("\n    ");

  const lines = wrap(prompt, aspect === "9:16" ? 24 : 46, 4);
  const fontSize = aspect === "9:16" ? 40 : aspect === "1:1" ? 38 : 34;
  const titleY = h - 120 - (lines.length - 1) * (fontSize + 10);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(
    prompt.slice(0, 120),
  )}">
  <defs>
    <radialGradient id="bg" cx="${(cx / w).toFixed(2)}" cy="${(cy / h).toFixed(2)}" r="0.92">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="55%" stop-color="#0a0c12" />
      <stop offset="100%" stop-color="#05060a" />
    </radialGradient>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette[0]}" />
      <stop offset="50%" stop-color="${palette[1]}" />
      <stop offset="100%" stop-color="${palette[2]}" />
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${palette[0]}" stop-opacity="0.55" />
      <stop offset="60%" stop-color="${palette[1]}" stop-opacity="0.14" />
      <stop offset="100%" stop-color="${palette[2]}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%" stop-color="#05060a" stop-opacity="0" />
      <stop offset="100%" stop-color="#05060a" stop-opacity="0.94" />
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="42" /></filter>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#94a3b8" stroke-opacity="0.06" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" />
  <rect width="${w}" height="${h}" fill="url(#grid)" />
  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(Math.min(w, h) * 0.34).toFixed(
    1,
  )}" fill="url(#halo)" filter="url(#blur)" />
  <g>
    ${orbit}
  </g>
  <g>
    ${links}
    ${nodes}
  </g>
  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="#f0fdff" />
  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="16" fill="none" stroke="${palette[0]}" stroke-width="1.4" opacity="0.8" />
  <rect width="${w}" height="${h}" fill="url(#fade)" />
  <g font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif">
    <text x="56" y="72" fill="${palette[0]}" font-size="15" letter-spacing="5" opacity="0.9">PROMPTGURU · SYNTHESIS</text>
    <text x="56" y="${titleY}" fill="#f8fafc" font-size="${fontSize}" font-weight="600" letter-spacing="-0.5">
      ${lines.map((line, i) => `<tspan x="56" dy="${i === 0 ? 0 : fontSize + 10}">${escapeXml(line)}</tspan>`).join("")}
    </text>
    <text x="56" y="${h - 58}" fill="#94a3b8" font-size="15">
      ${aspect} · seed ${seed.toString(16).slice(0, 6)} · local render
    </text>
  </g>
</svg>`;
}
