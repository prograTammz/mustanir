import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root data-slot="checkbox" className={cn("peer size-6 shrink-0 rounded-full border-[1.5px] border-input bg-background transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-ok data-[state=checked]:bg-ok data-[state=checked]:text-white", className)} {...props}>
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center"><CheckIcon className="size-4" strokeWidth={3} /></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
export { Checkbox };
