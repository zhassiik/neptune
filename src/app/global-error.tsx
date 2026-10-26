"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="kk">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ color: "#0b1f47" }}>Күтпеген қате</h1>
          <p style={{ color: "#64748b" }}>Бетті жүктеу мүмкін болмады.</p>
          <button onClick={reset} style={{ background: "#2f7cf6", color: "#fff", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}>
            Қайталау
          </button>
        </div>
      </body>
    </html>
  );
}
