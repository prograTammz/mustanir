// The oath of office: sign in or create the account that syncs phone and laptop.
import { useState } from "react";
import { S } from "@/lib/logic.js";
import { LS, signIn, signUp, load, saveSettings } from "@/lib/store.js";
import { Ar } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignIn() {
  const [email, setEmail] = useState(LS.get("a2-email", "")), [pass, setPass] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const go = async (create) => {
    const e = email.trim();
    LS.set("a2-email", e);
    if (!e || pass.length < 8) return setMsg("Enter your email and a password of at least 8 characters.");
    setBusy(true); setMsg(create ? "Creating your account…" : "Signing in…");
    try {
      if (create) { if (!(await signUp(e, pass))) { setBusy(false); return setMsg("Check your email and tap the confirmation link, then come back and sign in."); } }
      else await signIn(e, pass);
      S.loaded = false; setMsg(""); await load(); saveSettings();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  };
  return (
    <div className="flex min-h-[86dvh] flex-col justify-center gap-8 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-20 place-items-center rounded-[26%] bg-[#0F4A3C]">
          <svg viewBox="0 0 512 512" className="size-14" aria-hidden="true">
            <g fill="#D6AF5F"><rect x="125" y="125" width="262" height="262" /><rect x="125" y="125" width="262" height="262" transform="rotate(45 256 256)" /></g>
            <circle cx="256" cy="256" r="96" fill="#0F4A3C" />
            <path fill="#D6AF5F" d="M256 178L262.1 241.2L295.6 216.4L270.8 249.9L334 256L270.8 262.1L295.6 295.6L262.1 270.8L256 334L249.9 270.8L216.4 295.6L241.2 262.1L178 256L241.2 249.9L216.4 216.4L249.9 241.2Z" />
            <circle cx="256" cy="256" r="24" fill="#0F4A3C" /><circle cx="256" cy="256" r="16" fill="#D6AF5F" />
          </svg>
        </span>
        <Ar className="mt-2 text-[26px] text-gold">المُستنير</Ar>
        <p className="max-w-[260px] text-[14px] text-muted-foreground">Sign in to keep your record in sync on every device.</p>
      </div>
      <form className="flex w-full flex-col gap-3" onSubmit={(ev) => { ev.preventDefault(); go(false); }}>
        <div className="grid gap-1.5"><Label htmlFor="a-email">Email</Label><Input id="a-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="a-pass">Password</Label><Input id="a-pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
        <Button type="submit" size="lg" disabled={busy} className="mt-2 h-12 rounded-full">Sign in</Button>
        <Button type="button" variant="ghost" disabled={busy} className="rounded-full" onClick={() => go(true)}>Create an account</Button>
        {msg && <p className="text-center text-sm text-muted-foreground" role="status">{msg}</p>}
      </form>
    </div>
  );
}
