// The oath of office: sign in or create the account that syncs phone, laptop and Apple Health.
import { useState } from "react";
import { S } from "@/lib/logic.js";
import { LS, signIn, signUp, load, saveSettings } from "@/lib/store.js";
import { Ar, Emblem } from "@/components/kit";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="flex min-h-[78dvh] flex-col justify-center py-8">
      <Card>
        <CardContent className="flex flex-col items-center gap-2 pt-2 text-center">
          <Emblem k="president" size={64} />
          <Ar className="mt-3 font-[family-name:var(--font-quran)] text-2xl text-gold">بسم الله الرحمن الرحيم</Ar>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Take the oath of office</h1>
          <p className="text-[14px] text-muted-foreground">One account keeps your record synced between your phone, laptop and Apple Health.</p>
          <form className="mt-4 flex w-full flex-col gap-3 text-left" onSubmit={(ev) => { ev.preventDefault(); go(false); }}>
            <div className="grid gap-1.5"><Label htmlFor="a-email">Email</Label><Input id="a-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="a-pass">Password</Label><Input id="a-pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
            <Button type="submit" size="lg" disabled={busy} className="mt-2">Enter the palace</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => go(true)}>First time? Create account</Button>
            {msg && <p className="text-center text-sm text-muted-foreground" role="status">{msg}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
