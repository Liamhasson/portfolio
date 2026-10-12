/**
 * The real-world attack on a phone (Liam, 2026-10-13): the mission video is wide (1440x660), so a phone's tall frame
 * showed it as a strip with its chat a sliver. There, the one video is redrawn into a canvas as a phone would lay it
 * out: the call above, its chat below, each larger. The video keeps playing its part (the engine scrubs it); the canvas
 * mirrors each frame it lands on.
 */
type Rect = { x: number; y: number; w: number; h: number };

/** The two parts of the video's frame (px of the 1440x660 video): the call grid and the chat's content. */
export const ATTACK_REGIONS = { call: { x: 0, y: 76, w: 950, h: 584 }, chat: { x: 950, y: 76, w: 490, h: 484 } } as const;

const GAP = 12;

/** Where each part goes in a box (px); null on a wide box (the video as it is). */
export function attackPhoneLayout(boxW: number, boxH: number): { call: Rect; chat: Rect } | null {
  if (boxW <= 0 || boxH / boxW < 0.75) return null;
  const { call, chat } = ATTACK_REGIONS;
  const k = call.h / call.w + chat.h / chat.w;   // (height per unit of the shared width)
  const w = Math.min(boxW, (boxH - GAP) / k);
  const hCall = (w * call.h) / call.w, hChat = (w * chat.h) / chat.w;
  const x = (boxW - w) / 2, y = (boxH - (hCall + GAP + hChat)) / 2;
  return { call: { x, y, w, h: hCall }, chat: { x, y: y + hCall + GAP, w, h: hChat } };
}

/** Mirrors `video` into a phone layout while its box is tall; returns the cleanup. */
export function mountAttackPhone(video: HTMLVideoElement): () => void {
  const box = video.parentElement;
  if (!box || typeof ResizeObserver === "undefined") return () => {};
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "attack-phone";
  box.appendChild(canvas);
  const g = canvas.getContext("2d");
  let layout: ReturnType<typeof attackPhoneLayout> = null;
  const draw = () => {
    if (!g || !layout || video.readyState < 2) return;
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (const part of ["call", "chat"] as const) {
      const s = ATTACK_REGIONS[part], d = layout[part];
      g.drawImage(video, s.x, s.y, s.w, s.h, d.x, d.y, d.w, d.h);
    }
  };
  const fit = () => {
    const w = box.clientWidth, h = box.clientHeight, dpr = window.devicePixelRatio || 1;
    layout = attackPhoneLayout(w, h);
    box.dataset.phone = layout ? "1" : "";
    if (!layout) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    draw();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(box);
  const events = ["seeked", "loadeddata", "timeupdate"];
  for (const e of events) video.addEventListener(e, draw);
  fit();
  return () => {
    ro.disconnect();
    for (const e of events) video.removeEventListener(e, draw);
    canvas.remove();
    delete box.dataset.phone;
  };
}
