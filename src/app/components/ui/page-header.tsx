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
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground md:text-[32px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      {Icon ? <Icon className="sr-only" aria-hidden="true" /> : null}
    </div>
  );
}

export { PageHeader };
