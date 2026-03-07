"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Plane,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { signUpWithEmail } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const carouselSlides = [
  {
    image:
      "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?q=80&w=2073&auto=format&fit=crop",
    title: "Start Your Journey,",
    subtitle: "Build Your Organization",
  },
  {
    image:
      "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?q=80&w=2070&auto=format&fit=crop",
    title: "Safety Management,",
    subtitle: "Made Simple",
  },
  {
    image:
      "https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=2070&auto=format&fit=crop",
    title: "Professional Tools,",
    subtitle: "From Day One",
  },
]

export function SignupForm() {
  const router = useRouter()

  const [name, setName] = React.useState("")
  const [organization, setOrganization] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [currentSlide, setCurrentSlide] = React.useState(0)
  const [pending, startTransition] = React.useTransition()
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters")
      return
    }

    startTransition(async () => {
      const result = await signUpWithEmail(name, organization, email, password)

      if (result.error) {
        setFormError(result.error)
        toast.error(result.error)
        return
      }

      toast.success("Account created! Check your email to verify your account.")
      router.push("/login?message=check-email")
    })
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
                Create your account
              </h1>
              <p className="text-slate-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {formError && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Registration error
                  </p>
                  <p className="mt-0.5 text-xs text-red-400/70">{formError}</p>
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-slate-300"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    className="h-12 w-full rounded-xl border border-[#2a3f5f] bg-[#1a2942] pl-11 pr-4 text-white placeholder:text-slate-500 transition-all duration-200 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    disabled={pending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="organization"
                  className="text-sm font-medium text-slate-300"
                >
                  Organization Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="organization"
                    type="text"
                    placeholder="Enter your organization name"
                    className="h-12 w-full rounded-xl border border-[#2a3f5f] bg-[#1a2942] pl-11 pr-4 text-white placeholder:text-slate-500 transition-all duration-200 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    autoComplete="organization"
                    required
                    disabled={pending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="h-12 w-full rounded-xl border border-[#2a3f5f] bg-[#1a2942] px-4 text-white placeholder:text-slate-500 transition-all duration-200 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                    placeholder="Create a password (min 6 characters)"
                    className="h-12 w-full rounded-xl border border-[#2a3f5f] bg-[#1a2942] px-4 pr-12 text-white placeholder:text-slate-500 transition-all duration-200 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
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

              <Button
                type="submit"
                disabled={pending}
                className="h-12 w-full rounded-xl bg-cyan-500 font-semibold text-[#0B1527] shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:bg-cyan-400"
              >
                {pending ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0B1527]/30 border-t-[#0B1527]" />
                    Creating account...
                  </div>
                ) : (
                  "Create account"
                )}
              </Button>

              <p className="text-center text-xs text-slate-500">
                By signing up, you agree to our{" "}
                <Link
                  href="/terms"
                  className="text-cyan-400/70 hover:text-cyan-400"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-cyan-400/70 hover:text-cyan-400"
                >
                  Privacy Policy
                </Link>
              </p>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
