# Work plan: 2.2 and 2.3 in sand only (no glass)

## Goal
Rebuild the story from the three attempts to the project index in one material, the sand, keeping the "rough idea
becomes a finished product" beat. Success: Liam approves a Blender reference first; the live version then matches it,
passes a frame-by-frame review with no jumps, snaps or ghost frames, and holds 120 fps on desktop (smooth on phones).

## Who it is for
Visitors to the portfolio (recruiters and hiring managers), who should see in a few seconds that Liam turns rough ideas
into polished products, without the motion getting in the way of reaching the work.

## Verdict
Dropping the glass holds up. It was the most fragile and costly part of the site (custom ray-traced glass, 360° probes,
frost shaders) and the source of most recent bugs: the doubled desk inside the ball, the jolt on the way out, the screen
handover starting before the laptop filled the view. It also added a second look to a site whose signature is the sand.

Changed during the review:
- The "sand becomes the UI" stream and the "sand pours in" stream were both rejected: a thick stream reads as an object
  moving, not something being built.
- Instead, the ball spreads into a thinning cloud in the camera's path, the camera flies through it, and the screen
  wakes as we arrive.
- The 2.2 frost attempts become small bursts in which the ball briefly loosens toward chaos.
- Pushed back: no separate "breathing" volume change. It is folded into each burst (a slight pull-in, a swell as it
  breaks, then it settles), so the ball never has two motions competing.

## Scope
**In:**
- 2.2: three attempts as small form-breaking bursts, each different (where, how big, what shape: a patch, a seam,
  a ring). Not intense.
- 2.3: one continuous camera move from the top view, through the spreading and dissolving sand, onto the laptop as its
  lid opens; the screen wakes as the camera arrives; the live index takes over only once the screen fills the view.
- The laptop: real keycaps with a soft backlight glowing through the legends and around the keys (like a MacBook);
  the trackpad matte, like real etched glass, with no glare.
- Removing the glass code, the probes and its assets, and checking download sizes.
- A frame-by-frame review, fps checks on desktop and phone.

**Out:**
- The glass ball, frost, ball-lens optics, glass shadows and reflections.
- Sand forming UI cards on the screen (rejected in this review).
- New copy: the lines "Then I test solutions." and "And I build it." stay (assumption, see below).

## Plan
1. **Blender reference: the laptop** (half a day).
   Keycaps with legends and a backlight, a matte trackpad. Close-up stills for approval.
2. **Blender reference: the 2.3 move** (1 to 2 days).
   - A new camera path: top view, then a dive into the ball as it spreads into a cloud, through it with grains passing
     the lens, then round onto the laptop as the lid opens, ending square to the screen.
   - No stops, the laptop centred from the moment it is the subject, and the turn kept under ~2° a frame.
   - Exported as camera JSON, plus a review clip for Liam. Approval gate.
3. **Reference for the 2.2 bursts** (1 day).
   A short Blender or live prototype clip of the three bursts on the ball in the top view. Approval gate.
4. **Live build** (2 to 3 days).
   - The bursts in the sand shader, using the same per-grain chaos-to-ball blend the sand already has, applied to a
     region.
   - The cloud: the ball's grains spread outward along the camera's path and thin out. The grains near the lens are
     drawn as the solid pebbles with motion blur.
   - The new path; the screen wakes on arrival; the index takeover tied to the screen filling the view (the screen
     covers the whole frame before any crossfade).
5. **Re-bake the desk for the site** (half a day).
   The laptop changes into the baked desk the site loads (bakedesk export); check it against the Blender stills.
6. **Remove the glass** (half a day).
   glass-ball, frost-skin, probes, the old through path and the lab routes no longer used; check bundle and asset sizes.
7. **Quality pass** (1 day).
   - Frame-by-frame sheets of 2.2 and 2.3.
   - A camera trace over the whole page with no jumps and no frames over 25 ms.
   - Phone checks, a preview link for Liam.

## Risks and how to handle them
- **The cloud near the lens looks like flat dots or a smear.**
  - Use the solid mesh pebbles with motion blur for the nearest grains.
  - Keep the cloud thin so it reads as a passage, not a wall.
  - Check frame by frame before showing.
- **The bursts look like glitches rather than attempts.**
  - Keep them small and slow to recover.
  - Each one eases in and out.
  - Approve them in a reference clip before building them live.
- **The screen handover happens too early again.**
  - Trigger the takeover from the screen's measured coverage of the view, not from a fixed frame.
- **Performance during the passage** (many grains close to the lens).
  - Cap the near pebbles.
  - Measure fps at the densest frames.
  - The cost goes down overall, since the glass pass is removed.
- **The motion blur look is still unresolved** (Liam's reference is pending). It affects the cloud passage most.
  - Settle it before step 4 if the reference arrives.
- **Re-baking the desk can shift the lighting** that was calibrated against Blender.
  - Compare against the existing stills after the bake.

## Open assumptions
- The 2.2 and 2.3 copy lines stay as they are.
- The 2.2 bursts are referenced with a short clip (Blender or a live prototype), whichever is faster to make accurately.
- The keycaps show real legends (a standard English layout) at a low backlight level, and the backlight is on as soon
  as the lid opens.
- The cloud's grains are the ball's own grains (no new grains appear); they thin out and are gone by the time the
  screen wakes.
- The phone version follows the same move, with the existing panel-grows takeover into the one-column list.

## First step
Build the laptop fixes and the new 2.3 camera path in Blender, and send Liam the laptop close-up stills and the
review clip of the move through the sand cloud.
