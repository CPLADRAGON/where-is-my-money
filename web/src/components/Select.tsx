import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-10 rounded-[var(--radius-md)] border border-hairline bg-canvas px-3 text-sm font-medium text-ink",
      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ink)]",
      "disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Select.displayName = "Select";
