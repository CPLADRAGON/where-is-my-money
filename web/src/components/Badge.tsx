import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "rule" | "learned" | "manual" | "default" | "positive" | "negative" | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas-soft text-body",
  rule: "bg-primary-pale text-ink-deep",
  learned: "bg-[color-mix(in_srgb,var(--color-accent-cyan)_25%,white)] text-ink-deep",
  manual: "bg-primary text-on-primary",
  default: "bg-[color-mix(in_srgb,var(--color-accent-orange)_45%,white)] text-ink-deep",
  positive: "bg-[color-mix(in_srgb,var(--color-positive)_18%,white)] text-positive-deep",
  negative: "bg-[color-mix(in_srgb,var(--color-negative)_18%,white)] text-negative-deep",
  warning: "bg-[color-mix(in_srgb,var(--color-warning)_30%,white)] text-warning-deep",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
