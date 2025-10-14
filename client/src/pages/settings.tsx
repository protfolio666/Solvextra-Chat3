import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AISettings, AIProvider } from "@shared/schema";
import { AIProviderSelector } from "@/components/ai-provider-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  
  const { data: aiSettings } = useQuery<AISettings>({
    queryKey: ["/api/settings/ai"],
  });

  const [provider, setProvider] = useState<AIProvider>("openai");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (aiSettings) {
      setProvider(aiSettings.provider);
      setKnowledgeBase(aiSettings.knowledgeBase || "");
      setSystemPrompt(aiSettings.systemPrompt || "You are a helpful customer support assistant. Be professional, friendly, and concise.");
    }
  }, [aiSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/ai", {
        provider,
        enabled: true,
        knowledgeBase,
        systemPrompt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai"] });
      toast({
        title: "Settings Saved",
        description: "AI configuration has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="h-full overflow-auto">
      <div className="border-b border-border p-6 bg-background">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your platform settings
        </p>
      </div>

      <div className="p-6">
        <Tabs defaultValue="ai" className="space-y-6">
          <TabsList>
            <TabsTrigger value="ai">AI Configuration</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-6">
            <AIProviderSelector
              currentProvider={provider}
              onProviderChange={setProvider}
              knowledgeBase={knowledgeBase}
              onKnowledgeBaseChange={setKnowledgeBase}
              systemPrompt={systemPrompt}
              onSystemPromptChange={setSystemPrompt}
              onSave={() => saveSettingsMutation.mutate()}
              isSaving={saveSettingsMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Settings</CardTitle>
                <CardDescription>Configure general platform behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-assign conversations</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically assign new conversations to available agents
                    </p>
                  </div>
                  <Switch data-testid="switch-auto-assign" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>AI First Response</Label>
                    <p className="text-sm text-muted-foreground">
                      Let AI handle initial customer messages
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-ai-first" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tat">Default TAT (Turn Around Time)</Label>
                  <Input
                    id="tat"
                    type="number"
                    placeholder="60"
                    defaultValue="60"
                    data-testid="input-default-tat"
                  />
                  <p className="text-sm text-muted-foreground">In minutes</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>New conversation alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when a new conversation starts
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Escalation alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when AI escalates to human agent
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Ticket creation alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when a new ticket is created
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
