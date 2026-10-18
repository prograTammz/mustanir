import { Toaster as Sonner } from "sonner";
export function Toaster({ theme }: { theme: "light" | "dark" }) {
  return <Sonner theme={theme} position="top-center" offset={60} toastOptions={{ classNames: { toast: "!rounded-2xl !border-border !bg-popover !text-popover-foreground !shadow-lg" } }} />;
}
