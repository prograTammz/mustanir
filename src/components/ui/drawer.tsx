import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

// M3 modal bottom sheet: surface-container-low, 28 dp top corners, the drag handle.
function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) { return <DrawerPrimitive.Root data-slot="drawer" {...props} />; }
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerClose = DrawerPrimitive.Close;
function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim/40" />
      <DrawerPrimitive.Content data-slot="drawer-content" className={cn("fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-surface-container-low text-on-surface outline-none", className)} {...props}>
        <div aria-hidden className="mx-auto mt-4 mb-2 h-1 w-8 shrink-0 rounded-full bg-on-surface-variant/40" />
        <div className="overflow-y-auto px-6 pb-safe">{children}</div>
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-1 pt-2 pb-4", className)} {...props} />; }
function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) { return <DrawerPrimitive.Title className={cn("type-headline-s em", className)} {...props} />; }
function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) { return <DrawerPrimitive.Description className={cn("text-on-surface-variant type-body-m", className)} {...props} />; }
export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription };
