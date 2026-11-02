// The oath of office: sign in or create the account that syncs phone and laptop.
import { useState } from "react";
import { S } from "@/lib/logic.js";
import { LS, signIn, signUp, load, saveSettings } from "@/lib/store.js";
import { Ar, Astrolabe, Embers, Hero } from "@/components/kit";
import { Shape, Button } from "@/components/m3/index.jsx";
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
    <div className="flex flex-col gap-4 pb-8">
      <Hero oath className="flex flex-col items-center gap-3 text-center">
        <Embers />
        <div className="relative">
          <Astrolabe className="top-1/2 left-1/2 size-[270px] -translate-x-1/2 -translate-y-1/2" />
          <Shape name="verySunny" size={112} spin color="var(--md-sys-color-on-primary-fixed)" className="pop relative">
            <svg viewBox="0 0 100 100" className="size-14" aria-hidden="true"><g fill="none" stroke="var(--md-sys-color-tertiary)" strokeWidth="6.5" strokeLinejoin="round"><rect x="21" y="21" width="58" height="58" rx="5"/><rect x="21" y="21" width="58" height="58" rx="5" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="8.5" fill="var(--md-sys-color-tertiary)"/></svg>
          </Shape>
        </div>
        <Ar className="mt-[68px] text-[34px] text-tertiary">المُستنير</Ar>
        <h1 className="type-headline-s em">Take the oath of office</h1>
        <p className="max-w-[280px] type-body-m text-on-surface-variant">Sign in to keep your record, your level and your medals in sync on every device.</p>
      </Hero>
      <form className="flex w-full flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); go(false); }}>
        <div className="grid gap-1.5"><Label htmlFor="a-email">Email</Label><Input id="a-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="a-pass">Password</Label><Input id="a-pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
        <Button type="submit" size="m" disabled={busy} className="mt-2 w-full" onClick={undefined}>Sign in</Button>
        <Button variant="text" disabled={busy} className="w-full" onClick={() => go(true)}>Create an account</Button>
        {msg && <p className="text-center type-body-m text-on-surface-variant" role="status">{msg}</p>}
      </form>
    </div>
  );
}
