import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileDown,
  FileUp,
  ScanLine,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Attendify — Smart Attendance Tracker",
  description:
    "Auto-track your classes and know exactly how many lectures you can safely miss.",
};

const features = [
  {
    icon: FileUp,
    title: "Upload your timetable",
    description: "Drop in a photo or PDF. AI turns it into a clean class schedule.",
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  {
    icon: CheckCircle2,
    title: "Auto-mark attendance",
    description: "Keep your record current in seconds, without the spreadsheet shuffle.",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  {
    icon: Target,
    title: "Safe-to-miss calculator",
    description: "See your attendance runway before you decide to skip a class.",
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  {
    icon: CalendarDays,
    title: "Calendar with holidays",
    description: "Plan around breaks, holidays, and your real academic calendar.",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  {
    icon: BellRing,
    title: "Low attendance alerts",
    description: "Get a nudge while there is still time to turn things around.",
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  {
    icon: FileDown,
    title: "Export when you need it",
    description: "Take your record with you as a neat CSV or PDF.",
    accent: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  },
];

const week = [
  { day: "Mon", date: "16", classes: ["DSA", "Maths"] },
  { day: "Tue", date: "17", classes: ["Networks"] },
  { day: "Wed", date: "18", classes: ["DBMS", "OS"] },
  { day: "Thu", date: "19", classes: ["Maths"] },
  { day: "Fri", date: "20", classes: ["DSA", "Networks"] },
];

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[32rem] bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--primary)_10%,transparent),transparent_68%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a href="/" className="flex min-h-11 items-center gap-2.5" aria-label="Attendify home">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#1a1a1a] text-lg font-bold text-white shadow-sm dark:bg-white dark:text-[#1a1a1a]">
            A
          </span>
          <span className="text-[1.05rem] font-semibold tracking-[-0.03em]">Attendify</span>
        </a>
        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Account">
          <Button asChild variant="ghost" size="default" className="px-3 sm:px-4">
            <a href="/auth">Log in</a>
          </Button>
          <Button asChild size="default" className="px-4 shadow-sm sm:px-5">
            <a href="/auth">Sign up</a>
          </Button>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-10 lg:pb-32 lg:pt-24">
        <div className="max-w-xl">
          <Badge variant="secondary" className="mb-6 gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3.5" />
            Attendance, without the guesswork
          </Badge>
          <h1 className="max-w-[10ch] text-[clamp(2.8rem,12vw,5.75rem)] font-semibold leading-[0.96] tracking-[-0.065em] text-foreground">
            Never guess your attendance again
          </h1>
          <p className="mt-7 max-w-[34rem] text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Auto-tracks your classes, tells you how many you can safely miss.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-xl px-6 text-[0.95rem] shadow-lg shadow-primary/15">
              <a href="/auth">
                Get Started
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-xl px-6 text-[0.95rem]">
              <a href="/auth">Log in</a>
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="size-3.5 text-emerald-500" />
            Free to get started · Made for real student schedules
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
          <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-primary/[0.045] blur-2xl" />
          <Card className="overflow-visible rounded-[1.6rem] border-0 bg-card/95 p-2 shadow-2xl shadow-slate-900/10 ring-1 ring-foreground/10 backdrop-blur-sm dark:shadow-black/30">
            <div className="rounded-[1.15rem] bg-muted/45 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    This week
                  </div>
                  <p className="mt-2 text-lg font-semibold tracking-tight">Your attendance, clear at a glance</p>
                </div>
                <Badge variant="outline" className="rounded-full bg-background/70 px-2.5 py-1 text-[0.68rem]">
                  <ScanLine className="mr-1 size-3" />
                  Live
                </Badge>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2">
                {week.map((item, index) => (
                  <div key={item.day} className="min-w-0">
                    <div className="mb-2 text-center">
                      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{item.day}</p>
                      <p className={`mt-1 text-sm font-semibold ${index === 2 ? "text-primary" : ""}`}>{item.date}</p>
                    </div>
                    <div className={`min-h-[8.5rem] rounded-xl border p-1.5 sm:p-2 ${index === 2 ? "border-primary/30 bg-primary/[0.08]" : "border-border/70 bg-background/70"}`}>
                      <div className="space-y-1.5">
                        {item.classes.map((className, classIndex) => (
                          <div key={className} className="rounded-lg bg-background px-1.5 py-2 shadow-sm sm:px-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-[0.64rem] font-semibold sm:text-xs">{className}</span>
                              <span className={`size-1.5 shrink-0 rounded-full ${classIndex === 1 ? "bg-amber-400" : "bg-emerald-500"}`} />
                            </div>
                            <p className="mt-1 hidden text-[0.58rem] text-muted-foreground sm:block">
                              {classIndex === 1 ? "10:00 AM" : "09:00 AM"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                    <Target className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Overall attendance</p>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">You&apos;re in a safe zone</p>
                  </div>
                </div>
                <p className="text-xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-300">86.4%</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[0.65rem] text-muted-foreground sm:px-4">
              <span className="flex items-center gap-1.5"><Clock3 className="size-3" /> Updated just now</span>
              <span className="flex items-center gap-1 font-medium text-foreground">View details <ChevronRight className="size-3" /></span>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/25 px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Everything in one place</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Less admin. More time for the things that count.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="rounded-2xl border-0 bg-background/75 shadow-sm ring-1 ring-foreground/[0.08] transition-transform duration-200 hover:-translate-y-1">
                  <CardHeader className="gap-4 pb-2">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${feature.accent}`}>
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-[1rem]">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-[0.9rem] leading-6">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24">
            <div>
              <p className="text-sm font-semibold text-primary">Three simple steps</p>
              <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Set it up once. Stay on top all semester.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
                Attendify turns the messy parts of attendance into a quiet background process.
              </p>
            </div>
            <div className="divide-y divide-border/70 border-y border-border/70">
              {[
                { icon: Upload, title: "Upload timetable", text: "Share a timetable photo or PDF and let AI map your classes." },
                { icon: CalendarDays, title: "Add holidays", text: "Mark breaks and holidays so your numbers reflect reality." },
                { icon: CheckCircle2, title: "Track automatically", text: "Mark classes as you go and see your safe-to-miss number update." },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-5 py-6 sm:gap-7 sm:py-7">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4 text-primary" />
                        <h3 className="font-semibold">{step.title}</h3>
                      </div>
                      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{step.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-[1.75rem] bg-[#1a1a1a] px-6 py-10 text-white dark:bg-white dark:text-[#1a1a1a] sm:px-10 sm:py-12 lg:flex-row lg:items-center">
          <div>
            <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Know where you stand before the semester runs away.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/65 dark:text-[#1a1a1a]/65">A calmer way to keep your attendance on track.</p>
          </div>
          <Button asChild size="lg" className="h-12 shrink-0 rounded-xl bg-white px-6 text-[#1a1a1a] hover:bg-white/90 dark:bg-[#1a1a1a] dark:text-white dark:hover:bg-[#1a1a1a]/90">
            <a href="/auth">Get Started <ArrowRight className="size-4" /></a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/70 px-5 py-7 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Made for students by Rohit</p>
          <a href="/auth" className="flex min-h-11 items-center gap-1 font-medium text-foreground transition-colors hover:text-primary">
            Start tracking <ArrowRight className="size-3.5" />
          </a>
        </div>
      </footer>
    </main>
  );
}
