import { Toaster as Sonner } from "sonner";
// M3 snackbars on the inverse surface, just above the navigation bar (see .m3-snack in index.css); rewards use .m3-reward.
export function Toaster({ theme }: { theme: "light" | "dark" }) {
  return <Sonner theme={theme} position="bottom-center" gap={8} toastOptions={{ className: "m3-snack" }} />;
}
