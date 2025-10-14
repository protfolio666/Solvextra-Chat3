import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import logoPath from "@assets/IMG_3463-removebg-preview_1760467422348.png";

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleContinue = () => {
    setShowLoginForm(true);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({
      username,
      password,
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Auth */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background relative overflow-hidden">
        <div className="w-full max-w-md relative z-10">
          {/* Welcome Screen */}
          <div
            className={`transition-all duration-500 ${
              showLoginForm
                ? "opacity-0 -translate-x-8 pointer-events-none absolute"
                : "opacity-100 translate-x-0"
            }`}
          >
            <div className="flex items-center gap-3 mb-8">
              <img src={logoPath} alt="Solvextra" className="h-12 w-12" />
              <h1 className="text-2xl font-bold">Solvextra</h1>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-bold mb-2">Welcome back!</h2>
                <p className="text-muted-foreground">
                  Please enter your credentials to log in
                </p>
              </div>

              <Button
                onClick={handleContinue}
                className="w-full h-12 text-base"
                size="lg"
                data-testid="button-continue-login"
              >
                Continue to Login
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Login Form */}
          <div
            className={`transition-all duration-500 ${
              showLoginForm
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-8 pointer-events-none absolute"
            }`}
          >
            <div className="flex items-center gap-3 mb-8">
              <img src={logoPath} alt="Solvextra" className="h-12 w-12" />
              <h1 className="text-2xl font-bold">Solvextra</h1>
            </div>

            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Login</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your credentials to access your account
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Email</Label>
                      <Input
                        id="username"
                        type="email"
                        placeholder="your.email@solvextra.com"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        data-testid="input-username"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        data-testid="input-password"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? "Logging in..." : "Login"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setShowLoginForm(false)}
                      data-testid="button-back"
                    >
                      Back
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Right Side - Illustration */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center p-12">
        <div className="max-w-lg">
          <img
            src="https://illustrations.popsy.co/amber/customer-support.svg"
            alt="Customer Support Illustration"
            className="w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
}
