"use client";
import { useEffect, useId, useRef } from "react";
import { Icon } from "../icons";
import "./app.css";
import { pulseAppFontVariables } from "./fonts";
import { screensHTML } from "./onboarding-app";
import { mountPulseProto } from "./onboarding-proto";
import { mountPulseStatic, mountPulseStory } from "./onboarding-story";

/** Screen 1 in the server HTML, so the phone isn't empty before (or without) JavaScript; the story engine replaces it. */
const FIRST_SCREEN = { __html: `<div class="pa is-story" inert aria-hidden="true">${screensHTML("ssr")[0]}</div>` };

/** Board frame 04 · Solution: the onboarding story (scroll picks the screen, a scripted user taps through it) and
    "Tap through it yourself", the coded prototype in its overlay (pulse-mockups.html:401-443, 564-579). */
export function PulseOnboarding({ kind, title }: { kind: "signature"; title: string }) {
  const id = useId();
  const storyRef = useRef<HTMLDivElement>(null);
  const protoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stop: (() => void) | null = null;
    let alive = true;
    void document.fonts.ready.then(() => {
      const story = storyRef.current, dialog = protoRef.current;
      if (!alive || !story || !dialog) return;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const stopStory = (reduce ? mountPulseStatic : mountPulseStory)(story, "desktop");
      const stopProto = mountPulseProto(dialog, story.closest("article") ?? document);
      stop = () => { stopProto(); stopStory(); };
    });
    return () => { alive = false; stop?.(); };
  }, []);
  return (
    <section aria-labelledby={id} data-block={kind} className={`f solution ${pulseAppFontVariables}`}>
        <div className="glow sol-glow" aria-hidden="true"></div>
        <div className="g12" style={{ alignItems: "end", position: "relative" }}>
          <h2 id={id} className="title" style={{ gridColumn: "1/7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="body" style={{ gridColumn: "8/13" }}><span className="lead">Goal-based onboarding.</span> Twelve screens. Screens 1–3 frame the app and learn your goal; 4–9 walk you through your first booking; 10–12 give the tour, ask for permissions and close.</p>
        </div>
        <div className="ob" data-story="desktop" ref={storyRef}>
          <div className="ob-track">
            <div className="ob-pin">
              <div className="ob-side">
                <div className="ob-count" data-count="">01 / 12</div>
                <ol className="ob-caps"><li className="ob-cap is-on">What Pulse is for, in three lines.</li><li className="ob-cap">Pick the goals that matter to you.</li><li className="ob-cap">Choose the activities; the plan follows.</li><li className="ob-cap">Your first booking, free to cancel.</li><li className="ob-cap">The best matches for your activities.</li><li className="ob-cap">Studios near you, with ratings.</li><li className="ob-cap">A slot that fits, with what&apos;s still free.</li><li className="ob-cap">Everything in one place before you book.</li><li className="ob-cap">Booked, and one tap to your calendar.</li><li className="ob-cap">What else Pulse does, in four lines.</li><li className="ob-cap">Notifications, asked for with a reason.</li><li className="ob-cap">In.</li></ol>
                <div className="ob-stages" aria-hidden="true">
                  <div className="ob-stage is-on"><i></i><span>Frame &amp; goal</span></div>
                  <div className="ob-stage"><i></i><span>First booking</span></div>
                  <div className="ob-stage"><i></i><span>Tour &amp; close</span></div>
                </div>
                <button type="button" className="ob-try" data-proto-open="">Tap through it yourself<Icon name="arrow-right" /></button>
              </div>
              <div className="phone ob-phone"><div className="phone-screen">
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 1: Welcome" dangerouslySetInnerHTML={FIRST_SCREEN} /><figcaption>01 · What Pulse is for, in three lines.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 2: What brings you here?"></div><figcaption>02 · Pick the goals that matter to you.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 3: What do you love?"></div><figcaption>03 · Choose the activities; the plan follows.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 4: Book your first workout"></div><figcaption>04 · Your first booking, free to cancel.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 5: Choose a workout"></div><figcaption>05 · The best matches for your activities.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 6: Choose a studio"></div><figcaption>06 · Studios near you, with ratings.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 7: Pick a time"></div><figcaption>07 · A slot that fits, with what&apos;s still free.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 8: Confirm booking"></div><figcaption>08 · Everything in one place before you book.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 9: You're booked!"></div><figcaption>09 · Booked, and one tap to your calendar.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 10: You're all set"></div><figcaption>10 · What else Pulse does, in four lines.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 11: Stay in the loop"></div><figcaption>11 · Notifications, asked for with a reason.</figcaption></figure>
                <figure className="ob-screen"><div className="ob-app" role="img" aria-label="Onboarding screen 12: Welcome to Pulse"></div><figcaption>12 · In.</figcaption></figure>
              </div></div>
            </div>
          </div>
        </div>
      <div className="proto" data-proto="" role="dialog" aria-modal="true" aria-label="Pulse onboarding prototype" hidden data-lenis-prevent="" ref={protoRef}>
      <div className="proto-backdrop"></div>
      <div className="proto-body">
        <div className="proto-side">
          <p className="proto-eyebrow">Pulse · onboarding prototype</p>
          <p className="proto-count" data-proto-count="">01 / 12</p>
          <ol className="proto-caps"><li className="proto-cap is-on">What Pulse is for, in three lines.</li><li className="proto-cap">Pick the goals that matter to you.</li><li className="proto-cap">Choose the activities; the plan follows.</li><li className="proto-cap">Your first booking, free to cancel.</li><li className="proto-cap">The best matches for your activities.</li><li className="proto-cap">Studios near you, with ratings.</li><li className="proto-cap">A slot that fits, with what&apos;s still free.</li><li className="proto-cap">Everything in one place before you book.</li><li className="proto-cap">Booked, and one tap to your calendar.</li><li className="proto-cap">What else Pulse does, in four lines.</li><li className="proto-cap">Notifications, asked for with a reason.</li><li className="proto-cap">In.</li></ol>
          <p className="proto-note">Tap the screen as you would in the app. Screens from the Figma file; only its real controls respond.</p>
          <div className="proto-actions"><button type="button" className="proto-btn" data-proto-restart="">Restart</button><button type="button" className="proto-btn" data-proto-close="">Close</button></div>
        </div>
        <div className="proto-phone"><div className="proto-screen">
          <div className="pa" data-pa=""></div>
        </div></div>
      </div>
    </div>
    </section>
  );
}
