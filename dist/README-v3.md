# Smile Together — TikTok LIVE concept prototype

Independent product design study. Not affiliated with TikTok. Social data, comments, likes, and gifts are local simulations, not real platform events or transactions.

## Run
Serve this directory on localhost or HTTPS. Open index.html through the server. Camera APIs need a secure context; the initial MediaPipe model download requires internet access.

## Files
- index.html: delivered experience and research view.
- live.css: responsive TikTok-inspired live scene and separate host controls.
- app.js: local MediaPipe inference, calibration, fixed particle pool, head-proxy collision, particle quality adaptation.
- live.js: local chat, likes, simulated gifts, round lifecycle and pause controls.

## Core behavior
Smile produces rain. A laugh-like combination of smile and jaw-open scores produces one fireworks sequence. This is an expression proxy, not emotion diagnosis. Three timed bursts use a shared pool capped at 500 particles. Head collisions use a moving 2D ellipse, not a 3D head mesh. Inference remains on the main thread at 15 Hz, adapting to 10 Hz on slow frames.

## Product loop
Preview → camera permission → neutral calibration → expression interaction. Host may begin a 30-second round, pause, resume, or finish. Ending a round clears effects; closing the live view also releases camera tracks. Manual previews are labeled and do not masquerade as live detection.

## Tested / untested
Syntax and browser UI flows tested. 390px mobile layout checked. Real-camera expression accuracy, low-end device performance, and TikTok integration are unverified. GitHub research candidates were inaccessible; no code was copied from those repositories.

## Assets
Preview portrait loaded from https://images.unsplash.com/photo-1534528741775-53994a69daeb . It is a static scene illustration, not a live host or endorsement. Replace with approved original creator footage before final submission. Export deliberately excludes this remote portrait; camera-mode export contains the user's local camera frame only after their explicit capture action.
