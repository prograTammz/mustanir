// A minimal Supabase Realtime client (the Phoenix protocol, ~2 kB) instead of the 25 kB SDK: one websocket, one channel,
// Postgres changes on your own rows only (row-level security applies to what the server sends).
// Status: "connecting" → "live", or "offline" while it backs off and retries.
export function connectRealtime({ url, apikey, token, tables, onChange, onStatus }) {
  let ws = null, ref = 0, joinRef = null, beat = 0, retry = 0, closed = false, timer = 0;
  const topic = "realtime:mustanir";
  const msg = (t, event, payload, extra = {}) => JSON.stringify({ topic: t, event, payload, ref: String(++ref), ...extra });
  const status = (s) => onStatus?.(s);

  async function open() {
    if (closed) return;
    clearTimeout(timer);
    status("connecting");
    let access;
    try { access = await token(); } catch { return later(); }
    ws = new WebSocket(url.replace(/^http/, "ws") + "/realtime/v1/websocket?apikey=" + encodeURIComponent(apikey) + "&vsn=1.0.0");
    ws.onopen = () => {
      joinRef = String(++ref);
      ws.send(JSON.stringify({
        topic, event: "phx_join", ref: joinRef, join_ref: joinRef,
        payload: { config: { broadcast: { self: false }, presence: { key: "" }, postgres_changes: tables.map((t) => ({ event: "*", schema: "public", ...t })) }, access_token: access },
      }));
      clearInterval(beat);
      beat = setInterval(() => ws?.readyState === 1 && ws.send(msg("phoenix", "heartbeat", {})), 25000);
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.event === "phx_reply" && m.ref === joinRef) { if (m.payload?.status === "ok") { retry = 0; status("live"); } else { status("offline"); ws.close(); } }
      else if (m.event === "postgres_changes" && m.payload?.data) onChange(m.payload.data);
      else if (m.event === "system" && m.payload?.status === "error") status("offline");
      else if ((m.event === "phx_error" || m.event === "phx_close") && m.topic === topic) ws.close();
    };
    ws.onclose = () => { clearInterval(beat); ws = null; if (!closed) later(); };
    ws.onerror = () => {};
  }
  function later() { status("offline"); clearTimeout(timer); timer = setTimeout(open, Math.min(30000, 1000 * 2 ** retry++)); }

  open();
  return {
    /** After the session refreshes, hand the channel the new token so row-level security keeps matching. */
    setToken(t) { if (ws?.readyState === 1 && joinRef) ws.send(msg(topic, "access_token", { access_token: t }, { join_ref: joinRef })); },
    /** Coming back from the background: iOS drops idle sockets, so reconnect at once instead of waiting out the backoff. */
    wake() { if (!ws || ws.readyState > 1) { retry = 0; open(); } },
    close() { closed = true; clearTimeout(timer); clearInterval(beat); ws?.close(); },
  };
}
