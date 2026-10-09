# Cyvore "Real-world attack" mission animation — rebuild notes

Source: Figma `gRE6oKZcBdyqsb1vXf2BkD`, page "Components", section "Real-world attack",
component set `29:995` "Zoom call cyber attack attempt" (10 variants, 1162 x 515).
Used as instance `281:692` inside `60:1330` ("Property 1=real world attack"), starting on variant Frame 38.

Format: Figma interactive component. Every variant has an After-delay -> Change to -> Smart Animate
reaction. No video/GIF/Lottie fill, and no keyframe timeline (get_motion_context returned nothing).
The sequence plays once and ends on Frame 32 (no loop back).

Frames exported at 2x. Some exports are bigger than 2324 x 1030 because of shadow/overflow bleed;
07-09 also show a stray second "Zoom" title bar below the window. Crop to the window when using them.

| # | File | Variant (id) | Shows | Delay before next | Transition to next |
|---|------|--------------|-------|-------------------|--------------------|
| 01 | mission-frame-01.png | Frame 38 (29:989) | Empty dark window; title bar and chat at opacity 0 | 0.1s | Smart Animate, ease-in-and-out-back, 300ms |
| 02 | mission-frame-02.png | Frame 37 (29:990) | Zoom title bar (traffic lights) visible, body empty | 0.3s | Smart Animate, ease-in-and-out-back, 300ms |
| 03 | mission-frame-03.png | Frame 36 (29:987) | Participant tile 1 appears | 0.1s | Smart Animate, ease-in-and-out, 50ms |
| 04 | mission-frame-04.png | Frame 35 (29:986) | Next tile pops in (not visually checked) | 0.1s | Smart Animate, ease-in-and-out, 50ms |
| 05 | mission-frame-05.png | Frame 34 (29:991) | Next tile pops in (not visually checked) | 0.1s | Smart Animate, ease-in-and-out, 50ms |
| 06 | mission-frame-06.png | Frame 33 (29:988) | 2x2 grid complete, no chat | 0.5s | Smart Animate, ease-in-and-out-back, 100ms |
| 07 | mission-frame-07.png | Frame 31 (29:994) | Empty Chat panel slides in on the right | 0.8s | Smart Animate, ease-out, 300ms |
| 08 | mission-frame-08.png | Frame 39 (29:993) | John Doe's message + "Invoice - Action Required" phishing link; tile 1 highlighted | 0.8s | Smart Animate, ease-out, 300ms |
| 09 | mission-frame-09.png | Frame 40 (29:992) | Security Bot: "Analyzing incoming communication streams..." + "Phishing Attempt Detected" | 2.0s | Smart Animate, ease-out, 300ms |
| 10 | mission-frame-10.png | Frame 32 (29:985) | End state: "Analysis over. Security alert!", red "Phishing Attempt Confirmed" + BLOCK button, tile 1 tinted red | — (hold) | — |

Run time to the final frame is about 6.6s (sum of delays and transitions). It reads as about 7s once
the end frame holds.

Figma easing equivalents for CSS/Motion:
- ease-out -> cubic-bezier(0, 0, 0.58, 1) (Figma's "Ease out")
- ease-in-and-out -> cubic-bezier(0.42, 0, 0.58, 1)
- ease-in-and-out-back -> cubic-bezier(0.3, -0.05, 0.7, 1.05) approx. (slight overshoot both ends)

Smart Animate tweens matching layers (same names) for position, size, opacity and fill. So between frames, elements
fade/slide rather than cut. A rebuild should animate opacity and translate per element, not crossfade
whole frames.

Reference: mission-animation-reference.png = node 60:1330 (full 1512 x 982 section at 1x, showing start frame).
