import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const badgeVariants = cva("inline-flex items-center justify-center gap-1 rounded-lg px-2 h-6 type-label-m whitespace-nowrap shrink-0 [&>svg]:size-3.5", {
  variants: {
    variant: {
      default: "bg-primary text-on-primary",
      secondary: "bg-secondary-container text-on-secondary-container",
      outline: "border border-outline-variant text-on-surface-variant",
      ok: "bg-success-container text-on-success-container",
      warn: "bg-warning-container text-on-warning-container",
      bad: "bg-error-container text-on-error-container",
      gold: "bg-tertiary-container text-on-tertiary-container",
      muted: "bg-surface-container-highest text-on-surface-variant",
    },
  },
  defaultVariants: { variant: "default" },
});
function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
