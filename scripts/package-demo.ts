import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
for (const [source, target] of [
  ['docs/social-preview.png', 'social-preview.png'],
  ['docs/videos/magi-demo.mp4', 'magi-demo.mp4'],
  ['docs/videos/magi-demo-vertical.mp4', 'magi-demo-vertical.mp4'],
  ['docs/videos/magi-demo-poster.png', 'magi-demo-poster.png'],
])
  if (existsSync(source)) copyFileSync(source, `dist-demo/${target}`);
writeFileSync('dist-demo/.nojekyll', '');
