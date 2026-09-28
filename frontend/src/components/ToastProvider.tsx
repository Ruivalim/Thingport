import React from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert, { type AlertColor } from "@mui/material/Alert";

export type ToastOptions = {
  message: string;
  severity?: AlertColor;
};

type QueuedToast = ToastOptions & { key: number };

const ToastContext = React.createContext<((options: ToastOptions) => void) | null>(null);

let nextKey = 0;

/** Queues toasts one at a time. Mounted once in AppLayout. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<QueuedToast[]>([]);
  const [current, setCurrent] = React.useState<QueuedToast | null>(null);
  const [open, setOpen] = React.useState(false);

  const showToast = React.useCallback((options: ToastOptions) => {
    setQueue(prev => [...prev, { ...options, key: nextKey++ }]);
  }, []);

  React.useEffect(() => {
    if (queue.length && !current) {
      setCurrent(queue[0]);
      setQueue(prev => prev.slice(1));
      setOpen(true);
    } else if (queue.length && current && open) {
      setOpen(false);
    }
  }, [queue, current, open]);

  const handleClose = (_event: unknown, reason?: string) => {
    if (reason === "clickaway") return;
    setOpen(false);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={4000}
        onClose={handleClose}
        slotProps={{ transition: { onExited: () => setCurrent(null) } }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setOpen(false)} severity={current?.severity ?? "success"} variant="filled" sx={{ width: "100%" }}>
          {current?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = React.useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used within a ToastProvider");
  return showToast;
}
