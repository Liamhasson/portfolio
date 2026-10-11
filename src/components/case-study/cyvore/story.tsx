"use client";
import Image from "next/image";
import { useId } from "react";
import { Icon } from "../icons";
import { useEngine } from "../use-engine";
import { cyvoreFontVariables } from "./fonts";
import { mountCyvoreStatic, mountCyvoreStory } from "./story-engine";

/** Board frame 04 · Solution: the story replica of the shipped site (cyvore-mockups.html:541-678). Scroll plays it,
    hover or click explores, the bar jumps. The engine is the board's (story-engine.ts), mounted once fonts are in. */
export function CyvoreStory({ kind, title }: { kind: "signature"; title: string }) {
  const id = useId();
  const ref = useEngine((root) => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    return (reduce ? mountCyvoreStatic : mountCyvoreStory)(root, "desktop");
  });
  return (
    <section aria-labelledby={id} data-block={kind} className={`f solution ${cyvoreFontVariables}`}>
        <div className="sol-glow" aria-hidden="true"></div>
        <div className="g12" style={{ alignItems: "end", position: "relative" }}>
          <h2 id={id} className="title" style={{ gridColumn: "1/7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="body" style={{ gridColumn: "8/13" }}><span className="lead">One screen, everything.</span> I rebuilt the information architecture around the meeting, not the scroll. The main screen swaps between Security, Exposure, Coverage and Enables with hover and click animations, while both navigation bars stay visible the whole time.</p>
        </div>

        <div className="story" data-story="desktop" ref={ref}>
          <div className="story-track">
            <div className="story-pin">
              <div className="rep-anno"><span>Scroll: the story plays</span><span>Hover or click: explore · bar: jump</span></div>
              <div className="site t-c" data-replica="" data-product="">
                <div className="s-nav">
                  <div className="s-logo"><Image src="/case-studies/cyvore/logo-mark.svg" alt="" width={24} height={24} unoptimized />cyvore<sup>TM</sup></div>
                  <div className="s-links"><span>Technology</span><span>Solutions</span><span>Resources</span><span>About Us</span><span>Contact</span></div>
                  <span className="s-cta">REQUEST YOUR DEMO</span>
                </div>
                <div className="s-stage" aria-hidden="true"></div>

                <section className="s-chapter is-on" data-chapter="why" aria-label="Why it matters">
                  <div className="s-head"><h4>SECURITY IN EVERY PART OF YOUR WORKPLACE</h4><div className="s-btns"><span className="s-cta">REQUEST YOUR DEMO</span><span className="s-cta ghost">ABOUT US</span></div></div>
                  <div className="s-body">
                    <div className="panels" role="tablist" aria-label="What Cyvore does">
                      <button className="pan" role="tab" aria-selected="false" aria-label="Security">
                        <span className="pan-name" aria-hidden="true">SECURITY</span>
                        <span className="pan-body">
                          <span className="pan-art" aria-hidden="true">
                            <span className="card bit" style={{ left: "calc(50% + var(--s) * -124)", top: "0", "--r": "-1.5deg", "--d": "0" }}><Icon name="user" />Got a business offer from WhatsApp Business</span>
                            <span className="card bit" style={{ left: "calc(50% + var(--s) * -84)", top: "calc(var(--s) * 74)", "--r": "3deg", "--d": "1" }}><Icon name="mail" />Received a suspicious email</span>
                            <span className="card bit" style={{ left: "calc(50% + var(--s) * -110)", top: "calc(var(--s) * 140)", width: "calc(var(--s) * 154)", "--r": "-1deg", "--d": "2" }}><Icon name="phone" />Called back to an unknown number</span>
                          </span>
                          <span className="pan-title">SECURITY</span>
                          <span className="pan-desc">Secures employee activity and AI agent operations, internally and externally.</span>
                        </span>
                      </button>
                      <button className="pan" role="tab" aria-selected="false" aria-label="Exposure">
                        <span className="pan-name" aria-hidden="true">EXPOSURE</span>
                        <span className="pan-body">
                          <span className="pan-art" aria-hidden="true"><span className="chain">
                            <span className="link bit" style={{ "--d": "0" }}><Icon name="at" /></span>
                            <span className="link bit" style={{ "--d": "1" }}><Icon name="headphones" /></span>
                            <span className="link bit" style={{ "--d": "2" }}><Icon name="link-out" /></span>
                            <span className="link last bit" style={{ "--d": "3" }}><Icon name="pin" /></span>
                          </span></span>
                          <span className="pan-title">EXPOSURE</span>
                          <span className="pan-desc">Exposes the complete chain of events to stop phishing and fraud.</span>
                        </span>
                      </button>
                      <button className="pan" role="tab" aria-selected="false" aria-label="Coverage">
                        <span className="pan-name" aria-hidden="true">COVERAGE</span>
                        <span className="pan-body">
                          <span className="pan-art" aria-hidden="true"><span className="tiles">
                            <span className="tile word bit" style={{ "--d": "0" }}>zoom</span><span className="tile bit" style={{ "--d": "1" }}>T</span><span className="tile bit" style={{ "--d": "2" }}>#</span><span className="tile bit" style={{ "--d": "3" }}><Icon name="chat" /></span>
                            <span className="tile bit" style={{ "--d": "4" }}>M</span><span className="tile bit" style={{ "--d": "5" }}><Icon name="cloud" /></span><span className="tile bit" style={{ "--d": "6" }}>O</span><span className="tile bit" style={{ "--d": "7" }}>G</span>
                            <span className="plus bit" style={{ "--d": "8" }}><Icon name="plus" /></span>
                          </span></span>
                          <span className="pan-title">COVERAGE</span>
                          <span className="pan-desc">Covers Zoom, Teams, Slack, WhatsApp Business, email, CRM systems, and beyond.</span>
                        </span>
                      </button>
                      <button className="pan" role="tab" aria-selected="false" aria-label="Enables">
                        <span className="pan-name" aria-hidden="true">ENABLES</span>
                        <span className="pan-body">
                          <span className="pan-art" aria-hidden="true"><span className="iocs">
                            <span className="ioc bit" style={{ "--d": "0" }}><b>zoom</b>Manipulation behavior during zoom call</span>
                            <span className="ioc bit" style={{ "--d": "1" }}><b><Icon name="user" /></b>AI image of company representative</span>
                            <span className="ioc bit" style={{ "--d": "2" }}><b><Icon name="mail" /></b>New business inquiry via email</span>
                          </span></span>
                          <span className="pan-title">ENABLES</span>
                          <span className="pan-desc">Enables precise investigation of every Indicator of Compromise (IOC).</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </section>

                <section className="s-chapter" data-chapter="risk" aria-label="The risk is real">
                  <div className="s-head"><h4>THE RISK IS REAL</h4><p>The numbers you need to see</p></div>
                  <div className="s-body">
                    <div className="panels" role="tablist" aria-label="The numbers">
                      <button className="pan stat" role="tab" aria-selected="false" aria-label="2,535%"><span className="pan-name" aria-hidden="true">2,535%</span><span className="pan-body"><span className="stat-num bit" data-stat="0" style={{ "--d": "0" }}>2,535%</span><span className="stat-desc bit" style={{ "--d": "1" }}>Increase in malicious phishing messages from Q4 2022</span></span></button>
                      <button className="pan stat" role="tab" aria-selected="false" aria-label="83%"><span className="pan-name" aria-hidden="true">83%</span><span className="pan-body"><span className="stat-num bit" data-stat="1" style={{ "--d": "0" }}>83%</span><span className="stat-desc bit" style={{ "--d": "1" }}>Cybersecurity professionals polled reported being targets of phishing attacks</span></span></button>
                      <button className="pan stat" role="tab" aria-selected="false" aria-label="967%"><span className="pan-name" aria-hidden="true">967%</span><span className="pan-body"><span className="stat-num bit" data-stat="2" style={{ "--d": "0" }}>967%</span><span className="stat-desc bit" style={{ "--d": "1" }}>Increase in credential phishing from Q4 2022</span></span></button>
                      <button className="pan stat" role="tab" aria-selected="false" aria-label="15B"><span className="pan-name" aria-hidden="true">15B</span><span className="pan-body"><span className="stat-num bit" data-stat="3" style={{ "--d": "0" }}>15B</span><span className="stat-desc bit" style={{ "--d": "1" }}>Cyberattacks are launched every single day</span></span></button>
                    </div>
                  </div>
                </section>

                <section className="s-chapter" data-chapter="attack" aria-label="Real-world attack">
                  <div className="s-head"><h4>REAL-WORLD ATTACK</h4><ol className="s-caps"><li>A link lands in the call.</li><li>Cyvore reads it.</li><li>Blocked.</li></ol></div>
                  <div className="s-body"><div className="attack"><video src="/case-studies/cyvore/mission.mp4" poster="/case-studies/cyvore/mission-poster.jpg" muted playsInline preload="none" aria-label="A phishing link lands in a video call; the security bot flags it and Cyvore blocks it"></video></div></div>
                </section>

                <section className="s-chapter" data-chapter="powers" aria-label="What powers us">
                  <div className="s-head"><h4>WHAT POWERS US</h4><p>Three proprietary engines</p></div>
                  <div className="s-body">
                    <svg className="wires" viewBox="0 0 1052 440" preserveAspectRatio="none" aria-hidden="true">
                      <circle className="node" cx="526" cy="18" r="4" />
                      <path d="M526 22 V70" />
                      <path d="M526 70 C526 96 183 92 183 120" />
                      <path d="M526 70 V120" />
                      <path d="M526 70 C526 96 869 92 869 120" />
                      <path d="M183 320 C183 352 526 348 526 392" />
                      <path d="M526 320 V392" />
                      <path d="M869 320 C869 352 526 348 526 392" />
                      <path d="M520 398 L526 406 L532 398" />
                    </svg>
                    <div className="engines">
                      <article className="eng"><h5>OPR</h5><p className="eng-x">(Optical Phishing Recognition)</p><p className="eng-d">AI driven visual phishing detection</p></article>
                      <article className="eng"><h5>TIAO</h5><p className="eng-x">(Threat Intelligence Autonomous Operation)</p><p className="eng-d">Proactive threat engine that mimics analyst behavior, catching Zero-Day threats before they are launched.</p></article>
                      <article className="eng"><h5>DAN</h5><p className="eng-x">(Data Analysis NLU)</p><p className="eng-d">Context-aware language model that understands behavioral patterns across human and AI agents.</p></article>
                    </div>
                  </div>
                </section>

                <div className="s-chapters" role="tablist" aria-label="Chapters">
                  <button className="chap" role="tab" aria-selected="true" data-go="why"><i className="chap-fill" aria-hidden="true"></i>Why it matters</button>
                  <button className="chap" role="tab" aria-selected="false" data-go="risk"><i className="chap-fill" aria-hidden="true"></i>The risk is real</button>
                  <button className="chap" role="tab" aria-selected="false" data-go="attack"><i className="chap-fill" aria-hidden="true"></i>Real-world attack</button>
                  <button className="chap" role="tab" aria-selected="false" data-go="powers"><i className="chap-fill" aria-hidden="true"></i>What powers us</button>
                </div>
                <p className="sr-only" data-where="" aria-live="polite">Chapter 1 of 4</p>
              </div>
            </div>
          </div>
        </div>

        <div className="g12 sol-foot">
          <p className="body" style={{ gridColumn: "1/7" }}>Wherever the presentation is, every section is one move away.</p>
          <p className="body quiet" style={{ gridColumn: "8/13" }}>The replica below is refined for this portfolio: the content and layout are as shipped; type, colour and depth are tightened.</p>
        </div>
      </section>
  );
}
