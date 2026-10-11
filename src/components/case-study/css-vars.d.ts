import "react";

// The boards pass their custom properties (--d, --r, --w …) through inline styles.
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
