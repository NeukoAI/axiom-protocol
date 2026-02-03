/**
 * SOLPRISM Protocol — Schema Helpers
 * 
 * Convenience functions for creating valid reasoning traces.
 */

import {
  ReasoningTrace,
  ActionType,
  DataSource,
  Alternative,
  SOLPRISM_SCHEMA_VERSION,
} from "./types";
import { validateTrace } from "./hash";

/** Input for creating a reasoning trace (all required fields, defaults applied) */
export interface CreateTraceInput {
  agent: string;
  action: {
    type: ActionType;
    description: string;
    transactionSignature?: string;
  };
  inputs: {
    dataSources: DataSource[];
    context: string;
  };
  analysis: {
    observations: string[];
    logic: string;
    alternativesConsidered: Alternative[];
  };
  decision: {
    actionChosen: string;
    confidence: number;
    riskAssessment: string;
    expectedOutcome: string;
  };
  metadata?: {
    model?: string;
    sessionId?: string;
    executionTimeMs?: number;
    custom?: Record<string, string | number | boolean>;
  };
  /** Override timestamp (defaults to Date.now()) */
  timestamp?: number;
}

/**
 * Create a valid reasoning trace with defaults applied.
 * 
 * @param input - Partial trace data
 * @returns A complete, validated ReasoningTrace
 * @throws Error if the resulting trace fails validation
 */
export function createReasoningTrace(input: CreateTraceInput): ReasoningTrace {
  const trace: ReasoningTrace = {
    version: SOLPRISM_SCHEMA_VERSION,
    agent: input.agent,
    timestamp: input.timestamp ?? Date.now(),
    action: {
      type: input.action.type,
      description: input.action.description,
      ...(input.action.transactionSignature && {
        transactionSignature: input.action.transactionSignature,
      }),
    },
    inputs: {
      dataSources: input.inputs.dataSources,
      context: input.inputs.context,
    },
    analysis: {
      observations: input.analysis.observations,
      logic: input.analysis.logic,
      alternativesConsidered: input.analysis.alternativesConsidered,
    },
    decision: {
      actionChosen: input.decision.actionChosen,
      confidence: Math.round(Math.min(100, Math.max(0, input.decision.confidence))),
      riskAssessment: input.decision.riskAssessment,
      expectedOutcome: input.decision.expectedOutcome,
    },
    ...(input.metadata && { metadata: input.metadata }),
  };

  // Validate before returning
  const errors = validateTrace(trace);
  if (errors.length > 0) {
    throw new Error(`Invalid reasoning trace: ${errors.join("; ")}`);
  }

  return trace;
}

/**
 * Create a minimal reasoning trace for simple decisions.
 * Convenience wrapper when you don't need all fields.
 */
export function createSimpleTrace(
  agent: string,
  actionDescription: string,
  reasoning: string,
  confidence: number,
  actionType: ActionType = "decision"
): ReasoningTrace {
  return createReasoningTrace({
    agent,
    action: { type: actionType, description: actionDescription },
    inputs: {
      dataSources: [],
      context: "Direct decision",
    },
    analysis: {
      observations: [],
      logic: reasoning,
      alternativesConsidered: [],
    },
    decision: {
      actionChosen: actionDescription,
      confidence,
      riskAssessment: confidence >= 80 ? "low" : confidence >= 50 ? "moderate" : "high",
      expectedOutcome: actionDescription,
    },
  });
}
