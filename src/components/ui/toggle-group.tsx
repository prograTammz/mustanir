import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";
function ToggleGroup({ className, children, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root data-slot="toggle-group" className={cn("bg-muted flex w-full items-center rounded-full p-1", className)} {...props}>{children}</ToggleGroupPrimitive.Root>;
}
function ToggleGroupItem({ className, children, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item data-slot="toggle-group-item" className={cn("inline-flex h-8 flex-1 items-center justify-center rounded-full px-3 text-[13px] font-semibold whitespace-nowrap text-muted-foreground transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:bg-secondary", className)} {...props}>{children}</ToggleGroupPrimitive.Item>;
}
export { ToggleGroup, ToggleGroupItem };
