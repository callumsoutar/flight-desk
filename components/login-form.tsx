"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Plane,
} from "lucide-react"
import { toast } from "sonner"

import { signInWithEmail } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const AUTH_BROADCAST_CHANNEL = "aerosafety-auth"

const carouselSlides = [
  {
    image:
      "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?q=80&w=2073&auto=format&fit=crop",
    title: "Elevate Your Training,",
    subtitle: "Master the Skies",
  },
  {
    image:
      "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?q=80&w=2070&auto=format&fit=crop",
    title: "Track Every Flight,",
    subtitle: "Achieve Every Goal",
  },
  {
    image:
      "https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=2070&auto=format&fit=crop",
    title: "Professional Tools,",
    subtitle: "Professional Results",
  },
]

export function LoginForm({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [rememberMe, setRememberMe] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [currentSlide, setCurrentSlide] = React.useState(0)
  const [pending, startTransition] = React.useTransition()

  const message = searchParams.get("message")
  const error = searchParams.get("error")

  const decodedError = React.useMemo(() => {
    if (!error) return null
    try {
      return decodeURIComponent(error)
    } catch {
      return error
    }
  }, [error])

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [])

  const broadcastAuthChanged = React.useCallback(() => {
    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
        bc.postMessage("auth-changed")
        bc.close()
      }
    } catch {
      // ignore
    }
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      const result = await signInWithEmail(email, password)
      if (result.error) {
        toast.error(result.error)
        return
      }

      broadcastAuthChanged()
      router.refresh()
      window.location.assign(nextUrl || "/")
    })
  }

  async function onGoogle() {
    const supabase = createSupabaseBrowserClient()

    const callbackUrl = new URL("/auth/callback", window.location.origin)
    if (nextUrl) callbackUrl.searchParams.set("next", nextUrl)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (oauthError) toast.error(oauthError.message)
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0B1527]">
      <div className="flex min-h-screen">
        <div className="relative m-4 hidden overflow-hidden rounded-3xl lg:flex lg:w-1/2">
          {carouselSlides.map((slide, index) => (
            <div
              key={slide.title}
              className={cn(
                "absolute inset-0 bg-cover bg-center transition-opacity duration-1000",
                currentSlide === index ? "opacity-100" : "opacity-0"
              )}
              style={{
                backgroundImage: `url(${slide.image})`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1527]/90 via-[#0B1527]/40 to-[#0B1527]/20" />
            </div>
          ))}

          <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plane className="h-7 w-7 fill-white/20 text-white" />
              <span className="text-xl font-bold tracking-tight text-white">
                Flight Desk Pro
              </span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
            >
              Back to website
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="absolute bottom-20 left-6 right-6 z-10">
            {carouselSlides.map((slide, index) => (
              <div
                key={slide.subtitle}
                className={cn(
                  "absolute bottom-0 left-0 transition-all duration-700",
                  currentSlide === index
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                )}
              >
                <h2 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
                  {slide.title}
                  <br />
                  <span className="text-cyan-400">{slide.subtitle}</span>
                </h2>
              </div>
            ))}
          </div>

          <div className="absolute bottom-8 left-6 z-10 flex gap-2">
            {carouselSlides.map((slide, index) => (
              <button
                key={`${slide.title}-${slide.subtitle}`}
                type="button"
                onClick={() => setCurrentSlide(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  currentSlide === index
                    ? "w-8 bg-white"
                    : "w-2 bg-white/40 hover:bg-white/60"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="flex w-full items-center justify-center p-6 sm:p-8 lg:w-1/2 lg:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
              <Plane className="h-7 w-7 fill-cyan-400/20 text-cyan-400" />
              <span className="text-xl font-bold tracking-tight text-white">
                Flight Desk Pro
              </span>
            </div>

            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">
                Welcome back
              </h1>
              <p className="text-slate-400">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
                >
                  Sign up
                </Link>
              </p>
            </div>

            {message === "check-email" && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <Mail className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-400">Check your email</p>
                  <p className="mt-0.5 text-xs text-emerald-400/70">
                    We&apos;ve sent you a verification link. Please check your inbox and
                    spam folder.
                  </p>
                </div>
              </div>
            )}

            {message === "email-verified" && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-400">Email verified!</p>
                  <p className="mt-0.5 text-xs text-emerald-400/70">
                    Your account is ready. Sign in below to get started.
                  </p>
                </div>
              </div>
            )}

            {decodedError && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-400">Authentication error</p>
                  <p className="mt-0.5 text-xs text-red-400/70">{decodedError}</p>
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="h-12 w-full rounded-xl border border-[#2a3f5f] bg-[#1a2942] px-4 text-white placeholder:text-slate-500 transition-all duration-200 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={pending}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-300"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-[#2a3f5f] bg-[#1a2942] px-4 pr-12 text-white placeholder:text-slate-500 transition-all duration-200 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={pending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                    className="border-[#2a3f5f] data-[state=checked]:border-cyan-500 data-[state=checked]:bg-cyan-500"
                    disabled={pending}
                  />
                  <label
                    htmlFor="rememberMe"
                    className="cursor-pointer select-none text-sm text-slate-400"
                  >
                    Remember me
                  </label>
                </div>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={pending}
                className="h-12 w-full rounded-xl bg-cyan-500 font-semibold text-[#0B1527] shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:bg-cyan-400"
              >
                {pending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0B1527]/30 border-t-[#0B1527]" />
                    Signing in...
                  </div>
                ) : (
                  "Sign in"
                )}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#2a3f5f]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-[#0B1527] px-4 text-slate-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onGoogle}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#2a3f5f] bg-[#1a2942] px-4 font-medium text-white transition-all duration-200 hover:border-[#3a5070] hover:bg-[#243552]"
                  disabled={pending}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#2a3f5f] bg-[#1a2942] px-4 font-medium text-white transition-all duration-200 hover:border-[#3a5070] hover:bg-[#243552]"
                  disabled={pending}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Apple
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
              >
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
