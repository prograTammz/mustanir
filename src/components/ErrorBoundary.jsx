// Anything that throws while rendering lands here: say so, with a way back, rather than leaving a blank page.
import { Component } from "react";
import { Button } from "@/components/m3/index.jsx";

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch() { window.__mustanirReady?.(); } // the app never lifted the boot screen, so lift it here
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="type-headline-s em">Something went wrong</h1>
        <p className="type-body-m text-on-surface-variant">The app hit an error and stopped. What has synced is safe. Reload to try again.</p>
        <Button size="m" className="w-full" onClick={() => window.__mustanirReload()}>Reload</Button>
        <p className="type-label-s text-on-surface-variant [overflow-wrap:anywhere]">{String(this.state.error?.message || this.state.error)}</p>
      </div>
    );
  }
}
