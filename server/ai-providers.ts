import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { AIProvider } from "@shared/schema";

interface AIResponse {
  content: string;
  provider: AIProvider;
}

interface AIProviderConfig {
  provider: AIProvider;
  knowledgeBase?: string;
  systemPrompt?: string;
}

// OpenAI Provider
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateOpenAIResponse(
  message: string,
  config: AIProviderConfig
): Promise<string> {
  const systemMessage = config.systemPrompt || "You are a helpful customer support assistant.";
  const knowledgeContext = config.knowledgeBase
    ? `\n\nKnowledge Base:\n${config.knowledgeBase}`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage + knowledgeContext,
      },
      {
        role: "user",
        content: message,
      },
    ],
    max_completion_tokens: 500,
  });

  return response.choices[0].message.content || "I apologize, but I'm having trouble responding right now.";
}

// Gemini Provider
// Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function generateGeminiResponse(
  message: string,
  config: AIProviderConfig
): Promise<string> {
  const systemMessage = config.systemPrompt || "You are a helpful customer support assistant.";
  const knowledgeContext = config.knowledgeBase
    ? `\n\nKnowledge Base:\n${config.knowledgeBase}`
    : "";

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: systemMessage + knowledgeContext,
    },
    contents: message,
  });

  return response.text || "I apologize, but I'm having trouble responding right now.";
}

// OpenRouter Provider
async function generateOpenRouterResponse(
  message: string,
  config: AIProviderConfig
): Promise<string> {
  const systemMessage = config.systemPrompt || "You are a helpful customer support assistant.";
  const knowledgeContext = config.knowledgeBase
    ? `\n\nKnowledge Base:\n${config.knowledgeBase}`
    : "";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        {
          role: "system",
          content: systemMessage + knowledgeContext,
        },
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "I apologize, but I'm having trouble responding right now.";
}

// Main AI Provider Interface
export async function generateAIResponse(
  message: string,
  config: AIProviderConfig
): Promise<AIResponse> {
  try {
    let content: string;

    switch (config.provider) {
      case "openai":
        content = await generateOpenAIResponse(message, config);
        break;
      case "gemini":
        content = await generateGeminiResponse(message, config);
        break;
      case "openrouter":
        content = await generateOpenRouterResponse(message, config);
        break;
      default:
        content = "I apologize, but the AI provider is not configured properly.";
    }

    return {
      content,
      provider: config.provider,
    };
  } catch (error) {
    console.error("AI Provider Error:", error);
    return {
      content: "I apologize, but I'm experiencing technical difficulties. A human agent will assist you shortly.",
      provider: config.provider,
    };
  }
}
