import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-xl bg-muted/80 shadow-lux-sm", className)}
      {...props}
    />
  );
}

export { Skeleton };
