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
  model?: string;
  knowledgeFiles?: Array<{ filename: string; uploadedAt: Date }>;
}

// OpenAI Provider
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (!openai) {
    throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment variables.");
  }
  return openai;
}

async function generateOpenAIResponse(
  message: string,
  config: AIProviderConfig
): Promise<string> {
  const client = getOpenAIClient();
  const systemMessage = config.systemPrompt || "You are a helpful customer support assistant.";
  
  let knowledgeContext = "";
  if (config.knowledgeBase) {
    knowledgeContext += `\n\nKnowledge Base Information:\n${config.knowledgeBase}`;
  }
  
  if (config.knowledgeFiles && config.knowledgeFiles.length > 0) {
    const filesList = config.knowledgeFiles
      .map(f => `- ${f.filename}`)
      .join('\n');
    knowledgeContext += `\n\nAvailable Knowledge Base Files:\n${filesList}\n\nNote: Reference these files when answering customer questions. The knowledge base text above contains key information extracted from these files.`;
  }

  const response = await client.chat.completions.create({
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
  
  let knowledgeContext = "";
  if (config.knowledgeBase) {
    knowledgeContext += `\n\nKnowledge Base Information:\n${config.knowledgeBase}`;
  }
  
  if (config.knowledgeFiles && config.knowledgeFiles.length > 0) {
    const filesList = config.knowledgeFiles
      .map(f => `- ${f.filename}`)
      .join('\n');
    knowledgeContext += `\n\nAvailable Knowledge Base Files:\n${filesList}\n\nNote: Reference these files when answering customer questions. The knowledge base text above contains key information extracted from these files.`;
  }

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: systemMessage + knowledgeContext,
    },
    contents: message,
  });

  return response.text || "I apologize, but I'm having trouble responding right now.";
}

// OpenRouter Provider with comprehensive error handling
async function generateOpenRouterResponse(
  message: string,
  config: AIProviderConfig
): Promise<string> {
  const systemMessage = config.systemPrompt || "You are a helpful customer support assistant.";
  
  let knowledgeContext = "";
  if (config.knowledgeBase) {
    knowledgeContext += `\n\nKnowledge Base Information:\n${config.knowledgeBase}`;
  }
  
  if (config.knowledgeFiles && config.knowledgeFiles.length > 0) {
    const filesList = config.knowledgeFiles
      .map(f => `- ${f.filename}`)
      .join('\n');
    knowledgeContext += `\n\nAvailable Knowledge Base Files:\n${filesList}\n\nNote: Reference these files when answering customer questions. The knowledge base text above contains key information extracted from these files.`;
  }

  // Default to DeepSeek V3 free model if no model specified (better than GPT-4o-mini issues)
  const model = config.model || "deepseek/deepseek-chat-v3-0324:free";

  console.log(`🤖 Calling OpenRouter API with model: ${model}...`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://solvextra.com", // Optional but recommended
        "X-Title": "Solvextra Support", // Optional but recommended
      },
      body: JSON.stringify({
        model: model,
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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

      const errorMessage = errorData?.error?.message || errorText;
      
      // Handle specific OpenRouter errors with helpful messages
      if (response.status === 402) {
        console.error(`❌ OpenRouter 402: Insufficient credits`);
        throw new Error(`OpenRouter needs credits. Free tier: 50 requests/day. Add $10 for 1,000/day at https://openrouter.ai/settings/credits`);
      } else if (response.status === 429) {
        console.error(`❌ OpenRouter 429: Rate limit exceeded`);
        throw new Error(`Rate limit exceeded (20 req/min). Please wait a moment or upgrade your OpenRouter account.`);
      } else if (response.status === 400) {
        console.error(`❌ OpenRouter 400: Bad request - ${errorMessage}`);
        // GPT-4o-mini has known function calling issues
        if (model.includes('gpt-4o-mini')) {
          throw new Error(`GPT-4o-mini has known issues. Try using DeepSeek V3 or Gemini 2.0 instead.`);
        }
        throw new Error(`OpenRouter API error: ${errorMessage}`);
      } else {
        console.error(`❌ OpenRouter API error (${response.status}):`, errorMessage);
        throw new Error(`OpenRouter error (${response.status}): ${errorMessage}`);
      }
    }

    const data = await response.json();
    console.log('✅ OpenRouter response received');
    return data.choices?.[0]?.message?.content || "I apologize, but I'm having trouble responding right now.";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ OpenRouter API timeout after 30s');
      throw new Error('OpenRouter API timeout - please try again');
    }
    console.error('❌ OpenRouter API error:', error);
    throw error;
  }
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
