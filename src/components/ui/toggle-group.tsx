import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";
// M3 Expressive connected button group: inner corners small, outer round; the selected button turns fully round.
function ToggleGroup({ className, children, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root data-slot="toggle-group" className={cn("flex w-full items-center gap-0.5", className)} {...props}>{children}</ToggleGroupPrimitive.Root>;
}
function ToggleGroupItem({ className, children, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item data-slot="toggle-group-item" className={cn("m3-btn state inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 px-3 type-label-l whitespace-nowrap bg-surface-container-highest text-on-surface-variant [--r:8px] [--rp:6px] first:[--r:999px_8px_8px_999px] last:[--r:8px_999px_999px_8px] data-[state=on]:bg-secondary-container data-[state=on]:text-on-secondary-container data-[state=on]:[--r:999px] [&_svg]:size-[18px]", className)} {...props}>{children}</ToggleGroupPrimitive.Item>;
}
export { ToggleGroup, ToggleGroupItem };
