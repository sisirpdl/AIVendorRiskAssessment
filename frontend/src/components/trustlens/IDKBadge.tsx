import { Info } from "lucide-react";

export function IDKBadge() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-surface/40 px-3 py-2.5">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-idk" />
      <div className="text-sm text-idk">
        <span className="font-medium text-muted-foreground">Information Not Found</span>
        <span className="ml-1.5 text-idk">— Requires Manual Review</span>
      </div>
    </div>
  );
}
