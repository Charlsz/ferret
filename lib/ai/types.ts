/**
 * lib/ai/types.ts
 *
 * Unified interface for our local AI layer based on WebLLM.
 */

export interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ExplainerContext {
  fileContent: string;
  fileName: string;
  fileExtension: string;
  userPrompt?: string; // In case the user asks for specific aspects to be explained
}
