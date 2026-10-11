/* "Light finding the material" (the boards' nav motion): the pointer is a soft light that the pill's surface and rim
   catch. The position is written as --x/--y on the element, at most once a frame; it stays where the pointer left, so
   the light fades out where it was and never jumps. Keyboard focus puts it in the centre. */

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lights one element; returns the cleanup. */
export function bindLight(el: HTMLElement): () => void {
  let rect: DOMRect | null = null;
  let x = 0, y = 0, raf = 0;
  const write = () => { raf = 0; el.style.setProperty("--x", `${x}px`); el.style.setProperty("--y", `${y}px`); };
  const read = (e: PointerEvent) => {
    if (!rect) rect = el.getBoundingClientRect();
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  };
  const enter = (e: PointerEvent) => {
    if (reduced() || e.pointerType !== "mouse") return;
    rect = null;
    read(e);
    write(); // place the light before it fades in
  };
  const move = (e: PointerEvent) => {
    if (reduced() || e.pointerType !== "mouse") return;
    read(e);
    if (!raf) raf = requestAnimationFrame(write);
  };
  const leave = () => { rect = null; };
  const focus = () => {
    if (el.matches(":focus-visible")) { el.style.setProperty("--x", "50%"); el.style.setProperty("--y", "50%"); }
  };
  const scrolled = () => { rect = null; };
  el.addEventListener("pointerenter", enter);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("focus", focus);
  addEventListener("scroll", scrolled, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    el.removeEventListener("pointerenter", enter);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerleave", leave);
    el.removeEventListener("focus", focus);
    removeEventListener("scroll", scrolled);
  };
}
