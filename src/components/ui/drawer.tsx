import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";
function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) { return <DrawerPrimitive.Root data-slot="drawer" {...props} />; }
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerClose = DrawerPrimitive.Close;
function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <DrawerPrimitive.Content data-slot="drawer-content" className={cn("fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[28px] border-t bg-background outline-none", className)} {...props}>
        <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <div className="overflow-y-auto px-5 pb-safe">{children}</div>
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-1 pt-3 pb-4", className)} {...props} />; }
function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) { return <DrawerPrimitive.Title className={cn("text-xl font-bold tracking-tight", className)} {...props} />; }
function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) { return <DrawerPrimitive.Description className={cn("text-muted-foreground text-sm", className)} {...props} />; }
export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription };
