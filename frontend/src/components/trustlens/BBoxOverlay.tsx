import { motion } from "framer-motion";
import type { BBox } from "@/lib/types";

interface BBoxOverlayProps {
  bbox: BBox;
  pageWidth: number;
  pageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function BBoxOverlay({
  bbox,
  pageWidth,
  pageHeight,
  canvasWidth,
  canvasHeight,
}: BBoxOverlayProps) {
  const scaleX = canvasWidth / pageWidth;
  const scaleY = canvasHeight / pageHeight;

  const style = {
    left: bbox.x0 * scaleX,
    top: bbox.y0 * scaleY,
    width: (bbox.x1 - bbox.x0) * scaleX,
    height: (bbox.y1 - bbox.y0) * scaleY,
  };

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        boxShadow: [
          "0 0 0 rgba(250,204,21,0)",
          "0 0 24px rgba(250,204,21,0.55)",
          "0 0 12px rgba(250,204,21,0.35)",
        ],
      }}
      transition={{ duration: 0.45, ease: "easeOut", boxShadow: { duration: 1.2 } }}
      className="pointer-events-none absolute rounded-sm border-2 bg-signature-soft"
      style={{
        ...style,
        borderColor: "var(--signature)",
      }}
    >
      <div className="absolute -top-7 left-0 flex items-center gap-1.5 rounded-md bg-signature px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-signature-foreground shadow-[0_0_12px_rgba(250,204,21,0.4)]">
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-signature-foreground"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        Verified Proof
      </div>
    </motion.div>
  );
}
