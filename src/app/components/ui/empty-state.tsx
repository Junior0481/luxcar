import type { LucideIcon } from "lucide-react";
import { Car } from "lucide-react";
import * as React from "react";

import { cn } from "./utils";

type EmptyStateProps = React.ComponentProps<"div"> & {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

function EmptyState({
  className,
  icon: Icon = Car,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "lux-panel flex min-h-56 flex-col items-center justify-center gap-4 text-center",
        className,
      )}
      {...props}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-lg font-medium text-foreground">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
