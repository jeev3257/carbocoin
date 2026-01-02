import clsx from "clsx";

export function Card({ className, ...props }) {
  return <div className={clsx("glass-card", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={clsx("p-6", className)} {...props} />;
}
