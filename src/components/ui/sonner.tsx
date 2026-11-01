import { Toaster as Sonner } from "sonner";
// Glass toasts just above the tab bar (see .toast-glass and the safe-area rule in index.css).
export function Toaster({ theme }: { theme: "light" | "dark" }) {
  return <Sonner theme={theme} position="bottom-center" toastOptions={{ className: "toast-glass" }} />;
}
