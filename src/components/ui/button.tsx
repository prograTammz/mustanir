import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// M3 Expressive common buttons: filled, tonal, outlined, text; the corners morph on press (see .m3-btn).
const buttonVariants = cva(
  "m3-btn state inline-flex items-center justify-center gap-2 whitespace-nowrap select-none shrink-0 outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary",
        destructive: "bg-error text-on-error",
        outline: "border border-outline-variant text-on-surface-variant",
        secondary: "bg-secondary-container text-on-secondary-container",
        ghost: "text-primary",
        link: "text-primary underline-offset-4 hover:underline",
        gold: "bg-tertiary text-on-tertiary",
      },
      size: {
        default: "h-10 px-5 type-label-l [--rp:8px]",
        sm: "h-8 px-3 type-label-l [--rp:8px]",
        lg: "h-14 px-6 type-title-m [--rp:12px]",
        icon: "size-10 [--rp:12px]",
        "icon-sm": "size-8 [--rp:10px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
export { Button, buttonVariants };
