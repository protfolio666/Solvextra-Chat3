import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AISettings, AIProvider, ChannelIntegration, Channel, EmailSettings } from "@shared/schema";
import { AIProviderSelector } from "@/components/ai-provider-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SiTelegram, SiWhatsapp, SiInstagram } from "react-icons/si";

export default function Settings() {
  const { toast } = useToast();
  
  const { data: aiSettings } = useQuery<AISettings>({
    queryKey: ["/api/settings/ai"],
  });

  const { data: channelIntegrations = [] } = useQuery<ChannelIntegration[]>({
    queryKey: ["/api/settings/channels"],
  });

  const { data: emailSettings } = useQuery<EmailSettings>({
    queryKey: ["/api/settings/email"],
  });

  const [provider, setProvider] = useState<AIProvider>("openai");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [model, setModel] = useState<string>("deepseek/deepseek-chat-v3-0324:free");

  // Channel integration states
  const [telegramToken, setTelegramToken] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");
  // Instagram uses Meta app credentials
  const [instagramAppId, setInstagramAppId] = useState("");
  const [instagramAppSecret, setInstagramAppSecret] = useState("");
  // Twitter uses OAuth2 credentials
  const [twitterClientId, setTwitterClientId] = useState("");
  const [twitterClientSecret, setTwitterClientSecret] = useState("");

  // Email settings (SendGrid)
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("Solvextra Support");
  const [emailEnabled, setEmailEnabled] = useState(false);

  useEffect(() => {
    if (aiSettings) {
      setProvider(aiSettings.provider);
      setKnowledgeBase(aiSettings.knowledgeBase || "");
      setSystemPrompt(aiSettings.systemPrompt || "You are a helpful customer support assistant. Be professional, friendly, and concise.");
      setIsPaused(aiSettings.paused || false);
      setModel(aiSettings.model || "deepseek/deepseek-chat-v3-0324:free");
    }
  }, [aiSettings]);

  useEffect(() => {
    if (channelIntegrations.length > 0) {
      const telegram = channelIntegrations.find(c => c.channel === "telegram");
      const whatsapp = channelIntegrations.find(c => c.channel === "whatsapp");
      const instagram = channelIntegrations.find(c => c.channel === "instagram");
      const twitter = channelIntegrations.find(c => c.channel === "twitter");
      
      if (telegram?.apiToken) setTelegramToken(telegram.apiToken);
      if (whatsapp?.apiToken) setWhatsappToken(whatsapp.apiToken);
      if (instagram?.appId) setInstagramAppId(instagram.appId);
      if (instagram?.appSecret) setInstagramAppSecret(instagram.appSecret);
      if (twitter?.clientId) setTwitterClientId(twitter.clientId);
      if (twitter?.clientSecret) setTwitterClientSecret(twitter.clientSecret);
    }
  }, [channelIntegrations]);

  useEffect(() => {
    if (emailSettings) {
      setSendgridApiKey(emailSettings.sendgridApiKey || "");
      setSenderEmail(emailSettings.senderEmail || "");
      setSenderName(emailSettings.senderName || "Solvextra Support");
      setEmailEnabled(emailSettings.enabled || false);
    }
  }, [emailSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/ai", {
        provider,
        enabled: true,
        paused: isPaused,
        model,
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

  const saveChannelMutation = useMutation({
    mutationFn: async (data: { channel: Channel; apiToken?: string; appId?: string; appSecret?: string; clientId?: string; clientSecret?: string; enabled: boolean }) => {
      return apiRequest("POST", "/api/settings/channels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/channels"] });
      toast({
        title: "Channel Connected",
        description: "Channel integration configured successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save channel configuration",
        variant: "destructive",
      });
    },
  });

  const handleSaveChannel = (channel: Channel, credentials: { apiToken?: string; appId?: string; appSecret?: string; clientId?: string; clientSecret?: string }) => {
    // Validate based on channel type
    if (channel === "telegram" || channel === "whatsapp") {
      if (!credentials.apiToken?.trim()) {
        toast({
          title: "Error",
          description: "Please enter an API token",
          variant: "destructive",
        });
        return;
      }
    } else if (channel === "instagram") {
      if (!credentials.appId?.trim() || !credentials.appSecret?.trim()) {
        toast({
          title: "Error",
          description: "Please enter both App ID and App Secret",
          variant: "destructive",
        });
        return;
      }
    } else if (channel === "twitter") {
      if (!credentials.clientId?.trim() || !credentials.clientSecret?.trim()) {
        toast({
          title: "Error",
          description: "Please enter both Client ID and Client Secret",
          variant: "destructive",
        });
        return;
      }
    }
    
    saveChannelMutation.mutate({
      channel,
      ...credentials,
      enabled: true,
    });
  };

  const saveEmailSettingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/email", {
        sendgridApiKey,
        senderEmail,
        senderName,
        enabled: emailEnabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email"] });
      toast({
        title: "Email Settings Saved",
        description: "SendGrid configuration has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save email settings",
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
            <TabsTrigger value="channels">Channel Integrations</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>AI Status</CardTitle>
                    <CardDescription>
                      {isPaused 
                        ? "AI is paused. New messages go directly to available agents or admin." 
                        : "AI is active and responding to customer messages."}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setIsPaused(!isPaused);
                      setTimeout(() => saveSettingsMutation.mutate(), 100);
                    }}
                    variant={isPaused ? "default" : "outline"}
                    data-testid="button-toggle-ai-pause"
                  >
                    {isPaused ? "Resume AI" : "Pause AI"}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <AIProviderSelector
              currentProvider={provider}
              onProviderChange={setProvider}
              knowledgeBase={knowledgeBase}
              onKnowledgeBaseChange={setKnowledgeBase}
              systemPrompt={systemPrompt}
              onSystemPromptChange={setSystemPrompt}
              model={model}
              onModelChange={setModel}
              onSave={() => saveSettingsMutation.mutate()}
              isSaving={saveSettingsMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="channels" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-md">
                    <SiTelegram className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Telegram Bot</CardTitle>
                    <CardDescription>Connect your Telegram bot to receive messages</CardDescription>
                  </div>
                  {channelIntegrations.find(c => c.channel === "telegram")?.enabled && (
                    <Badge className="bg-success text-success-foreground">Connected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="telegram-token">Bot Token</Label>
                  <Input
                    id="telegram-token"
                    type="text"
                    placeholder="123456789:ABCdefGhIjKlmNoPQRsTUVwxyZ"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    data-testid="input-telegram-token"
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your bot token from @BotFather on Telegram
                  </p>
                </div>
                <Button
                  onClick={() => handleSaveChannel("telegram", { apiToken: telegramToken })}
                  disabled={saveChannelMutation.isPending}
                  data-testid="button-save-telegram"
                >
                  {saveChannelMutation.isPending ? "Connecting..." : "Connect Telegram"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-md">
                    <SiWhatsapp className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>WhatsApp Business</CardTitle>
                    <CardDescription>Connect your WhatsApp Business API</CardDescription>
                  </div>
                  {channelIntegrations.find(c => c.channel === "whatsapp")?.enabled && (
                    <Badge className="bg-success text-success-foreground">Connected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-token">API Token</Label>
                  <Input
                    id="whatsapp-token"
                    type="text"
                    placeholder="Your WhatsApp Business API token"
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                    data-testid="input-whatsapp-token"
                  />
                </div>
                <Button
                  onClick={() => handleSaveChannel("whatsapp", { apiToken: whatsappToken })}
                  disabled={saveChannelMutation.isPending}
                  data-testid="button-save-whatsapp"
                >
                  {saveChannelMutation.isPending ? "Connecting..." : "Connect WhatsApp"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-500/10 rounded-md">
                    <SiInstagram className="w-6 h-6 text-pink-500" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Instagram</CardTitle>
                    <CardDescription>Connect Instagram Direct Messages</CardDescription>
                  </div>
                  {channelIntegrations.find(c => c.channel === "instagram")?.enabled && (
                    <Badge className="bg-success text-success-foreground">Connected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram-app-id">Meta App ID</Label>
                  <Input
                    id="instagram-app-id"
                    type="text"
                    placeholder="Your Meta App ID"
                    value={instagramAppId}
                    onChange={(e) => setInstagramAppId(e.target.value)}
                    data-testid="input-instagram-app-id"
                  />
                  <p className="text-sm text-muted-foreground">
                    Create an app at developers.facebook.com and add Instagram product
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram-app-secret">Meta App Secret</Label>
                  <Input
                    id="instagram-app-secret"
                    type="password"
                    placeholder="Your Meta App Secret"
                    value={instagramAppSecret}
                    onChange={(e) => setInstagramAppSecret(e.target.value)}
                    data-testid="input-instagram-app-secret"
                  />
                </div>
                <Button
                  onClick={() => handleSaveChannel("instagram", { appId: instagramAppId, appSecret: instagramAppSecret })}
                  disabled={saveChannelMutation.isPending}
                  data-testid="button-save-instagram"
                >
                  {saveChannelMutation.isPending ? "Connecting..." : "Connect Instagram"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-foreground/10 rounded-md">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <CardTitle>X (Twitter)</CardTitle>
                    <CardDescription>Connect X/Twitter Direct Messages</CardDescription>
                  </div>
                  {channelIntegrations.find(c => c.channel === "twitter")?.enabled && (
                    <Badge className="bg-success text-success-foreground">Connected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="twitter-client-id">Client ID</Label>
                  <Input
                    id="twitter-client-id"
                    type="text"
                    placeholder="Your Twitter OAuth2 Client ID"
                    value={twitterClientId}
                    onChange={(e) => setTwitterClientId(e.target.value)}
                    data-testid="input-twitter-client-id"
                  />
                  <p className="text-sm text-muted-foreground">
                    Create an app at developer.twitter.com and enable OAuth2
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter-client-secret">Client Secret</Label>
                  <Input
                    id="twitter-client-secret"
                    type="password"
                    placeholder="Your Twitter OAuth2 Client Secret"
                    value={twitterClientSecret}
                    onChange={(e) => setTwitterClientSecret(e.target.value)}
                    data-testid="input-twitter-client-secret"
                  />
                </div>
                <Button
                  onClick={() => handleSaveChannel("twitter", { clientId: twitterClientId, clientSecret: twitterClientSecret })}
                  disabled={saveChannelMutation.isPending}
                  data-testid="button-save-twitter"
                >
                  {saveChannelMutation.isPending ? "Connecting..." : "Connect Twitter"}
                </Button>
              </CardContent>
            </Card>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Configuration (SendGrid)</CardTitle>
                    <CardDescription>Configure email notifications and CSAT surveys</CardDescription>
                  </div>
                  {emailEnabled && (
                    <Badge className="bg-success text-success-foreground">Active</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sendgrid-api-key">SendGrid API Key</Label>
                  <Input
                    id="sendgrid-api-key"
                    type="password"
                    placeholder="Enter your SendGrid API key"
                    value={sendgridApiKey}
                    onChange={(e) => setSendgridApiKey(e.target.value)}
                    data-testid="input-sendgrid-api-key"
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your API key from{" "}
                    <a
                      href="https://app.sendgrid.com/settings/api_keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      SendGrid Settings
                    </a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sender-email">Sender Email Address</Label>
                  <Input
                    id="sender-email"
                    type="email"
                    placeholder="support@solvextra.com"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    data-testid="input-sender-email"
                  />
                  <p className="text-sm text-muted-foreground">
                    This email must be verified in your SendGrid account
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sender-name">Sender Name</Label>
                  <Input
                    id="sender-name"
                    type="text"
                    placeholder="Solvextra Support"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    data-testid="input-sender-name"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send ticket resolution emails and CSAT surveys
                    </p>
                  </div>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                    data-testid="switch-email-enabled"
                  />
                </div>

                <Button
                  onClick={() => saveEmailSettingsMutation.mutate()}
                  disabled={saveEmailSettingsMutation.isPending}
                  className="w-full"
                  data-testid="button-save-email-settings"
                >
                  {saveEmailSettingsMutation.isPending ? "Saving..." : "Save Email Settings"}
                </Button>
              </CardContent>
            </Card>

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
