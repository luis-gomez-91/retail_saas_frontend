"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ApiError,
  apiFetch,
  fetchPublicAuthProviders,
  loginRequest,
  loginWithGoogleCredential,
  requestEmailOtp,
  verifyEmailOtp,
} from "@/lib/api/client";
import { resolveHomeRoute } from "@/lib/auth/home-route";
import { clearTokens, getAccessToken, setTokens } from "@/lib/auth/storage";
import type { MeUser } from "@/lib/types/api";
import { getGoogleClientId, getOtpEmailTtlSeconds } from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Smartphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type GoogleCredentialResponse = { credential?: string };
type GoogleIdApi = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  prompt: () => void;
};

type GoogleWindow = Window & {
  google?: { accounts?: { id?: GoogleIdApi } };
};

function formatOtpCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";
  const safeNextPath = nextPath.startsWith("/") ? nextPath : "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  /** Segundos hasta vencimiento del código actual (solo paso "code"). */
  const [otpTtlRemaining, setOtpTtlRemaining] = useState<number | null>(null);
  /** Cooldown de reenvío devuelto por el backend (0 = reenvío inmediato). */
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [googleReady, setGoogleReady] = useState(false);
  const [enabledProviderCodes, setEnabledProviderCodes] = useState<
    string[] | null
  >(null);
  const googleApiRef = useRef<GoogleIdApi | null>(null);
  const otpCodeInputRef = useRef<HTMLInputElement>(null);
  const googleClientId = getGoogleClientId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    if (hash) {
      const params = new URLSearchParams(hash);
      const access = params.get("access");
      const refresh = params.get("refresh");
      if (access && refresh) {
        setTokens(access, refresh);
        const path = window.location.pathname + (window.location.search || "");
        window.history.replaceState(null, "", path);
      }
    }
    const token = getAccessToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<MeUser>("/api/users/me/");
        if (cancelled) return;
        const dest = safeNextPath === "/" ? resolveHomeRoute(me) : safeNextPath;
        router.replace(dest);
      } catch {
        clearTokens();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, safeNextPath]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPublicAuthProviders(window.location.hostname);
        if (cancelled) return;
        setEnabledProviderCodes(data.providers.map((p) => p.code));
      } catch {
        if (!cancelled) setEnabledProviderCodes(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const tenantDomain =
        typeof window !== "undefined" ? window.location.hostname : undefined;
      const tokens = await loginRequest(username, password, tenantDomain);
      setTokens(tokens.access, tokens.refresh);
      router.replace(safeNextPath);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar sesión. Revisa credenciales.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!googleClientId) return;

    const handleGoogleLogin = async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setError("Google no devolvió un credential válido.");
        return;
      }
      setError(null);
      setNotice(null);
      setGoogleLoading(true);
      try {
        const tenantDomain =
          typeof window !== "undefined" ? window.location.hostname : undefined;
        const tokens = await loginWithGoogleCredential(
          response.credential,
          tenantDomain,
        );
        setTokens(tokens.access, tokens.refresh);
        router.replace(safeNextPath);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "No se pudo iniciar sesión con Google.";
        setError(message);
      } finally {
        setGoogleLoading(false);
      }
    };

    const initializeGoogle = () => {
      const w = window as GoogleWindow;
      const googleId = w.google?.accounts?.id;
      if (!googleId) return;
      googleId.initialize({
        client_id: googleClientId,
        callback: handleGoogleLogin,
      });
      googleApiRef.current = googleId;
      setGoogleReady(true);
    };

    const scriptId = "google-identity-services";
    const existing = document.getElementById(
      scriptId,
    ) as HTMLScriptElement | null;
    if (existing) {
      initializeGoogle();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);
  }, [googleClientId, safeNextPath, router]);

  useEffect(() => {
    if (otpTtlRemaining === null || otpTtlRemaining <= 0) return;
    if (otpStep !== "code" || !otpDialogOpen) return;
    const id = window.setInterval(() => {
      setOtpTtlRemaining((prev) =>
        prev === null || prev <= 1 ? 0 : prev - 1,
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [otpTtlRemaining, otpStep, otpDialogOpen]);

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setOtpResendCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [otpResendCooldown]);

  useEffect(() => {
    if (!otpDialogOpen || otpStep !== "code") return;
    const id = window.setTimeout(() => {
      otpCodeInputRef.current?.focus();
      otpCodeInputRef.current?.select();
    }, 80);
    return () => window.clearTimeout(id);
  }, [otpDialogOpen, otpStep]);

  function onGoogleClick() {
    if (!googleApiRef.current) {
      setError("Google Sign-In no está listo todavía. Intenta de nuevo.");
      return;
    }
    setError(null);
    setNotice(null);
    googleApiRef.current.prompt();
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function onOtpClick() {
    const initialValue = username.includes("@") ? username.trim() : "";
    setOtpEmail(initialValue);
    setOtpCode("");
    setOtpStep("email");
    setOtpTtlRemaining(null);
    setOtpResendCooldown(0);
    setOtpDialogOpen(true);
    setError(null);
    setNotice(null);
  }

  async function onRequestOtpCode() {
    const workEmail = otpEmail.trim();
    if (!workEmail) {
      setError("Debes ingresar un correo laboral para continuar con OTP.");
      return;
    }
    if (!isValidEmail(workEmail)) {
      setError("Ingresa un correo válido.");
      return;
    }
    setError(null);
    setNotice(null);
    setOtpLoading(true);
    try {
      const tenantDomain =
        typeof window !== "undefined" ? window.location.hostname : undefined;
      const requestResult = await requestEmailOtp(workEmail, tenantDomain);
      const codeSent = requestResult.code_sent !== false;
      if (codeSent) {
        setNotice(requestResult.detail);
        const ttl =
          typeof requestResult.expires_in_seconds === "number" &&
          requestResult.expires_in_seconds > 0
            ? requestResult.expires_in_seconds
            : getOtpEmailTtlSeconds();
        setOtpTtlRemaining(ttl);
        const cool =
          typeof requestResult.resend_cooldown_seconds === "number"
            ? Math.max(0, requestResult.resend_cooldown_seconds)
            : 0;
        setOtpResendCooldown(cool);
        setOtpStep("code");
      } else {
        setNotice(null);
        setOtpTtlRemaining(null);
        setOtpResendCooldown(0);
        setError(requestResult.detail);
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar sesión con código OTP.";
      setError(message);
    } finally {
      setOtpLoading(false);
    }
  }

  async function onVerifyOtpCode() {
    const code = otpCode.trim();
    if (!code) {
      setError("Ingresa el código OTP recibido por correo.");
      return;
    }
    setError(null);
    setNotice(null);
    setOtpLoading(true);
    try {
      const tenantDomain =
        typeof window !== "undefined" ? window.location.hostname : undefined;
      const tokens = await verifyEmailOtp(otpEmail.trim(), code, tenantDomain);
      setTokens(tokens.access, tokens.refresh);
      setOtpDialogOpen(false);
      router.replace(safeNextPath);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo validar el código OTP.";
      setError(message);
    } finally {
      setOtpLoading(false);
    }
  }

  const secondaryLoginButtonClass =
    "group flex w-full cursor-pointer items-center rounded-3xl border border-input bg-transparent py-2.5 px-3 text-sm font-medium leading-snug text-muted-foreground transition-colors hover:bg-nav-accent-soft hover:text-nav-accent";

  /** Input + label flotante (estilo Compose / Material); requiere `placeholder=" "`. */
  const floatingFieldInputClass =
    "peer h-14 w-full rounded-xl border border-input bg-slate-50 px-3 pb-2.5 pt-5 text-sm text-foreground shadow-sm placeholder-transparent focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
  const floatingFieldLabelClass =
    "pointer-events-none absolute left-3 top-1/2 z-10 max-w-[calc(100%-1.5rem)] origin-left -translate-y-1/2 truncate text-left text-sm text-slate-500 transition-all duration-200 ease-out peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:leading-tight peer-focus:text-slate-700 peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:leading-tight peer-[:not(:placeholder-shown)]:text-slate-700";
  const loginWelcomeLineClass =
    "block text-4xl font-extrabold tracking-tight text-indigo-950 sm:text-5xl lg:text-6xl";

  const providerCodes = enabledProviderCodes;
  const isProviderEnabled = (code: string) =>
    providerCodes === null || providerCodes.includes(code);

  function oauthProviderIcon(code: string) {
    return (
      <Image
        src={`/auth_providers/${code}.webp`}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 shrink-0 object-contain"
      />
    );
  }

  function oauthButtonIconSlot(children: ReactNode) {
    return (
      <span className="flex w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-nav-accent">
        {children}
      </span>
    );
  }

  function oauthButtonLabel(children: ReactNode) {
    return (
      <span className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-2 text-center leading-snug">
        {children}
      </span>
    );
  }

  function oauthButtonSpacer() {
    return <span className="w-10 shrink-0" aria-hidden />;
  }

  return (
    <div className="login-page-light flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid min-h-0 w-full max-w-6xl grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-8">
        <div className="hidden min-h-0 flex-col items-center justify-center p-6 sm:p-8 lg:flex">
          <Image
            src="/logo.svg"
            alt="Retail Suite"
            width={466}
            height={129}
            className="h-auto w-full max-w-[280px] object-contain lg:max-w-[300px]"
            priority
          />
        </div>
        <div className="flex min-h-0 w-full max-w-[450px] flex-col items-center justify-center justify-self-center px-0 py-6 sm:px-4 md:px-6 lg:px-8 lg:py-8">
          <div className="w-full max-w-[28rem] shrink-0">
            <h1 className="font-login-heading leading-none">
              <span className={loginWelcomeLineClass}>Bienvenido a</span>
              <span
                className={cn(
                  loginWelcomeLineClass,
                  "mt-0.5 sm:mt-1 lg:mt-1",
                )}
              >
                Retail Suite
              </span>
            </h1>

            <form
              onSubmit={onSubmit}
              className="mt-6 flex flex-col gap-4 sm:mt-8"
            >
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  className={floatingFieldInputClass}
                  placeholder=" "
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <label htmlFor="username" className={floatingFieldLabelClass}>
                  Usuario, cédula o correo
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`${floatingFieldInputClass} pr-10`}
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label
                  htmlFor="password"
                  className={`${floatingFieldLabelClass} max-w-[calc(100%-2.75rem)]`}
                >
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 z-20 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                o
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex flex-col gap-2">
              {!googleClientId ? (
                <p className="text-xs text-muted-foreground">
                  El inicio de sesión con Google no está disponible. Si lo
                  necesitás, contactá a quien administra el sistema.
                </p>
              ) : isProviderEnabled("google") ? (
                <>
                  <button
                    type="button"
                    onClick={onGoogleClick}
                    disabled={!googleReady || googleLoading}
                    className={`${secondaryLoginButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {oauthButtonIconSlot(oauthProviderIcon("google"))}
                    {oauthButtonLabel(
                      googleLoading
                        ? "Validando cuenta..."
                        : "Continuar con Google",
                    )}
                    {oauthButtonSpacer()}
                  </button>
                  {!googleReady && !googleLoading ? (
                    <p className="text-center text-xs text-muted-foreground">
                      Cargando Google Sign-In...
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Google no está habilitado para este tenant.
                </p>
              )}

              {isProviderEnabled("microsoft") ? (
                <button type="button" className={secondaryLoginButtonClass}>
                  {oauthButtonIconSlot(oauthProviderIcon("microsoft"))}
                  {oauthButtonLabel("Continuar con Microsoft")}
                  {oauthButtonSpacer()}
                </button>
              ) : null}

              {isProviderEnabled("apple") ? (
                <button type="button" className={secondaryLoginButtonClass}>
                  {oauthButtonIconSlot(oauthProviderIcon("apple"))}
                  {oauthButtonLabel("Continuar con Apple")}
                  {oauthButtonSpacer()}
                </button>
              ) : null}

              {isProviderEnabled("otp") ? (
                <button
                  type="button"
                  onClick={onOtpClick}
                  disabled={otpLoading}
                  className={`${secondaryLoginButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {oauthButtonIconSlot(oauthProviderIcon("otp"))}
                  {oauthButtonLabel(
                    otpLoading
                      ? "Enviando/verificando código..."
                      : "Entrar con código de un solo uso",
                  )}
                  {oauthButtonSpacer()}
                </button>
              ) : null}

              {isProviderEnabled("enterprise") ? (
                <button type="button" className={secondaryLoginButtonClass}>
                  {oauthButtonIconSlot(oauthProviderIcon("enterprise"))}
                  {oauthButtonLabel("Cuenta de empresa")}
                  {oauthButtonSpacer()}
                </button>
              ) : null}

              {isProviderEnabled("ldap") ? (
                <button type="button" className={secondaryLoginButtonClass}>
                  {oauthButtonIconSlot(oauthProviderIcon("ldap"))}
                  {oauthButtonLabel("Cuenta LDAP")}
                  {oauthButtonSpacer()}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <Dialog
        open={Boolean(error)}
        onOpenChange={(open) => {
          if (!open) setError(null);
        }}
      >
        <DialogContent className="z-[60] sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>No pudimos completar el inicio de sesión</DialogTitle>
            <DialogDescription className="sr-only">
              Detalle del error devuelto por el servidor o la validación local.
            </DialogDescription>
          </DialogHeader>
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setError(null)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={otpDialogOpen}
        onOpenChange={(open) => {
          setOtpDialogOpen(open);
          if (!open) {
            setOtpTtlRemaining(null);
            setOtpResendCooldown(0);
            setOtpCode("");
            setNotice(null);
            setOtpStep("email");
          }
        }}
      >
        <DialogContent
          showCloseButton
          className="gap-0 overflow-hidden p-0 sm:max-w-[26rem] sm:rounded-2xl"
        >
          <div className="relative border-b border-border/70 bg-gradient-to-br from-primary/[0.08] via-card to-card px-5 pb-4 pt-5 sm:px-6">
            <div
              className="mb-4 flex gap-2"
              role="navigation"
              aria-label="Pasos del acceso por código"
            >
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  otpStep === "email"
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-emerald-500/35 bg-emerald-500/10 text-emerald-800",
                )}
              >
                1 · Correo
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  otpStep === "code"
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-muted/60 text-muted-foreground",
                )}
              >
                2 · Código
              </span>
            </div>
            <div className="flex gap-3.5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm ring-1 ring-primary/10"
                aria-hidden
              >
                {otpStep === "email" ? (
                  <Mail className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <Smartphone className="h-5 w-5" strokeWidth={2} />
                )}
              </div>
              <DialogHeader className="min-w-0 flex-1 space-y-1.5 p-0 text-left">
                <DialogTitle className="text-lg leading-snug sm:text-xl">
                  {otpStep === "email"
                    ? "Acceso con código de un solo uso"
                    : "Ingresá el código"}
                </DialogTitle>
                <DialogDescription className="text-[13px] leading-relaxed sm:text-sm">
                  {otpStep === "email"
                    ? "Usá el mismo correo laboral que figura en tu perfil de la organización."
                    : (
                        <>
                          Lo enviamos a{" "}
                          <span className="font-medium text-foreground">
                            {otpEmail.trim()}
                          </span>
                          . Revisá también spam o promociones.
                        </>
                      )}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            {notice ? (
              <div
                className="flex gap-2.5 rounded-xl border border-emerald-400/35 bg-emerald-50/90 px-3.5 py-3 text-sm text-emerald-950 shadow-sm"
                role="status"
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-800"
                  aria-hidden
                >
                  <Mail className="h-3.5 w-3.5" />
                </span>
                <p className="min-w-0 leading-snug">{notice}</p>
              </div>
            ) : null}

            {otpStep === "email" ? (
              <div className="space-y-2">
                <Label
                  htmlFor="otp-email"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Correo laboral
                </Label>
                <input
                  id="otp-email"
                  type="email"
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
                  placeholder="nombre@empresa.com"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void onRequestOtpCode();
                    }
                  }}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Debe coincidir con el correo registrado para tu usuario en este
                  dominio.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {otpTtlRemaining !== null ? (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-3.5 py-3",
                      otpTtlRemaining > 0
                        ? "border-border/80 bg-muted/50"
                        : "border-amber-400/45 bg-amber-50/90",
                    )}
                    aria-live="polite"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        otpTtlRemaining > 0
                          ? "bg-background text-primary shadow-sm ring-1 ring-border/80"
                          : "bg-amber-500/15 text-amber-900",
                      )}
                      aria-hidden
                    >
                      <Clock className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {otpTtlRemaining > 0 ? (
                        <>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Tiempo restante
                          </p>
                          <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                            {formatOtpCountdown(otpTtlRemaining)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Cuando venza, pedí un código nuevo con{" "}
                            <span className="font-medium text-foreground">
                              Reenviar
                            </span>
                            .
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-amber-950">
                            Este código ya no es válido
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                            Reenviá un código nuevo o cambiá el correo si no es
                            el correcto.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <Label
                      htmlFor="otp-code"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Código de verificación
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto min-h-0 py-0 text-xs font-medium text-primary hover:text-primary/90"
                      onClick={() => void onRequestOtpCode()}
                      disabled={
                        otpLoading ||
                        otpResendCooldown > 0 ||
                        !isValidEmail(otpEmail.trim())
                      }
                    >
                      {otpResendCooldown > 0
                        ? `Reenviar en ${otpResendCooldown}s`
                        : "Reenviar código"}
                    </Button>
                  </div>
                  <input
                    ref={otpCodeInputRef}
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={12}
                    className="h-14 w-full rounded-xl border border-input bg-card px-3 text-center font-mono text-2xl font-semibold tracking-[0.35em] text-foreground shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 placeholder:tracking-normal focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 sm:text-[1.65rem]"
                    placeholder="······"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void onVerifyOtpCode();
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 border-t border-border/70 bg-muted/25 px-5 py-4 sm:justify-between sm:px-6">
            <Button
              type="button"
              size="lg"
              className="w-full min-w-[8.5rem] sm:order-2 sm:w-auto"
              onClick={
                otpStep === "email" ? onRequestOtpCode : onVerifyOtpCode
              }
              disabled={
                otpLoading ||
                (otpStep === "code" &&
                  otpTtlRemaining !== null &&
                  otpTtlRemaining <= 0)
              }
            >
              {otpLoading ? (
                <>
                  <Loader2
                    className="mr-2 size-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  {otpStep === "email" ? "Enviando…" : "Validando…"}
                </>
              ) : otpStep === "email" ? (
                "Enviar código"
              ) : (
                "Entrar"
              )}
            </Button>
            {otpStep === "code" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground sm:order-1 sm:w-auto"
                onClick={() => {
                  setOtpStep("email");
                  setOtpCode("");
                  setOtpTtlRemaining(null);
                  setOtpResendCooldown(0);
                }}
                disabled={otpLoading}
              >
                ← Usar otro correo
              </Button>
            ) : (
              <span className="hidden h-8 sm:block" aria-hidden />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-page-light flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
