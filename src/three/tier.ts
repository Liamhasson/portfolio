export type QualityTier = "high" | "mid" | "low";

export interface TierSignals {
  isMobile: boolean;
  /** navigator.webdriver: a test or automation browser. */
  automated: boolean;
  cores: number;
  memoryGb: number;
  dpr: number;
  maxTextureSize: number;
}

export interface TierSettings {
  tier: QualityTier;
  /** How many sand grains to draw (a prefix of the shuffled data). */
  grains: number;
  pixelRatio: number;
  /** Steps of the light march through the density volume (self-shadowing inside the sand). */
  shadowSteps: number;
  antialias: boolean;
}

const TIERS: readonly QualityTier[] = ["high", "mid", "low"];

export function pickTier(s: TierSignals, override?: QualityTier): QualityTier {
  if (override) return override;
  if (s.automated) return "low";
  // current phones handle the mid tier; the governor steps a struggling one down. Only weak phones start low.
  if (s.isMobile) return s.cores >= 4 && s.memoryGb >= 4 ? "mid" : "low";
  if (s.cores >= 8 && s.memoryGb >= 8 && s.maxTextureSize >= 16384) return "high";
  if (s.cores >= 4 && s.memoryGb >= 4) return "mid";
  return "low";
}

const GRAINS: Record<QualityTier, number> = { high: 400_000, mid: 160_000, low: 60_000 };
const MAX_PIXEL_RATIO: Record<QualityTier, number> = { high: 2, mid: 1.5, low: 1 };
const SHADOW_STEPS: Record<QualityTier, number> = { high: 16, mid: 8, low: 4 };

export function settingsFor(tier: QualityTier, dpr: number): TierSettings {
  return {
    tier,
    grains: GRAINS[tier],
    pixelRatio: Math.min(dpr, MAX_PIXEL_RATIO[tier]),
    shadowSteps: SHADOW_STEPS[tier],
    antialias: tier !== "low",
  };
}

/** `?tier=high` forces a tier (compare captures, device checks). */
export function parseTierOverride(search: string): QualityTier | undefined {
  const value = new URLSearchParams(search).get("tier");
  return TIERS.find((t) => t === value);
}

/** Reads the signals from the browser. Safari does not expose deviceMemory, so a capable device is assumed. */
export function readSignals(gl?: WebGLRenderingContext | WebGL2RenderingContext | null): TierSignals {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number });
  return {
    isMobile: !!nav && /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent),
    automated: !!nav?.webdriver,
    cores: nav?.hardwareConcurrency ?? 4,
    memoryGb: nav?.deviceMemory ?? 8,
    dpr: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    maxTextureSize: gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096,
  };
}
