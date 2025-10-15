import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiWhatsapp, SiTelegram, SiInstagram } from "react-icons/si";
import { MessageCircle, ExternalLink, Copy, CheckCircle, Settings } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChannelIntegration } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Channels() {
  const [copied, setCopied] = useState<string | null>(null);
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const { toast } = useToast();

  const widgetUrl = `${window.location.origin}/widget`;
  const embedCode = `<iframe src="${widgetUrl}" width="100%" height="600" frameborder="0"></iframe>`;

  // Fetch Telegram integration status
  const { data: telegramIntegration } = useQuery<ChannelIntegration>({
    queryKey: ["/api/settings/channels/telegram"],
  });

  // Mutation to save Telegram configuration
  const saveTelegramMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/channels", {
        channel: "telegram",
        enabled: true,
        apiToken: telegramToken,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/channels/telegram"] });
      toast({
        title: "Success!",
        description: "Telegram bot connected successfully",
      });
      setTelegramDialogOpen(false);
      setTelegramToken("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save Telegram configuration",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="border-b border-border p-6 bg-background">
        <h1 className="text-2xl font-semibold">Channel Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your communication channels to unify customer conversations
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Website Widget - Active */}
        <Card className="border-success/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-md">
                  <MessageCircle className="w-6 h-6 text-success" />
                </div>
                <div>
                  <CardTitle>Website Chat Widget</CardTitle>
                  <CardDescription>Embed live chat on your website</CardDescription>
                </div>
              </div>
              <Badge className="bg-success text-success-foreground">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Widget URL:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={widgetUrl}
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(widgetUrl, "Widget URL")}
                  data-testid="button-copy-widget-url"
                >
                  {copied === "Widget URL" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(widgetUrl, "_blank")}
                  data-testid="button-open-widget"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Embed Code:</p>
              <div className="flex gap-2">
                <textarea
                  readOnly
                  value={embedCode}
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted font-mono text-xs resize-none"
                  rows={2}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(embedCode, "Embed Code")}
                  data-testid="button-copy-embed"
                >
                  {copied === "Embed Code" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-md">
                  <SiWhatsapp className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <CardTitle>WhatsApp Business</CardTitle>
                  <CardDescription>Connect WhatsApp Business API</CardDescription>
                </div>
              </div>
              <Badge variant="outline">Setup Required</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              To integrate WhatsApp Business:
            </p>
            <ol className="text-sm space-y-2 ml-4 list-decimal">
              <li>Create a WhatsApp Business account at business.whatsapp.com</li>
              <li>Apply for WhatsApp Business API access</li>
              <li>Get your API credentials (Phone Number ID, Access Token)</li>
              <li>Configure webhook URL in settings page</li>
            </ol>
            <Button variant="outline" className="w-full" data-testid="button-setup-whatsapp">
              <ExternalLink className="w-4 h-4 mr-2" />
              WhatsApp Business Setup Guide
            </Button>
          </CardContent>
        </Card>

        {/* Telegram */}
        <Card className={telegramIntegration?.enabled ? "border-success/50" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-md">
                  <SiTelegram className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Telegram</CardTitle>
                  <CardDescription>Connect Telegram Bot</CardDescription>
                </div>
              </div>
              {telegramIntegration?.enabled ? (
                <Badge className="bg-success text-success-foreground">Connected</Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {telegramIntegration?.enabled 
                ? "Your Telegram bot is connected and ready to receive messages."
                : "Connect your Telegram bot to start receiving customer messages."}
            </p>
            
            <Dialog open={telegramDialogOpen} onOpenChange={setTelegramDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" data-testid="button-configure-telegram">
                  <Settings className="w-4 h-4 mr-2" />
                  {telegramIntegration?.enabled ? "Reconfigure" : "Configure Telegram Bot"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configure Telegram Bot</DialogTitle>
                  <DialogDescription>
                    Enter your Telegram bot API token to connect
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="telegram-token">Bot API Token</Label>
                    <Input
                      id="telegram-token"
                      type="password"
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      data-testid="input-telegram-token"
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your bot token from @BotFather on Telegram
                    </p>
                  </div>
                  <Button 
                    onClick={() => saveTelegramMutation.mutate()} 
                    disabled={!telegramToken || saveTelegramMutation.isPending}
                    className="w-full"
                    data-testid="button-save-telegram"
                  >
                    {saveTelegramMutation.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {!telegramIntegration?.enabled && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Setup Instructions:</p>
                <ol className="text-xs space-y-1 ml-4 list-decimal text-muted-foreground">
                  <li>Open Telegram and search for @BotFather</li>
                  <li>Send /newbot and follow instructions</li>
                  <li>Copy the bot token provided</li>
                  <li>Click "Configure Telegram Bot" above and paste the token</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instagram */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-500/10 rounded-md">
                  <SiInstagram className="w-6 h-6 text-pink-500" />
                </div>
                <div>
                  <CardTitle>Instagram</CardTitle>
                  <CardDescription>Connect Instagram Direct Messages</CardDescription>
                </div>
              </div>
              <Badge variant="outline">Setup Required</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              To integrate Instagram:
            </p>
            <ol className="text-sm space-y-2 ml-4 list-decimal">
              <li>Create a Facebook App at developers.facebook.com</li>
              <li>Add Instagram product to your app</li>
              <li>Connect your Instagram Business account</li>
              <li>Get your access token and configure webhook</li>
            </ol>
            <Button variant="outline" className="w-full" data-testid="button-setup-instagram">
              <ExternalLink className="w-4 h-4 mr-2" />
              Instagram API Setup Guide
            </Button>
          </CardContent>
        </Card>

        {/* Twitter/X */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-foreground/10 rounded-md">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle>X (Twitter)</CardTitle>
                  <CardDescription>Connect X/Twitter Direct Messages</CardDescription>
                </div>
              </div>
              <Badge variant="outline">Setup Required</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              To integrate X (Twitter):
            </p>
            <ol className="text-sm space-y-2 ml-4 list-decimal">
              <li>Apply for X Developer account at developer.x.com</li>
              <li>Create a new app in the developer portal</li>
              <li>Enable Direct Messages API</li>
              <li>Get API keys and configure webhook</li>
            </ol>
            <Button variant="outline" className="w-full" data-testid="button-setup-twitter">
              <ExternalLink className="w-4 h-4 mr-2" />
              X API Setup Guide
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
