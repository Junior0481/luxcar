import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "./utils";

type PageHeaderProps = React.ComponentProps<"div"> & {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
};

function PageHeader({
  className,
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-surface-elevated p-5 shadow-lux-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <Icon className="size-6" aria-hidden="true" />
          </div>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-medium tracking-normal text-foreground md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { PageHeader };
