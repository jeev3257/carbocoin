import clsx from "clsx";

const base = "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-400 focus:ring-offset-[#0b0f17]";
const variants = {
  solid: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/25",
  outline: "border border-white/15 text-white hover:bg-white/10",
  ghost: "text-gray-200 hover:bg-white/10",
};
const sizes = {
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({ variant = "solid", size = "md", className, ...props }) {
  return <button className={clsx(base, variants[variant], sizes[size], className)} {...props} />;
}
