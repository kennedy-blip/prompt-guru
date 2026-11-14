"use client";

import Papa from "papaparse";
import type { ParsedAttachment } from "@/lib/types";
import { estimateTokens, uid } from "@/lib/utils";

const MAX_ROWS = 120;
const MAX_PREVIEW = 8;

function inferType(values: (string | number | boolean | null | undefined)[]): string {
  const sample = values.filter((v) => v !== null && v !== undefined && v !== "").slice(0, 60);
  if (!sample.length) return "unknown";
  if (sample.every((v) => /^-?\d+(\.\d+)?$/.test(String(v)))) {
    return sample.some((v) => String(v).includes(".")) ? "float" : "integer";
  }
  if (sample.every((v) => /^(true|false)$/i.test(String(v)))) return "boolean";
  if (sample.every((v) => !Number.isNaN(Date.parse(String(v)))) && sample.some((v) => /[-/]/.test(String(v))))
    return "date";
  if (sample.every((v) => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(String(v)))) return "uuid";
  return "string";
}

export function parseCsv(file: File): Promise<ParsedAttachment> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      complete: (result) => {
        const rows = result.data ?? [];
        const columns = (result.meta.fields ?? []).filter(Boolean);
        const types: Record<string, string> = {};
        for (const column of columns) {
          types[column] = inferType(rows.map((row) => row[column]));
        }
        const sampleRows = rows.slice(0, MAX_PREVIEW);
        const header = columns.join(",");
        const body = rows
          .slice(0, MAX_ROWS)
          .map((row) => columns.map((c) => JSON.stringify(row[c] ?? "")).join(","))
          .join("\n");
        const text = `CSV file: ${file.name}\nColumns (${columns.length}): ${header}\nRows: ${rows.length}\n\n${header}\n${body}`;
        resolve({
          id: uid("csv"),
          name: file.name,
          kind: "csv",
          size: file.size,
          text,
          enabled: true,
          meta: {
            rows: rows.length,
            columns,
            columnTypes: types,
            sampleRows,
            truncated: rows.length > MAX_ROWS,
            tokenEstimate: estimateTokens(text),
            bytes: file.size,
          },
        });
      },
      error: (error: Error) => reject(error),
    });
  });
}

export function parseJson(file: File): Promise<ParsedAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? "");
        const parsed = JSON.parse(raw) as unknown;
        const { rows, columns, sampleRows } = analyseJson(parsed);
        const preview = JSON.stringify(parsed, null, 2);
        const clipped = preview.length > 60_000 ? `${preview.slice(0, 60_000)}\n… (truncated)` : preview;
        const text = `JSON file: ${file.name}\nShape: ${
          Array.isArray(parsed) ? `array of ${rows} items` : "object"
        }\nKeys: ${columns.join(", ") || "n/a"}\n\n${clipped}`;
        resolve({
          id: uid("json"),
          name: file.name,
          kind: "json",
          size: file.size,
          text,
          enabled: true,
          meta: {
            rows,
            columns,
            sampleRows,
            truncated: preview.length > 60_000,
            tokenEstimate: estimateTokens(text),
            bytes: file.size,
          },
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Invalid JSON"));
      }
    };
    reader.readAsText(file);
  });
}

function analyseJson(parsed: unknown): {
  rows: number;
  columns: string[];
  sampleRows: Record<string, string>[];
} {
  if (Array.isArray(parsed)) {
    const objectRows = parsed.filter(
      (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
    );
    const columns = Array.from(new Set(objectRows.flatMap((row) => Object.keys(row)))).slice(0, 40);
    return {
      rows: parsed.length,
      columns,
      sampleRows: objectRows.slice(0, MAX_PREVIEW).map((row) => flattenRow(row, columns)),
    };
  }
  if (parsed && typeof parsed === "object") {
    const entries = Object.entries(parsed as Record<string, unknown>);
    const nestedArray = entries.find(([, value]) => Array.isArray(value));
    if (nestedArray && Array.isArray(nestedArray[1])) {
      const arr = nestedArray[1] as unknown[];
      const objectRows = arr.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      );
      const columns = Array.from(new Set(objectRows.flatMap((row) => Object.keys(row)))).slice(0, 40);
      return {
        rows: arr.length,
        columns: columns.length ? columns : [nestedArray[0]],
        sampleRows: objectRows.slice(0, MAX_PREVIEW).map((row) => flattenRow(row, columns)),
      };
    }
    return {
      rows: 1,
      columns: entries.map(([key]) => key).slice(0, 40),
      sampleRows: [flattenRow(parsed as Record<string, unknown>, entries.map(([key]) => key))],
    };
  }
  return { rows: 1, columns: ["value"], sampleRows: [{ value: String(parsed) }] };
}

function flattenRow(row: Record<string, unknown>, columns: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const column of columns) {
    const value = row[column];
    out[column] =
      value === undefined || value === null
        ? ""
        : typeof value === "object"
          ? Array.isArray(value)
            ? `[${value.length} items]`
            : "{…}"
          : String(value).slice(0, 120);
  }
  return out;
}
