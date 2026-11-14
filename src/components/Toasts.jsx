import { CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[90] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="dropdown flex items-center gap-2.5 rounded-xl bg-ink py-2.5 pr-4 pl-3 text-sm font-semibold text-white shadow-xl"
        >
          <CheckCircle2 size={17} className="shrink-0 text-leaf-300" />
          {t.message}
        </div>
      ))}
    </div>
  );
}
