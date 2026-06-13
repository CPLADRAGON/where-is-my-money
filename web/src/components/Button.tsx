import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "tertiary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)]";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-active",
  secondary: "bg-canvas-soft text-ink hover:bg-hairline",
  tertiary: "bg-canvas text-ink border border-ink hover:bg-canvas-soft",
  ghost: "bg-transparent text-body hover:bg-canvas-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-[var(--radius-md)]",
  md: "h-11 px-5 text-base rounded-[var(--radius-xl)]",
  lg: "h-13 px-7 text-lg rounded-[var(--radius-xl)]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
