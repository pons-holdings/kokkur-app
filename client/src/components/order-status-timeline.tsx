import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "paid", label: "Paid" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
];

interface OrderStatusTimelineProps {
  status: string;
}

export function OrderStatusTimeline({ status }: OrderStatusTimelineProps) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-destructive text-white">
          <X className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-medium">Cancelled</span>
      </div>
    );
  }

  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, idx) => {
        const isComplete = idx <= currentIndex;
        const isCurrent = idx === currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium shrink-0",
                  isComplete
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                  isCurrent && "ring-2 ring-primary ring-offset-2"
                )}
              >
                {isComplete && idx < currentIndex ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-tight text-center",
                  isComplete ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1 mt-[-14px]",
                  idx < currentIndex ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
