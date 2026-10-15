"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { signIn, signUp } from "@/lib/auth/local";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("auth");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<string>("login");
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [loginErrors, setLoginErrors] = React.useState<{
    email?: string;
    password?: string;
  }>({});

  // Sign Up form state
  const [signupName, setSignupName] = React.useState("");
  const [signupEmail, setSignupEmail] = React.useState("");
  const [signupPassword, setSignupPassword] = React.useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = React.useState("");
  const [signupErrors, setSignupErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const errors: { email?: string; password?: string } = {};
    if (!loginEmail.trim()) {
      errors.email = t("validation.emailRequired");
    } else if (!validateEmail(loginEmail)) {
      errors.email = t("validation.emailInvalid");
    }

    if (!loginPassword) {
      errors.password = t("validation.passwordRequired");
    } else if (loginPassword.length < 6) {
      errors.password = t("validation.passwordMinLength");
    }

    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      const { data, error } = await signIn({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) {
        const msg = error.message || t("alerts.authError");
        setGeneralError(msg);
        toast.error(msg);
        return;
      }

      if (data.user) {
        toast.success(t("alerts.loginSuccess"));
        router.push("/sections");
        router.refresh();
      }
    } catch {
      const msg = t("alerts.authError");
      setGeneralError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!signupName.trim()) {
      errors.name = t("validation.nameRequired");
    }

    if (!signupEmail.trim()) {
      errors.email = t("validation.emailRequired");
    } else if (!validateEmail(signupEmail)) {
      errors.email = t("validation.emailInvalid");
    }

    if (!signupPassword) {
      errors.password = t("validation.passwordRequired");
    } else if (signupPassword.length < 6) {
      errors.password = t("validation.passwordMinLength");
    }

    if (!signupConfirmPassword) {
      errors.confirmPassword = t("validation.confirmPasswordRequired");
    } else if (signupPassword !== signupConfirmPassword) {
      errors.confirmPassword = t("validation.passwordsDoNotMatch");
    }

    setSignupErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);

    try {
      const { data, error } = await signUp({
        email: signupEmail.trim(),
        password: signupPassword,
      });

      if (error) {
        const msg = error.message || t("alerts.authError");
        setGeneralError(msg);
        toast.error(msg);
        return;
      }

      if (data.session) {
        toast.success(t("alerts.signupSuccess"));
        router.push("/sections");
        router.refresh();
      } else {
        toast.success(t("alerts.signupCheckEmail"));
      }
    } catch {
      const msg = t("alerts.authError");
      setGeneralError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-cover bg-center bg-no-repeat bg-fixed selection:bg-accent/15 selection:text-accent"
      style={{
        backgroundImage: "url('/login-bg.jpg')",
      }}
    >
      {/* Floating Language Toggle Pill (Top-Right in LTR, Top-Left in RTL) */}
      <div
        className="login-glass absolute top-4 end-4 sm:top-6 sm:end-6 z-20 flex items-center h-9 md:h-10 px-1 shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
        style={{
          background: "rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(16px) saturate(120%)",
          WebkitBackdropFilter: "blur(16px) saturate(120%)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          borderRadius: "9999px",
        }}
      >
        <LocaleSwitcher
          currentLocale={locale}
          showFullOnMobile
          className="border-transparent bg-transparent text-white hover:bg-white/10 hover:text-white [&_svg]:text-white h-full"
        />
      </div>

      {/* Main Centered Frosted Glass Container */}
      <div
        className="login-glass relative z-10 w-full max-w-md mx-4 p-6 md:p-10 animate-in fade-in-50 zoom-in-95 duration-200"
        style={{
          background: "rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(16px) saturate(120%)",
          WebkitBackdropFilter: "blur(16px) saturate(120%)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          borderRadius: "20px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
        }}
      >
        {/* Direct Start: Login / Sign Up Tabs (Nothing above) */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val);
            setGeneralError(null);
          }}
          className="w-full text-start"
        >
          <TabsList
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
            className="grid w-full grid-cols-2 mb-6 h-10 p-1 rounded-xl"
          >
            <TabsTrigger
              value="login"
              className="rounded-lg text-xs font-medium py-1.5 transition-all duration-150 text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10 data-[state=active]:shadow-none"
            >
              {t("loginTab")}
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className="rounded-lg text-xs font-medium py-1.5 transition-all duration-150 text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10 data-[state=active]:shadow-none"
            >
              {t("signupTab")}
            </TabsTrigger>
          </TabsList>

          {/* General Feedback Error Banner */}
          {generalError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-500/30 bg-red-500/20 px-3 py-2 text-xs text-red-200 text-start leading-relaxed"
            >
              {generalError}
            </div>
          )}

          {/* Login Tab Content */}
          <TabsContent value="login" className="mt-0 space-y-4">
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5 text-start">
                <Label htmlFor="login-email" className="text-white/90 text-xs font-medium">
                  {t("email")}
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    if (loginErrors.email) {
                      setLoginErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  error={!!loginErrors.email}
                  disabled={isLoading}
                  style={{
                    background: "rgba(255, 255, 255, 0.10)",
                    border: "1px solid rgba(255, 255, 255, 0.20)",
                  }}
                  className="text-white placeholder:text-white/50 focus-visible:border-white/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {loginErrors.email && (
                  <p className="text-xs text-red-300 text-start">
                    {loginErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 text-start">
                <Label htmlFor="login-password" className="text-white/90 text-xs font-medium">
                  {t("password")}
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (loginErrors.password) {
                      setLoginErrors((prev) => ({
                        ...prev,
                        password: undefined,
                      }));
                    }
                  }}
                  error={!!loginErrors.password}
                  disabled={isLoading}
                  style={{
                    background: "rgba(255, 255, 255, 0.10)",
                    border: "1px solid rgba(255, 255, 255, 0.20)",
                  }}
                  className="text-white placeholder:text-white/50 focus-visible:border-white/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {loginErrors.password && (
                  <p className="text-xs text-red-300 text-start">
                    {loginErrors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="md"
                className="w-full mt-2 font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-soft transition-all duration-150"
                isLoading={isLoading}
              >
                {t("loginButton")}
              </Button>
            </form>
          </TabsContent>

          {/* Sign Up Tab Content */}
          <TabsContent value="signup" className="mt-0 space-y-4">
            <form onSubmit={handleSignupSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5 text-start">
                <Label htmlFor="signup-name" className="text-white/90 text-xs font-medium">
                  {t("name")}
                </Label>
                <Input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  placeholder={t("namePlaceholder")}
                  value={signupName}
                  onChange={(e) => {
                    setSignupName(e.target.value);
                    if (signupErrors.name) {
                      setSignupErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  error={!!signupErrors.name}
                  disabled={isLoading}
                  style={{
                    background: "rgba(255, 255, 255, 0.10)",
                    border: "1px solid rgba(255, 255, 255, 0.20)",
                  }}
                  className="text-white placeholder:text-white/50 focus-visible:border-white/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {signupErrors.name && (
                  <p className="text-xs text-red-300 text-start">
                    {signupErrors.name}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 text-start">
                <Label htmlFor="signup-email" className="text-white/90 text-xs font-medium">
                  {t("email")}
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={signupEmail}
                  onChange={(e) => {
                    setSignupEmail(e.target.value);
                    if (signupErrors.email) {
                      setSignupErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  error={!!signupErrors.email}
                  disabled={isLoading}
                  style={{
                    background: "rgba(255, 255, 255, 0.10)",
                    border: "1px solid rgba(255, 255, 255, 0.20)",
                  }}
                  className="text-white placeholder:text-white/50 focus-visible:border-white/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {signupErrors.email && (
                  <p className="text-xs text-red-300 text-start">
                    {signupErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 text-start">
                <Label htmlFor="signup-password" className="text-white/90 text-xs font-medium">
                  {t("password")}
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  value={signupPassword}
                  onChange={(e) => {
                    setSignupPassword(e.target.value);
                    if (signupErrors.password) {
                      setSignupErrors((prev) => ({
                        ...prev,
                        password: undefined,
                      }));
                    }
                  }}
                  error={!!signupErrors.password}
                  disabled={isLoading}
                  style={{
                    background: "rgba(255, 255, 255, 0.10)",
                    border: "1px solid rgba(255, 255, 255, 0.20)",
                  }}
                  className="text-white placeholder:text-white/50 focus-visible:border-white/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {signupErrors.password && (
                  <p className="text-xs text-red-300 text-start">
                    {signupErrors.password}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 text-start">
                <Label htmlFor="signup-confirm-password" className="text-white/90 text-xs font-medium">
                  {t("confirmPassword")}
                </Label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("confirmPasswordPlaceholder")}
                  value={signupConfirmPassword}
                  onChange={(e) => {
                    setSignupConfirmPassword(e.target.value);
                    if (signupErrors.confirmPassword) {
                      setSignupErrors((prev) => ({
                        ...prev,
                        confirmPassword: undefined,
                      }));
                    }
                  }}
                  error={!!signupErrors.confirmPassword}
                  disabled={isLoading}
                  style={{
                    background: "rgba(255, 255, 255, 0.10)",
                    border: "1px solid rgba(255, 255, 255, 0.20)",
                  }}
                  className="text-white placeholder:text-white/50 focus-visible:border-white/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {signupErrors.confirmPassword && (
                  <p className="text-xs text-red-300 text-start">
                    {signupErrors.confirmPassword}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="md"
                className="w-full mt-2 font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-soft transition-all duration-150"
                isLoading={isLoading}
              >
                {t("signupButton")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
