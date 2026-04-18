import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  value: number; // 0..1
  className?: string;
  showLabel?: boolean;
}

export function ConfidenceBar({ value, className, showLabel = true }: ConfidenceBarProps) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.75
      ? "bg-verified"
      : value >= 0.4
        ? "bg-warning"
        : "bg-danger";

  const labelColor =
    value >= 0.75 ? "text-verified" : value >= 0.4 ? "text-warning" : "text-danger";

  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (latest) => `${Math.round(latest)}%`);

  useEffect(() => {
    const controls = animate(motionValue, pct, { duration: 0.6, ease: "easeOut" });
    return controls.stop;
  }, [pct, motionValue]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
      {showLabel && (
        <motion.span className={cn("font-mono-num text-xs tabular-nums", labelColor)}>
          {display}
        </motion.span>
      )}
    </div>
  );
}
