import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import gifenc from 'gifenc';
import sharp from 'sharp';

const { GIFEncoder, applyPalette, quantize } = gifenc;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const spriteDirectory = path.join(repoRoot, 'public', 'giveaways', 'sprites');
const outputPath = path.join(repoRoot, 'tmp', 'giveaway-chest-preview.gif');

const FRAME_WIDTH = 48;
const FRAME_HEIGHT = 32;
const TEXTURE_SIZE = 128;
const FRAME_COUNT = 22;
const FRAME_DELAY_MS = 100;
const SCALE = 6;
const DETAIL_OPACITY = 0.42;
const TEXTURE_OPACITY = 0.96;
const CONTRAST_INTERCEPT = -(128 * 1.28) + 128;

function alphaIndex(width, x, y) {
  return ((y * width) + x) * 4 + 3;
}

function rgbaIndex(width, x, y) {
  return ((y * width) + x) * 4;
}

function blendPixel(target, offset, sourceR, sourceG, sourceB, sourceA) {
  const destinationA = target[offset + 3] / 255;
  const normalizedSourceA = sourceA / 255;
  const outA = normalizedSourceA + (destinationA * (1 - normalizedSourceA));

  if (outA <= 0) {
    target[offset] = 0;
    target[offset + 1] = 0;
    target[offset + 2] = 0;
    target[offset + 3] = 0;
    return;
  }

  const destinationR = target[offset] / 255;
  const destinationG = target[offset + 1] / 255;
  const destinationB = target[offset + 2] / 255;
  const outR = ((sourceR / 255) * normalizedSourceA + destinationR * destinationA * (1 - normalizedSourceA)) / outA;
  const outG = ((sourceG / 255) * normalizedSourceA + destinationG * destinationA * (1 - normalizedSourceA)) / outA;
  const outB = ((sourceB / 255) * normalizedSourceA + destinationB * destinationA * (1 - normalizedSourceA)) / outA;

  target[offset] = Math.round(outR * 255);
  target[offset + 1] = Math.round(outG * 255);
  target[offset + 2] = Math.round(outB * 255);
  target[offset + 3] = Math.round(outA * 255);
}

function extractFrame(raw, imageWidth, frameIndex) {
  const frame = new Uint8ClampedArray(FRAME_WIDTH * FRAME_HEIGHT * 4);
  const startX = frameIndex * FRAME_WIDTH;

  for (let y = 0; y < FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      const sourceOffset = rgbaIndex(imageWidth, startX + x, y);
      const targetOffset = rgbaIndex(FRAME_WIDTH, x, y);
      frame[targetOffset] = raw[sourceOffset];
      frame[targetOffset + 1] = raw[sourceOffset + 1];
      frame[targetOffset + 2] = raw[sourceOffset + 2];
      frame[targetOffset + 3] = raw[sourceOffset + 3];
    }
  }

  return frame;
}

async function readRawSprite(filename) {
  const filePath = path.join(spriteDirectory, filename);
  return sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function createDetailLayer() {
  const filePath = path.join(spriteDirectory, 'chest.png');
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .modulate({
      brightness: 0.72,
      saturation: 0.52,
    })
    .linear(1.28, CONTRAST_INTERCEPT)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  };
}

function renderFrame({
  texture,
  mask,
  detail,
  textureOffsetY,
}) {
  const frame = new Uint8ClampedArray(FRAME_WIDTH * FRAME_HEIGHT * 4);

  for (let y = 0; y < FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      const frameOffset = rgbaIndex(FRAME_WIDTH, x, y);
      const maskA = mask[alphaIndex(FRAME_WIDTH, x, y)] / 255;

      if (maskA > 0) {
        const textureX = ((x % TEXTURE_SIZE) + TEXTURE_SIZE) % TEXTURE_SIZE;
        const textureY = ((y + textureOffsetY) % TEXTURE_SIZE + TEXTURE_SIZE) % TEXTURE_SIZE;
        const textureOffset = rgbaIndex(TEXTURE_SIZE, textureX, textureY);
        const textureA = Math.round(texture[textureOffset + 3] * maskA * TEXTURE_OPACITY);

        if (textureA > 0) {
          blendPixel(
            frame,
            frameOffset,
            texture[textureOffset],
            texture[textureOffset + 1],
            texture[textureOffset + 2],
            textureA,
          );
        }
      }

      const detailA = Math.round(detail[frameOffset + 3] * DETAIL_OPACITY);
      if (detailA > 0) {
        blendPixel(
          frame,
          frameOffset,
          detail[frameOffset],
          detail[frameOffset + 1],
          detail[frameOffset + 2],
          detailA,
        );
      }
    }
  }

  return frame;
}

function ensureTransparentColor(palette) {
  const transparentIndex = palette.findIndex((color) => color[3] === 0);
  if (transparentIndex >= 0) {
    return {
      palette,
      transparentIndex,
    };
  }

  const nextPalette = [[0, 0, 0, 0], ...palette.slice(0, 255)];
  return {
    palette: nextPalette,
    transparentIndex: 0,
  };
}

async function scaleFrame(frame) {
  const { data } = await sharp(frame, {
    raw: {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      channels: 4,
    },
  })
    .resize(FRAME_WIDTH * SCALE, FRAME_HEIGHT * SCALE, {
      kernel: 'nearest',
      fit: 'fill',
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return new Uint8ClampedArray(data);
}

async function main() {
  const [
    maskStrip,
    textureSprite,
    detailLayer,
  ] = await Promise.all([
    readRawSprite('chest-opening-animation-mask.png'),
    readRawSprite('infernal-cape-texture.png'),
    createDetailLayer(),
  ]);

  const maskFrame = extractFrame(new Uint8ClampedArray(maskStrip.data), maskStrip.info.width, 0);
  const detailFrame = new Uint8ClampedArray(detailLayer.data);
  const texture = new Uint8ClampedArray(textureSprite.data);
  const renderedFrames = [];

  for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
    const textureOffsetY = Math.round((frameIndex / FRAME_COUNT) * TEXTURE_SIZE);
    const composed = renderFrame({
      texture,
      mask: maskFrame,
      detail: detailFrame,
      textureOffsetY,
    });
    renderedFrames.push(await scaleFrame(composed));
  }

  const allPixels = new Uint8ClampedArray(renderedFrames.length * renderedFrames[0].length);
  renderedFrames.forEach((frame, frameIndex) => {
    allPixels.set(frame, frameIndex * frame.length);
  });

  const { palette, transparentIndex } = ensureTransparentColor(
    quantize(allPixels, 256, {
      format: 'rgba4444',
      oneBitAlpha: true,
      clearAlpha: true,
    }),
  );

  const gif = GIFEncoder();
  const width = FRAME_WIDTH * SCALE;
  const height = FRAME_HEIGHT * SCALE;

  renderedFrames.forEach((frame, frameIndex) => {
    const index = applyPalette(frame, palette, 'rgba4444');
    gif.writeFrame(index, width, height, {
      palette,
      transparent: true,
      transparentIndex,
      delay: FRAME_DELAY_MS,
      repeat: frameIndex === 0 ? 0 : undefined,
      dispose: 2,
    });
  });

  gif.finish();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, gif.bytes());
  console.log(outputPath);
}

main().catch((error) => {
  console.error('[render-giveaway-chest-preview-gif] Failed to render preview GIF.');
  console.error(error);
  process.exitCode = 1;
});
