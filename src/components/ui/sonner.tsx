import { Toaster as Sonner } from "sonner";
// Glass toasts below the status bar (see .toast-glass and the safe-area rule in index.css).
export function Toaster({ theme }: { theme: "light" | "dark" }) {
  return <Sonner theme={theme} position="top-center" toastOptions={{ className: "toast-glass" }} />;
}
