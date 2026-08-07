import { useEffect, useState } from "react";

export default function UpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onUpdate = () => setShow(true);
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  if (!show) return null;

  const refresh = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage("SKIP_WAITING");
      window.location.reload();
    });
  };

  return (
    <div
      onClick={refresh}
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#4F46E5",
        color: "#fff",
        padding: "10px 18px",
        borderRadius: 10,
        fontSize: 14,
        cursor: "pointer",
        zIndex: 9999,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      نسخه‌ی جدید آماده است — برای رفرش لمس کنید
    </div>
  );
}