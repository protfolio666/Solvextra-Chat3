import { AIProvider } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AIProviderSelectorProps {
  currentProvider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  knowledgeBase: string;
  onKnowledgeBaseChange: (value: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  model?: string;
  onModelChange?: (value: string) => void;
  onSave: () => void;
  isSaving?: boolean;
}

export function AIProviderSelector({
  currentProvider,
  onProviderChange,
  knowledgeBase,
  onKnowledgeBaseChange,
  systemPrompt,
  onSystemPromptChange,
  model,
  onModelChange,
  onSave,
  isSaving,
}: AIProviderSelectorProps) {
  const providers = [
    { id: "openai" as AIProvider, name: "OpenAI", description: "GPT-5 and other models" },
    { id: "gemini" as AIProvider, name: "Gemini", description: "Google's AI models" },
    { id: "openrouter" as AIProvider, name: "OpenRouter", description: "Access multiple AI models" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>Select the AI service to power automated responses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className={`relative border rounded-lg p-4 cursor-pointer hover-elevate transition-all ${
                  currentProvider === provider.id ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => onProviderChange(provider.id)}
                data-testid={`option-provider-${provider.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{provider.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                  </div>
                  {currentProvider === provider.id && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {currentProvider === "openrouter" && (
        <Card>
          <CardHeader>
            <CardTitle>Model Selection</CardTitle>
            <CardDescription>Choose the AI model for OpenRouter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={model || "deepseek/deepseek-chat-v3-0324:free"} onValueChange={onModelChange}>
              <SelectTrigger data-testid="select-openrouter-model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Free Models (Recommended)</div>
                <SelectItem value="deepseek/deepseek-chat-v3-0324:free">
                  DeepSeek V3 (Free, Best for Coding)
                </SelectItem>
                <SelectItem value="google/gemini-2.0-flash-exp:free">
                  Gemini 2.0 Flash (Free)
                </SelectItem>
                <SelectItem value="meta-llama/llama-3.3-70b-instruct:free">
                  Llama 3.3 70B (Free)
                </SelectItem>
                <SelectItem value="qwen/qwen-2.5-72b-instruct:free">
                  Qwen 2.5 72B (Free)
                </SelectItem>
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Paid Models</div>
                <SelectItem value="anthropic/claude-3.5-sonnet">
                  Claude 3.5 Sonnet (Paid)
                </SelectItem>
                <SelectItem value="openai/gpt-4o">
                  GPT-4o (Paid)
                </SelectItem>
                <SelectItem value="openai/gpt-4o-mini">
                  GPT-4o Mini (Paid, Has Known Issues)
                </SelectItem>
              </SelectContent>
            </Select>
            
            <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-md">
              <p><strong>Free Tier Limits:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>50 requests/day (default)</li>
                <li>1,000 requests/day with $10 balance</li>
                <li>20 requests/minute rate limit</li>
              </ul>
              <p className="mt-2">
                <a 
                  href="https://openrouter.ai/settings/credits" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Manage credits →
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
          <CardDescription>Provide information for the AI to reference when responding</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={knowledgeBase}
            onChange={(e) => onKnowledgeBaseChange(e.target.value)}
            placeholder="Enter your company information, product details, FAQs, policies, etc..."
            className="min-h-[200px] font-serif"
            data-testid="input-knowledge-base"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>Define how the AI should behave and respond</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="You are a helpful customer support assistant. Be professional, friendly, and concise..."
            className="min-h-[120px]"
            data-testid="input-system-prompt"
          />
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={isSaving} className="w-full" data-testid="button-save-settings">
        {isSaving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
