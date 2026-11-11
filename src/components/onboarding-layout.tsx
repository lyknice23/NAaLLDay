import type { ReactNode } from "react";

const STEPS = ["Terms", "About you", "Roles"] as const;

export function OnboardingLayout({
  step,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  step: 1 | 2 | 3;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-10 sm:py-16">
      <p className="text-sm font-medium tracking-wide text-primary">ALL DAY NA</p>
      <div className="mt-6 flex gap-2" aria-label={`Step ${step} of 3`}>
        {STEPS.map((label, index) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded-full ${index < step ? "bg-primary" : "bg-border"}`}
            />
            <p
              className={`mt-2 text-xs ${index + 1 === step ? "text-fg" : "text-muted"}`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm font-medium text-primary">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-fg">{title}</h1>
      {subtitle ? (
        <p className="mt-3 text-base leading-relaxed text-muted">{subtitle}</p>
      ) : null}
      <div className="mt-8">{children}</div>
    </main>
  );
}
