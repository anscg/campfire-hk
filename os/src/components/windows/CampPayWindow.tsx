"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuthStore } from "@/stores/authStore";

// ============================================================
// QR code icon (inline SVG)
// ============================================================

function QRIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="7" height="7" stroke="rgb(161,161,170)" strokeWidth="1.5" fill="none"/>
      <rect x="3.5" y="3.5" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="12" y="1" width="7" height="7" stroke="rgb(161,161,170)" strokeWidth="1.5" fill="none"/>
      <rect x="14.5" y="3.5" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="1" y="12" width="7" height="7" stroke="rgb(161,161,170)" strokeWidth="1.5" fill="none"/>
      <rect x="3.5" y="14.5" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="12" y="12" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="15" y="12" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="18" y="12" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="12" y="15" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="15" y="15" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="18" y="15" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="12" y="18" width="2" height="2" fill="rgb(161,161,170)"/>
      <rect x="18" y="18" width="2" height="2" fill="rgb(161,161,170)"/>
    </svg>
  );
}

// ============================================================
// Camera QR scanner component
// ============================================================

interface QRScannerProps {
  onDetected: (url: string) => void;
  onCancel: () => void;
}

function QRScanner({ onDetected, onCancel }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        scan();
      } catch {
        setError("Camera access denied or unavailable.");
      }
    }

    async function scan() {
      const jsQR = (await import("jsqr")).default;
      function tick() {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !active || detectedRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code?.data) {
            detectedRef.current = true;
            stopStream();
            onDetected(code.data);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function stopStream() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    start();

    return () => {
      active = false;
      stopStream();
    };
  }, [onDetected]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-400 text-xs">{error}</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold tracking-widest border border-zinc-600 text-zinc-300"
          style={{ cursor: "pointer" }}
        >
          CANCEL
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ display: "block" }}
      />
      {/* Hidden canvas used for frame analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay — targeting reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-52 h-52">
          {/* Corner marks */}
          {[
            "top-0 left-0 border-t-2 border-l-2",
            "top-0 right-0 border-t-2 border-r-2",
            "bottom-0 left-0 border-b-2 border-l-2",
            "bottom-0 right-0 border-b-2 border-r-2",
          ].map((cls, i) => (
            <span key={i} className={`absolute w-6 h-6 border-yellow-400 ${cls}`} />
          ))}
        </div>
      </div>

      {/* Cancel button */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-auto">
        <button
          onClick={onCancel}
          className="px-5 py-2 text-xs font-bold tracking-widest border border-zinc-500 text-zinc-300"
          style={{ background: "rgba(0,0,0,0.7)", cursor: "pointer" }}
        >
          CANCEL
        </button>
      </div>

      {/* Scanning hint */}
      <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
        <p className="text-xs text-zinc-300 tracking-widest px-3 py-1" style={{ background: "rgba(0,0,0,0.6)" }}>
          POINT AT QR CODE
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Types
// ============================================================

interface PayUser {
  _id: string;
  displayName: string;
  xp: number;
}

interface QRRequest {
  token: string;
  url: string;
}

interface IncomingRequest {
  token: string;
  requesterName: string;
  amount: number;
  note: string;
  paid: boolean;
}

// ============================================================
// CampPay Window — Send XP or receive via QR code
// ============================================================

export default function CampPayWindow() {
  const { user, token } = useAuthStore();
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

  const [tab, setTab] = useState<"send" | "receive">("send");

  // ─── Send state ──────────────────────────────────────────────
  const [users, setUsers] = useState<PayUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<PayUser | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // ─── Pay-incoming state (scanning someone else's QR) ─────────
  const [scanView, setScanView] = useState<"idle" | "camera" | "confirm" | "done">("idle");
  const [scanToken, setScanToken] = useState("");
  const [scanRequest, setScanRequest] = useState<IncomingRequest | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // ─── Receive state ───────────────────────────────────────────
  const [qrRequest, setQRRequest] = useState<QRRequest | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [receiveNote, setReceiveNote] = useState("");
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receivePaid, setReceivePaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── On mount: check for incoming QR token from URL scan ─────
  useEffect(() => {
    const incoming = sessionStorage.getItem("camppay_incoming_token");
    if (incoming) {
      sessionStorage.removeItem("camppay_incoming_token");
      setScanToken(incoming);
      setScanView("confirm");
      loadScanRequest(incoming);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load scan request details ───────────────────────────────
  const loadScanRequest = async (t: string) => {
    setScanLoading(true);
    setScanError(null);
    try {
      const res = await fetch(`${serverUrl}/api/pay/qr/${t}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request not found");
      if (data.paid) throw new Error("This payment request has already been paid");
      setScanRequest(data);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to load request");
      setScanView("confirm"); // stay on confirm, error shown there
    } finally {
      setScanLoading(false);
    }
  };

  const handleScanPay = async () => {
    if (!scanRequest) return;
    setScanLoading(true);
    setScanError(null);
    try {
      const res = await fetch(`${serverUrl}/api/pay/qr/${scanRequest.token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      setScanView("done");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setScanLoading(false);
    }
  };

  const resetScan = () => {
    setScanView("idle");
    setScanToken("");
    setScanRequest(null);
    setScanError(null);
  };

  // ─── Load users for send ─────────────────────────────────────
  const loadUsers = useCallback(async () => {
    if (!token) return;
    setUsersLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/pay/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers((data as PayUser[]).filter((u) => u._id !== user?._id));
    } catch {
      // silently ignore
    } finally {
      setUsersLoading(false);
    }
  }, [token, serverUrl, user?._id]);

  useEffect(() => {
    if (tab === "send") loadUsers();
  }, [tab, loadUsers]);

  // ─── Send XP ─────────────────────────────────────────────────
  const handleSend = async () => {
    if (!selectedUser || !amount) return;
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt <= 0) { setSendError("Enter a valid amount"); return; }
    setSendLoading(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch(`${serverUrl}/api/pay/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId: selectedUser._id, amount: amt, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");
      setSendSuccess(`Sent ${amt} XP to ${selectedUser.displayName}`);
      setSelectedUser(null);
      setAmount("");
      setNote("");
      setSearch("");
      loadUsers();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSendLoading(false);
    }
  };

  // ─── Generate QR ─────────────────────────────────────────────
  const handleCreateQR = async () => {
    const amt = parseInt(receiveAmount, 10);
    if (isNaN(amt) || amt <= 0) { setReceiveError("Enter a valid amount"); return; }
    setReceiveLoading(true);
    setReceiveError(null);
    setReceivePaid(false);
    try {
      const res = await fetch(`${serverUrl}/api/pay/qr/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, note: receiveNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create QR");
      setQRRequest(data);
      startPolling(data.token);
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : "Failed to create QR");
    } finally {
      setReceiveLoading(false);
    }
  };

  const startPolling = (t: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${serverUrl}/api/pay/qr/${t}`);
        const data = await res.json();
        if (data.paid) {
          setReceivePaid(true);
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch { /* silently ignore */ }
    }, 2000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Stop polling when leaving the receive tab
  useEffect(() => {
    if (tab !== "receive" && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [tab]);

  const resetReceive = () => {
    setQRRequest(null);
    setReceiveAmount("");
    setReceiveNote("");
    setReceivePaid(false);
    setReceiveError(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const filteredUsers = users.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase())
  );

  // ─── If an incoming QR scan is active, show it full-screen ───
  if (scanView !== "idle") {
    return (
      <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700 flex-shrink-0">
          <button
            onClick={resetScan}
            className="text-xs text-zinc-400 border border-zinc-600 px-2 py-1"
            style={{ cursor: "pointer" }}
          >
            ← Back
          </button>
          <span className="text-xs text-zinc-500 tracking-widest">PAY QR CODE</span>
        </div>

        {scanView === "camera" && (
          <QRScanner
            onDetected={(url) => {
              // Extract ?pay=TOKEN from scanned URL
              try {
                const u = new URL(url);
                // Support both ?pay=TOKEN and #camppay?pay=TOKEN formats
                const hashQuery = u.hash.includes("?") ? u.hash.split("?")[1] : "";
                const params = new URLSearchParams(u.search || hashQuery);
                const t = params.get("pay");
                if (t) {
                  setScanToken(t);
                  setScanView("confirm");
                  loadScanRequest(t);
                } else {
                  setScanError("Invalid QR code — not a CampPay request");
                  setScanView("confirm");
                }
              } catch {
                setScanError("Could not read QR code");
                setScanView("confirm");
              }
            }}
            onCancel={resetScan}
          />
        )}

        {scanView === "confirm" && (
          <div className="flex-1 flex flex-col p-4 gap-3">
            {scanLoading ? (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
                Loading...
              </div>
            ) : scanRequest ? (
              <>
                <div className="bg-zinc-800 border border-zinc-700 p-4">
                  <p className="text-xs text-zinc-500 mb-1">PAYING TO</p>
                  <p className="text-sm font-bold text-white">{scanRequest.requesterName}</p>
                </div>
                <div className="bg-zinc-800 border border-zinc-700 p-4 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 tracking-widest">AMOUNT</span>
                  <span className="text-2xl font-bold text-yellow-400">{scanRequest.amount} XP</span>
                </div>
                {scanRequest.note && (
                  <div className="bg-zinc-800 border border-zinc-700 px-4 py-3">
                    <p className="text-xs text-zinc-500 mb-1">NOTE</p>
                    <p className="text-sm text-zinc-300">{scanRequest.note}</p>
                  </div>
                )}
                {scanError && <p className="text-red-400 text-xs">{scanError}</p>}
                <button
                  onClick={handleScanPay}
                  disabled={scanLoading}
                  className="mt-auto w-full py-3 text-xs font-bold tracking-widest border"
                  style={{
                    background: "rgb(234,179,8)",
                    borderColor: "rgb(234,179,8)",
                    color: "rgb(0,0,0)",
                    cursor: scanLoading ? "not-allowed" : "pointer",
                    opacity: scanLoading ? 0.6 : 1,
                  }}
                >
                  {scanLoading ? "PAYING..." : `CONFIRM PAYMENT · ${scanRequest.amount} XP`}
                </button>
              </>
            ) : (
              <>
                {scanError && <p className="text-red-400 text-xs">{scanError}</p>}
                <button
                  onClick={resetScan}
                  className="mt-auto w-full py-3 text-xs font-bold tracking-widest border border-zinc-600 text-zinc-300"
                >
                  CANCEL
                </button>
              </>
            )}
          </div>
        )}

        {scanView === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <p className="text-4xl">✓</p>
            <p className="text-sm font-bold text-green-400 tracking-widest">PAYMENT SENT</p>
            {scanRequest && (
              <p className="text-xs text-zinc-500 text-center">
                {scanRequest.amount} XP sent to {scanRequest.requesterName}
                {scanRequest.note ? ` · ${scanRequest.note}` : ""}
              </p>
            )}
            <button
              onClick={resetScan}
              className="mt-4 px-6 py-2 text-xs font-bold tracking-widest border border-zinc-600 text-zinc-300"
              style={{ cursor: "pointer" }}
            >
              DONE
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // Main UI (Send / Receive tabs)
  // ============================================================

  return (
    <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden relative">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-700 flex-shrink-0">
        {(["send", "receive"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSendError(null); setSendSuccess(null); }}
            className="flex-1 py-2.5 text-xs font-bold tracking-widest border-r border-zinc-700 last:border-r-0"
            style={{
              background: tab === t ? "rgb(234, 179, 8)" : "rgb(24, 24, 27)",
              color: tab === t ? "rgb(0,0,0)" : "rgb(161,161,170)",
              cursor: "pointer",
            }}
          >
            {t === "send" ? "SEND" : "RECEIVE"}
          </button>
        ))}
      </div>

      {/* Floating QR scan button — bottom-left */}
      <button
        onClick={() => setScanView("camera")}
        title="Pay a QR code"
        className="absolute bottom-4 left-4 w-11 h-11 border border-zinc-600 flex items-center justify-center z-10"
        style={{ background: "rgb(39,39,42)", cursor: "pointer" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgb(63,63,70)"; e.currentTarget.style.borderColor = "rgb(113,113,122)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgb(39,39,42)"; e.currentTarget.style.borderColor = "rgb(63,63,70)"; }}
      >
        <QRIcon />
      </button>

      {/* ─── SEND TAB ─────────────────────────────────────────── */}
      {tab === "send" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedUser ? (
            <div className="flex-1 flex flex-col p-4 gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => { setSelectedUser(null); setSendError(null); setSendSuccess(null); }}
                  className="text-xs text-zinc-400 border border-zinc-600 px-2 py-1"
                  style={{ cursor: "pointer" }}
                >
                  ← Back
                </button>
                <span className="text-xs text-zinc-500 tracking-widest">SEND XP</span>
              </div>

              <div className="bg-zinc-800 border border-zinc-700 p-3">
                <p className="text-xs text-zinc-500 mb-1">TO</p>
                <p className="text-sm font-bold text-white">{selectedUser.displayName}</p>
                <p className="text-xs text-zinc-500">{selectedUser.xp} XP</p>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1 tracking-widest">AMOUNT</label>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-800 border border-zinc-600 text-white text-lg px-3 py-2 outline-none"
                  style={{ fontFamily: "inherit" }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1 tracking-widest">NOTE (OPTIONAL)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Thanks for the help!"
                  maxLength={64}
                  className="w-full bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 outline-none"
                  style={{ fontFamily: "inherit" }}
                />
              </div>

              {sendError && <p className="text-red-400 text-xs">{sendError}</p>}
              {sendSuccess && <p className="text-green-400 text-xs">{sendSuccess}</p>}

              <button
                onClick={handleSend}
                disabled={sendLoading || !amount || parseInt(amount) <= 0}
                className="mt-auto w-full py-2.5 text-xs font-bold tracking-widest border"
                style={{
                  background: sendLoading || !amount || parseInt(amount) <= 0 ? "transparent" : "rgb(234, 179, 8)",
                  borderColor: sendLoading || !amount || parseInt(amount) <= 0 ? "rgb(63,63,70)" : "rgb(234,179,8)",
                  color: sendLoading || !amount || parseInt(amount) <= 0 ? "rgb(113,113,122)" : "rgb(0,0,0)",
                  cursor: sendLoading || !amount || parseInt(amount) <= 0 ? "not-allowed" : "pointer",
                }}
              >
                {sendLoading ? "SENDING..." : `SEND ${amount ? parseInt(amount) || "" : ""} XP`}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-zinc-700 flex-shrink-0">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search participants..."
                  className="w-full bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 outline-none"
                  style={{ fontFamily: "inherit" }}
                  autoFocus
                />
              </div>

              {sendSuccess && (
                <div className="mx-3 mt-2 p-2 border border-green-800 bg-green-950 text-green-400 text-xs flex-shrink-0">
                  {sendSuccess}
                </div>
              )}

              <div className="flex-1 overflow-auto">
                {usersLoading ? (
                  <div className="flex items-center justify-center h-16 text-zinc-500 text-xs">Loading...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex items-center justify-center h-16 text-zinc-600 text-xs">
                    {search ? "No match" : "No other participants yet"}
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => { setSelectedUser(u); setSendError(null); setSendSuccess(null); setAmount(""); setNote(""); }}
                      className="w-full flex items-center gap-3 px-4 border-b border-zinc-800 text-left"
                      style={{ height: 48, cursor: "pointer", background: "transparent" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgb(39,39,42)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{u.displayName}</p>
                      </div>
                      <p className="text-xs text-zinc-500 flex-shrink-0">{u.xp} XP</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── RECEIVE TAB ──────────────────────────────────────── */}
      {tab === "receive" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {receivePaid ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <p className="text-3xl">✓</p>
              <p className="text-sm font-bold text-green-400 tracking-widest">PAYMENT RECEIVED</p>
              <p className="text-xs text-zinc-500">
                {parseInt(receiveAmount)} XP received
                {receiveNote ? ` · ${receiveNote}` : ""}
              </p>
              <button
                onClick={resetReceive}
                className="mt-4 px-6 py-2 text-xs font-bold tracking-widest border border-zinc-600 text-zinc-300"
                style={{ cursor: "pointer" }}
              >
                NEW REQUEST
              </button>
            </div>
          ) : qrRequest ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
              <div className="flex items-center gap-2 self-start mb-2">
                <button
                  onClick={resetReceive}
                  className="text-xs text-zinc-400 border border-zinc-600 px-2 py-1"
                  style={{ cursor: "pointer" }}
                >
                  ← Cancel
                </button>
                <span className="text-xs text-zinc-500 tracking-widest">SCAN TO PAY</span>
              </div>

              <div
                className="border border-zinc-600 p-3 relative overflow-hidden"
                style={{ background: "rgb(255,255,255)" }}
              >
                {/* HDR video background — maximizes brightness on HDR displays */}
                <video
                  src="/superwhite.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ zIndex: 0 }}
                />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <QRCodeSVG
                    value={qrRequest.url}
                    size={180}
                    bgColor="transparent"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {parseInt(receiveAmount)} XP
                </p>
                {receiveNote && (
                  <p className="text-xs text-zinc-500 mt-1">{receiveNote}</p>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                Waiting for payment...
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-4 gap-3">
              <div className="bg-zinc-800 border border-zinc-700 p-3 flex-shrink-0">
                <p className="text-xs text-zinc-500">REQUESTING FROM</p>
                <p className="text-sm font-bold text-white mt-1">{user?.displayName}</p>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1 tracking-widest">AMOUNT TO REQUEST</label>
                <input
                  type="number"
                  min={1}
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-800 border border-zinc-600 text-white text-lg px-3 py-2 outline-none"
                  style={{ fontFamily: "inherit" }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1 tracking-widest">NOTE (OPTIONAL)</label>
                <input
                  type="text"
                  value={receiveNote}
                  onChange={(e) => setReceiveNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateQR()}
                  placeholder="For your bounty submission"
                  maxLength={64}
                  className="w-full bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 outline-none"
                  style={{ fontFamily: "inherit" }}
                />
              </div>

              {receiveError && <p className="text-red-400 text-xs">{receiveError}</p>}

              <button
                onClick={handleCreateQR}
                disabled={receiveLoading || !receiveAmount || parseInt(receiveAmount) <= 0}
                className="mt-auto w-full py-2.5 text-xs font-bold tracking-widest border"
                style={{
                  background: receiveLoading || !receiveAmount || parseInt(receiveAmount) <= 0 ? "transparent" : "rgb(234, 179, 8)",
                  borderColor: receiveLoading || !receiveAmount || parseInt(receiveAmount) <= 0 ? "rgb(63,63,70)" : "rgb(234,179,8)",
                  color: receiveLoading || !receiveAmount || parseInt(receiveAmount) <= 0 ? "rgb(113,113,122)" : "rgb(0,0,0)",
                  cursor: receiveLoading || !receiveAmount || parseInt(receiveAmount) <= 0 ? "not-allowed" : "pointer",
                }}
              >
                {receiveLoading ? "GENERATING..." : "GENERATE QR CODE"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
