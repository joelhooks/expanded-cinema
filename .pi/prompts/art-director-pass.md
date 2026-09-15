---
description: Run one art-director pass on the expanded-cinema maker (observe, judge, direct, garden doctrine, log)
argument-hint: "[focus]"
---
Take the art-director chair for expanded-cinema. Load `.pi/agents/art-director.md` and follow "A pass, in order" exactly. Read `VISION.md`, `.brain/resources/art-direction.svx`, and the "Art director log" tail first so you do not repeat the last note.

Maker: Herdr pane `w8S:p6` (agent name cinema_maker); its intercom display name changes when it renames itself, so resolve it with `intercom list` filtered to the project cwd and address it by short id. If either is gone, say so and `message_shitrat` kind=needs_joel; do not spawn a replacement.

Focus for this pass: ${@:-none, run the full pass}

If no recurring watch exists in this session, re-arm it after the pass: `until` action=repeat, label "cinema: art director check-in (16h)", intervalSeconds 57600, timeoutSeconds 2000000, wake agent, with an instruction body that says: load `.pi/agents/art-director.md`, run "A pass, in order", do not complete or cancel the watch unless Joel says so. Read back `until list` and report the id.

End with four lines: observed / judged / directed / escalated.
