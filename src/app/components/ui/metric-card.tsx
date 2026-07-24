import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { Card, CardContent } from "./card";
import { cn } from "./utils";

type MetricCardProps = React.ComponentProps<typeof Card> & {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon?: LucideIcon;
  accent?: boolean;
};

function MetricCard({
  className,
  title,
  value,
  description,
  icon: Icon,
  accent = false,
  ...props
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "lux-card-hover",
        accent && "border-primary/20 bg-accent/60",
        className,
      )}
      {...props}
    >
      <CardContent className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-2xl font-medium text-foreground">
            {value}
          </p>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl",
              accent
                ? "bg-primary/15 text-primary ring-1 ring-primary/20"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { MetricCard };
