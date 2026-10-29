# Screenshot provenance

The `demo-*.png` images and `share-preview.png` are captured by `npx tsx scripts/capture-demo-assets.ts` from the static public demo on isolated port 5192. They use the actual purpose-made public Codex recording, preserve its original English assessments and answer, and contain no account credentials or private history. Localized question headlines and card summaries are faithful editorial translations. The final-answer capture waits for the completed reveal and focus handoff. No model calls are made.

Other screenshots and `processing.gif` use authored documentation examples captured by `npm run screenshots` on isolated port 5187. They illustrate the local interface, not model performance or inference speed.

The repository cover and social preview reuse the illustrative processing GIF. Source: `scripts/readme-cover.html`; regenerate with `npm run social-preview`. Cover: 1600×720. Social preview: 1200×630.
