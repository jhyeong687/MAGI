import { PERSONAS, personaInfo, type Locale, type Run } from '../shared/domain.ts';
import { shareCopies, demoUrl } from './shareCopy.ts';
import { cardExcerpt } from './sharePresentation.ts';

export function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  limit: number,
) {
  const lines: string[] = [];
  let line = '';
  let truncated = false;
  const segments = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'word' }).segment(
      text.replace(/\s+/g, ' ').trim(),
    ),
    (part) => part.segment,
  );
  const tokens = segments.flatMap((part) =>
    context.measureText(part).width > width ? Array.from(part) : [part],
  );
  for (const token of tokens) {
    if (context.measureText(line + token).width > width && line) {
      lines.push(line.trim());
      line = '';
      if (lines.length === limit) {
        truncated = true;
        break;
      }
    }
    line = line ? line + token : token.trimStart();
  }
  if (lines.length < limit && line) lines.push(line.trim());
  if (truncated && lines.length) {
    const last = lines.length - 1;
    while (context.measureText(lines[last] + '…').width > width)
      lines[last] = Array.from(lines[last]).slice(0, -1).join('');
    lines[last] += '…';
  }
  return lines;
}

async function screenImage(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  const properties = [
    'fill',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'stroke-linecap',
    'stroke-linejoin',
    'opacity',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'letter-spacing',
    'text-anchor',
    'dominant-baseline',
    'paint-order',
    'visibility',
  ];
  originals.forEach((node, index) => {
    const computed = getComputedStyle(node);
    for (const property of properties)
      (copies[index] as SVGElement).style.setProperty(
        property,
        computed.getPropertyValue(property),
      );
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '640');
  clone.setAttribute('height', '480');
  clone.style.width = '640px';
  clone.style.height = '480px';
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function createShareImage(
  run: Run,
  svg: SVGSVGElement,
  locale: Locale,
  options: {
    question: boolean;
    answer: boolean;
    example: boolean;
    recorded?: boolean;
    title?: string;
    summary?: string;
    link?: string;
  },
) {
  if (!run.verdict || run.answer?.status !== 'completed')
    throw new Error('A completed decision is required.');
  await document.fonts.ready;
  const screen = await screenImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable.');
  const t = shareCopies[locale];
  context.fillStyle = '#030403';
  context.fillRect(0, 0, 1200, 1600);
  context.strokeStyle = '#9d692b';
  context.lineWidth = 3;
  context.strokeRect(28, 28, 1144, 1544);
  context.fillStyle = '#efa837';
  context.font = '900 76px Georgia, serif';
  context.fillText('MAGI', 64, 116);
  context.font = '20px "YuMincho", "Hiragino Mincho ProN", serif';
  context.fillText('三賢人合議システム', 335, 112);
  context.fillStyle = '#b8a17e';
  context.font = '18px Arial, sans-serif';
  context.fillText(options.recorded ? t.recorded : options.example ? t.example : t.local, 64, 157);
  context.fillStyle = '#ebdfc8';
  context.font = '600 32px Arial, "Hiragino Kaku Gothic ProN", sans-serif';
  wrapText(
    context,
    options.question ? (options.title ?? cardExcerpt(run.question, 96)) : t.hidden,
    1072,
    3,
  ).forEach((line, index) => context.fillText(line, 64, 214 + index * 40));
  // The exact same 4:3 Japanese SVG used on the terminal, with computed styles embedded.
  context.drawImage(screen, 40, 306, 1120, 840);
  const verdict = run.verdict;
  context.fillStyle =
    verdict.result === 'APPROVED' ? '#71e4ac' : verdict.result === 'DENIED' ? '#ed6b56' : '#dfbf70';
  context.font = 'bold 35px monospace';
  context.fillText(`${verdict.result}   ${verdict.ratio} / 3`, 64, 1177);
  context.font = '18px monospace';
  context.fillStyle = '#d2ba8f';
  PERSONAS.forEach((persona, index) =>
    context.fillText(
      `${personaInfo[persona].name}  ${run.cores[persona].finalVote}`,
      64 + index * 362,
      1220,
    ),
  );
  if (options.answer) {
    context.fillStyle = '#ebdfc8';
    context.font = '30px Arial, "Hiragino Kaku Gothic ProN", sans-serif';
    wrapText(
      context,
      options.summary ?? cardExcerpt(run.answer.content?.answer || '', 160),
      1072,
      5,
    ).forEach((line, index) => context.fillText(line, 64, 1285 + index * 36));
  }
  context.strokeStyle = '#70512e';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(64, 1490);
  context.lineTo(1136, 1490);
  context.stroke();
  context.fillStyle = '#bda477';
  context.font = '15px monospace';
  context.fillText(options.link || demoUrl, 64, 1524);
  context.font = '15px Arial, sans-serif';
  context.fillText('UNOFFICIAL FAN PROJECT · github.com/jhyeong687/MAGI', 64, 1554);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('PNG export failed.'))),
      'image/png',
    ),
  );
  return blob;
}
