import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  trend?: string;
  accent?: "default" | "signature" | "warning" | "verified" | "danger";
}

const ACCENT: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-foreground",
  signature: "text-signature",
  warning: "text-warning",
  verified: "text-verified",
  danger: "text-danger",
};

export function StatCard({ title, value, icon, trend, accent = "default" }: StatCardProps) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.round(v).toString());

  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: "easeOut" });
    return c.stop;
  }, [value, mv]);

  return (
    <div className="card-hover rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className={cn("rounded-lg bg-surface-elevated p-2", ACCENT[accent])}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <motion.span className={cn("font-mono-num text-3xl font-semibold", ACCENT[accent])}>
          {display}
        </motion.span>
        {trend && <span className="text-xs text-muted-foreground">{trend}</span>}
      </div>
    </div>
  );
}
