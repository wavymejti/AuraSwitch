import { motion, type HTMLMotionProps } from "motion/react";

type Variant = "primary" | "ghost" | "danger" | "default";
type Size = "sm" | "md" | "lg";

interface Props extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

/** Pill button with a springy press, Phantom-style. */
export const Button = ({ variant = "default", size = "md", block, className = "", disabled, ...rest }: Props) => (
  <motion.button
    className={[
      "btn",
      variant !== "default" && `btn-${variant}`,
      size !== "md" && `btn-${size}`,
      block && "btn-block",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    disabled={disabled}
    whileHover={disabled ? undefined : { y: -1 }}
    whileTap={disabled ? undefined : { scale: 0.96 }}
    transition={{ type: "spring", stiffness: 500, damping: 28 }}
    {...rest}
  />
);

/** Same look for links (e.g. "Otwórz aplikację"). */
export const ButtonLink = ({
  variant = "default",
  size = "md",
  className = "",
  ...rest
}: HTMLMotionProps<"a"> & { variant?: Variant; size?: Size }) => (
  <motion.a
    className={["btn", variant !== "default" && `btn-${variant}`, size !== "md" && `btn-${size}`, className]
      .filter(Boolean)
      .join(" ")}
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.96 }}
    transition={{ type: "spring", stiffness: 500, damping: 28 }}
    {...rest}
  />
);
