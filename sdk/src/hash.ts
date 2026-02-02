/**
 * AXIOM Protocol — Hashing Utilities
 * 
 * Deterministic hashing of reasoning traces for on-chain commitment.
 * Uses canonical JSON serialization to ensure identical traces
 * always produce identical hashes.
 */

import { createHash } from "crypto";
import { ReasoningTrace, AXIOM_SCHEMA_VERSION } from "./types";

/**
 * Canonicalize a reasoning trace for deterministic hashing.
 * 
 * Keys are sorted alphabetically at every level. This ensures
 * that the same reasoning always produces the same hash,
 * regardless of property insertion order.
 */
export function canonicalize(trace: ReasoningTrace): string {
  return JSON.stringify(trace, Object.keys(trace).sort(), 0);
}

/**
 * Deep-sort all keys in an object for canonical serialization.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

/**
 * Compute the SHA-256 hash of a reasoning trace.
 * 
 * This is the core operation of AXIOM. The hash is committed on-chain
 * before the action is executed, and later verified against the
 * revealed full reasoning.
 * 
 * @param trace - The reasoning trace to hash
 * @returns 32-byte SHA-256 hash as Uint8Array
 */
export function hashTrace(trace: ReasoningTrace): Uint8Array {
  const canonical = JSON.stringify(sortKeys(trace));
  const hash = createHash("sha256").update(canonical, "utf-8").digest();
  return new Uint8Array(hash);
}

/**
 * Compute the SHA-256 hash and return as hex string.
 * 
 * @param trace - The reasoning trace to hash
 * @returns 64-character hex string
 */
export function hashTraceHex(trace: ReasoningTrace): string {
  const bytes = hashTrace(trace);
  return Buffer.from(bytes).toString("hex");
}

/**
 * Verify that a reasoning trace matches a commitment hash.
 * 
 * @param trace - The revealed reasoning trace
 * @param commitmentHash - The hash stored on-chain (32 bytes or hex string)
 * @returns true if the trace matches the commitment
 */
export function verifyHash(
  trace: ReasoningTrace,
  commitmentHash: Uint8Array | string
): boolean {
  const computed = hashTrace(trace);
  
  const expected = typeof commitmentHash === "string"
    ? Uint8Array.from(Buffer.from(commitmentHash, "hex"))
    : commitmentHash;
  
  if (computed.length !== expected.length) return false;
  
  // Constant-time comparison to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed[i] ^ expected[i];
  }
  return diff === 0;
}

/**
 * Validate that a reasoning trace conforms to the AXIOM schema.
 * 
 * @param trace - Object to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateTrace(trace: unknown): string[] {
  const errors: string[] = [];
  
  if (!trace || typeof trace !== "object") {
    return ["Trace must be a non-null object"];
  }
  
  const t = trace as Record<string, unknown>;
  
  // Version
  if (t.version !== AXIOM_SCHEMA_VERSION) {
    errors.push(`Invalid version: expected "${AXIOM_SCHEMA_VERSION}", got "${t.version}"`);
  }
  
  // Agent
  if (!t.agent || typeof t.agent !== "string") {
    errors.push("agent must be a non-empty string");
  }
  
  // Timestamp
  if (!t.timestamp || typeof t.timestamp !== "number") {
    errors.push("timestamp must be a number");
  }
  
  // Action
  if (!t.action || typeof t.action !== "object") {
    errors.push("action must be an object");
  } else {
    const action = t.action as Record<string, unknown>;
    if (!action.type || typeof action.type !== "string") {
      errors.push("action.type must be a string");
    }
    if (!action.description || typeof action.description !== "string") {
      errors.push("action.description must be a string");
    }
  }
  
  // Inputs
  if (!t.inputs || typeof t.inputs !== "object") {
    errors.push("inputs must be an object");
  } else {
    const inputs = t.inputs as Record<string, unknown>;
    if (!Array.isArray(inputs.dataSources)) {
      errors.push("inputs.dataSources must be an array");
    }
    if (!inputs.context || typeof inputs.context !== "string") {
      errors.push("inputs.context must be a string");
    }
  }
  
  // Analysis
  if (!t.analysis || typeof t.analysis !== "object") {
    errors.push("analysis must be an object");
  } else {
    const analysis = t.analysis as Record<string, unknown>;
    if (!Array.isArray(analysis.observations)) {
      errors.push("analysis.observations must be an array");
    }
    if (!analysis.logic || typeof analysis.logic !== "string") {
      errors.push("analysis.logic must be a string");
    }
    if (!Array.isArray(analysis.alternativesConsidered)) {
      errors.push("analysis.alternativesConsidered must be an array");
    }
  }
  
  // Decision
  if (!t.decision || typeof t.decision !== "object") {
    errors.push("decision must be an object");
  } else {
    const decision = t.decision as Record<string, unknown>;
    if (typeof decision.confidence !== "number" || decision.confidence < 0 || decision.confidence > 100) {
      errors.push("decision.confidence must be a number between 0 and 100");
    }
    if (!decision.actionChosen || typeof decision.actionChosen !== "string") {
      errors.push("decision.actionChosen must be a string");
    }
  }
  
  return errors;
}
