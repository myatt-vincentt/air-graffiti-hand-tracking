# dev-media

Optional dev-only preview media. Nothing here ships: only
`src/DevMediaSwitcher.tsx` reads this folder, and it is stripped from
production builds.

You don't need anything here. Without a webcam, `pnpm dev` starts on the SDK's
built-in "Person ThumbUp" video and lists every SDK sample video and image.

To preview with your own clip, add a portrait video of a hand at
`dev-media/hand.mp4` (H.264 MP4); it is listed first and used as the start.
Clips here are git-ignored (licence not cleared for a public repo). Restart
`pnpm dev` after adding or removing one.

The original preview, `palm_hand_preview_vertical.mov` (an open palm, which
demos the wipe), was repackaged without its audio as `hand.mp4`:

    ffmpeg -i palm_hand_preview_vertical.mov -c:v copy -an -movflags +faststart hand.mp4

In the built-in preview there's also a dev-only mouse pen (see
`src/DevPen.tsx`).
