"use client";

/**
 * Ildiz maketi yoki eng yuqori segmentdagi kutilmagan xato (masalan, baza
 * bilan aloqa uzilgan). Bu fayl ildiz maketini almashtiradi, shuning uchun
 * o'z `<html>` / `<body>` ini chizadi va global CSS'ga tayanmaydi - uslublar
 * shu yerda.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f3f3",
          color: "#333333",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main role="alert" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Ma’lumotni yuklashda xatolik yuz berdi</p>
          <p style={{ fontSize: 14, color: "#555555", margin: "8px 0 16px" }}>
            Birozdan so’ng qayta urinib ko’ring.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              height: 36,
              padding: "0 16px",
              border: 0,
              borderRadius: 8,
              background: "#007cd2",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Qayta urinish
          </button>
        </main>
      </body>
    </html>
  );
}
