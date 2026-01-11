import { motion, AnimatePresence } from "framer-motion";
import { useToastStore, type Toast } from "@/stores";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/Icons";

const toastVariants = {
  initial: { opacity: 0, y: 50, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
};

const ToastItem = ({ toast }: { toast: Toast }) => {
  const removeToast = useToastStore((s) => s.removeToast);

  const bgColors = {
    info: "bg-card border-card-border",
    success: "bg-success/20 border-success text-success",
    warning: "bg-warning/20 border-warning text-warning",
    error: "bg-danger/20 border-danger text-danger",
  };

  const textColors = {
    info: "text-white",
    success: "text-success-foreground",
    warning: "text-warning-foreground",
    error: "text-danger-foreground",
  };

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`
        pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm
        ${bgColors[toast.type]}
      `}
    >
      <p className={`flex-1 text-sm font-medium ${textColors[toast.type]}`}>
        {toast.message}
      </p>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => removeToast(toast.id)}
        className="rounded-full p-1 opacity-70 hover:bg-black/10 hover:opacity-100"
      >
        <CloseIcon size={16} />
      </Button>
    </motion.div>
  );
};

export const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-300 flex flex-col gap-2 outline-none pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};
