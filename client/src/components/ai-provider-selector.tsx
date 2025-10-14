import { AIProvider } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface AIProviderSelectorProps {
  currentProvider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  knowledgeBase: string;
  onKnowledgeBaseChange: (value: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
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
