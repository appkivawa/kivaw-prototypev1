import { useEffect, useState } from "react";

type ToastProps = {
  message: string;
  onClose: () => void;
  duration?: number;
};

export function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "var(--surface)",
        color: "var(--ink)",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "var(--shadow)",
        border: "1px solid var(--border-strong)",
        zIndex: 10000,
        fontSize: "14px",
        fontWeight: 500,
        animation: "fadeInUp 0.3s ease-out",
      }}
    >
      {message}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

type ToastState = {
  message: string;
  id: number;
};

let toastId = 0;
let toastListeners: ((toasts: ToastState[]) => void)[] = [];
let toasts: ToastState[] = [];

export function showToast(message: string) {
  const id = toastId++;
  toasts = [...toasts, { message, id }];
  toastListeners.forEach((listener) => listener(toasts));

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    toastListeners.forEach((listener) => listener(toasts));
  }, 3000);
}

export function useToasts() {
  const [toastList, setToastList] = useState<ToastState[]>([]);

  useEffect(() => {
    const listener = (newToasts: ToastState[]) => {
      setToastList(newToasts);
    };
    toastListeners.push(listener);
    setToastList(toasts);

    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return toastList;
}

export function ToastContainer() {
  const toasts = useToasts();

  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          onClose={() => {
            // Handled by timeout
          }}
        />
      ))}
    </>
  );
}




