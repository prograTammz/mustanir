import * as React from "react";
import { cn } from "@/lib/utils";
// M3 filled text field: a tonal container with an indicator line that thickens and turns primary on focus.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn("flex h-12 w-full min-w-0 rounded-t-xl rounded-b-[4px] border-0 border-b border-on-surface-variant bg-surface-container-highest px-4 type-body-l text-on-surface outline-none transition-[border-color,box-shadow] placeholder:text-on-surface-variant/70 focus-visible:border-primary focus-visible:shadow-[inset_0_-1px_0_var(--md-sys-color-primary)] focus-visible:outline-none disabled:opacity-40", className)} {...props} />;
}
export { Input };
