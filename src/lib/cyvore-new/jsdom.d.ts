// The one jsdom API hero-only.test.ts uses (its own types aren't installed): a page whose own scripts run.
declare module "jsdom" {
  export class JSDOM {
    constructor(html: string, options?: { runScripts?: "dangerously" | "outside-only"; url?: string });
    readonly window: Window & typeof globalThis;
  }
}
