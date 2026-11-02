import * as React from "react";
import { cn } from "@/lib/utils";
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("flex field-sizing-content min-h-24 w-full rounded-t-xl rounded-b-[4px] border-0 border-b border-on-surface-variant bg-surface-container-highest px-4 py-3 type-body-l text-on-surface outline-none placeholder:text-on-surface-variant/70 focus-visible:border-primary focus-visible:shadow-[inset_0_-1px_0_var(--md-sys-color-primary)] focus-visible:outline-none", className)} {...props} />;
}
export { Textarea };
