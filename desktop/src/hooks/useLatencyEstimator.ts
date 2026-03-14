import { useMemo } from "react";

export interface StepEstimate {
  min: number;
  max: number;
  skipped: boolean;
  label: string;
}

export interface LatencyEstimate {
  steps: {
    analyzer: StepEstimate;
    rewriting: StepEstimate;
    retrieval: StepEstimate;
    reranking: StepEstimate;
    generation: StepEstimate;
  };
  total: { min: number; max: number };
  provider: string;
  model: string;
}

export interface LatencyEstimatorInput {
  provider: string;
  model: string;
  maxTokens: number;
  contextMaxTokens: number;
  contextMaxChunks: number;
  alwaysRetrieve: boolean;
  queryRewritingEnabled: boolean;
  numRewrites: number;
  rerankEnabled: boolean;
  rerankCandidates: number;
  semanticTopK: number;
  prefetchMultiplier: number;
}

const SKIP: StepEstimate = { min: 0, max: 0, skipped: true, label: "" };

function isLocalProvider(provider: string): boolean {
  return provider === "ollama";
}

export function useLatencyEstimator(input: LatencyEstimatorInput): LatencyEstimate {
  return useMemo(() => {
    const local = isLocalProvider(input.provider);

    // Base latency per simple LLM call (classification/rewriting, ~200 tokens output)
    const llmCallMin = local ? 5 : 0.5;
    const llmCallMax = local ? 15 : 2;

    // Analyzer
    const analyzer: StepEstimate = input.alwaysRetrieve
      ? { ...SKIP, label: "Analyzer" }
      : { min: llmCallMin, max: llmCallMax, skipped: false, label: "Analyzer" };

    // Rewriting
    const rewrites = Math.max(input.numRewrites, 1);
    const rewriting: StepEstimate =
      !input.queryRewritingEnabled || input.alwaysRetrieve
        ? { ...SKIP, label: "Rewriting" }
        : {
            min: llmCallMin * rewrites,
            max: llmCallMax * rewrites,
            skipped: false,
            label: "Rewriting",
          };

    // Retrieval (relatively stable)
    const retrievalBase = local ? 1 : 0.5;
    const topKFactor = 1 + (input.semanticTopK * input.prefetchMultiplier) / 100;
    const retrieval: StepEstimate = {
      min: Math.round(retrievalBase * topKFactor * 10) / 10,
      max: Math.round(retrievalBase * topKFactor * 3 * 10) / 10,
      skipped: false,
      label: "Retrieval",
    };

    // Reranking
    const reranking: StepEstimate = !input.rerankEnabled
      ? { ...SKIP, label: "Reranking" }
      : {
          min: 0.1,
          max: Math.min(2, 0.1 + input.rerankCandidates * 0.03),
          skipped: false,
          label: "Reranking",
        };

    // Generation (main bottleneck)
    const tokenFactor = input.maxTokens / 500;
    const contextFactor = 1 + input.contextMaxTokens / (local ? 8000 : 16000);
    const chunkFactor = 1 + input.contextMaxChunks / 20;
    const genMin = llmCallMin * tokenFactor * contextFactor * chunkFactor;
    const genMax = llmCallMax * tokenFactor * contextFactor * chunkFactor;
    const generation: StepEstimate = {
      min: Math.round(genMin * 10) / 10,
      max: Math.round(genMax * 10) / 10,
      skipped: false,
      label: "LLM",
    };

    // Total
    const steps = { analyzer, rewriting, retrieval, reranking, generation };
    const allSteps = Object.values(steps);
    const totalMin = allSteps.reduce((sum, s) => sum + (s.skipped ? 0 : s.min), 0);
    const totalMax = allSteps.reduce((sum, s) => sum + (s.skipped ? 0 : s.max), 0);

    return {
      steps,
      total: { min: Math.round(totalMin), max: Math.round(totalMax) },
      provider: input.provider,
      model: input.model,
    };
  }, [
    input.provider,
    input.model,
    input.maxTokens,
    input.contextMaxTokens,
    input.contextMaxChunks,
    input.alwaysRetrieve,
    input.queryRewritingEnabled,
    input.numRewrites,
    input.rerankEnabled,
    input.rerankCandidates,
    input.semanticTopK,
    input.prefetchMultiplier,
  ]);
}
