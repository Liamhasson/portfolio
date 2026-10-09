import type { MDXComponents } from "mdx/types";
import { MiddleBlock } from "@/components/case-study/middle-block";

const components: MDXComponents = { MiddleBlock };

export function useMDXComponents(): MDXComponents {
  return components;
}
