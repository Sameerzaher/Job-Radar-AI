import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

export function getOpenAIClient(): OpenAI {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

export function isOpenAIAvailable(): boolean {
  return Boolean(apiKey && apiKey.length > 0);
}
