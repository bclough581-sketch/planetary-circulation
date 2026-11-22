# AMALGAM handoff for Claude

## What Brent wants next

Pause visual work and work with Claude on the product's **brains and storyline**. The graphics pass is at an evaluation point; do not merge or deploy anything to production. Brent wants to resume cleanup and eventually install/use AMALGAM on his Android phone tonight.

## Product/storyline work

- Review the current experience from the opening page through the airline case, evidence inspection, decision journal, scoreboard, and live map.
- Assess whether the narrative explains what AMALGAM helps a person decide, how evidence supports a connection, and what the user should do next.
- Identify confusing, unsupported, repetitive, or out-of-order claims before rewriting. Preserve source attribution and the distinction between retained evidence and live data.
- Propose a prioritized storyline cleanup plan first; agree with Brent on direction before making broad narrative changes.
- Keep the visual system intact during the storyline review unless Brent asks to reopen graphics.

## Current graphics direction

- Star hero replaced by the interlocking three-ring AMALGAM mark around a sapphire center.
- Material study: one bronze ring, one silver ring, one black-chrome ring. Bronze is a secondary accent; sapphire remains the main action color.
- Rings retain the approved interlocking geometry. Motion is expressed with independent light sweeps and a slow overall logo turn; reduced-motion preference is respected.
- Dark hero treatment was softened so the mark blends into the blue-black page rather than appearing on a hard black tile.
- Graphics review notes and visual questions are in [AMALGAM-GRAPHICS-CLAUDE-HANDOFF.md](AMALGAM-GRAPHICS-CLAUDE-HANDOFF.md).

## Phone delivery: unresolved

Brent reported that the phone download flow failed. The screenshot showed ChatGPT Space filled with generic HTML tiles, which did not install the project. A ZIP was then shared as a direct GitHub raw download, but Brent still says the flow is broken; **do not claim the phone install is fixed or verified**.

- Public preview: https://htmlpreview.github.io/?https://github.com/bclough581-sketch/planetary-circulation/blob/preview/ring-engine-lab-logo/ring-engine-lab.html
- Direct ZIP URL previously supplied: https://raw.githubusercontent.com/bclough581-sketch/planetary-circulation/preview/ring-engine-lab-logo/AMALGAM-Ring-Engine-Lab-Phone-Preview.zip
- The ZIP is a project package, not an Android installer. The user needs a clear, tested phone path, likely opening the hosted web app in Android Chrome and using **Install app** or **Add to Home screen** if the site meets installability requirements. Check the manifest, service worker, icons, and HTTPS hosting before promising this.
- Confirm the exact user-visible steps and the final URL from the phone, not just from a desktop request. Do not make the ZIP the primary install instruction unless Brent explicitly wants source files.

## Repository state at handoff

- Repository: `bclough581-sketch/planetary-circulation`.
- Current local branch: `preview/tritone-theme`; latest commit shown locally: `c6bf097` (`Add three-metal logo to preview theme`).
- Working tree is **dirty**: `ring-engine-lab.html` now points the tritone logo image to the repository root, and the old `assets/amalgam-rings-tritone.png` path is deleted while a root-level `amalgam-rings-tritone.png` is untracked. Preserve and inspect these changes; do not discard them casually.
- The workspace also contains `AMALGAM-Ring-Engine-Lab-Phone-Preview.zip` (4,235,228 bytes). Its integrity and contents have not been confirmed with the user on an Android phone.
- Keep cleanup changes on preview until Brent reviews and approves them. Do not merge to `main` or publish production as part of this handoff.
