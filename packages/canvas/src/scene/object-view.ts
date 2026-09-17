/**
 * Renders freely positioned desk objects (sticky notes, images, file
 * chips, freeform text) into PixiJS containers.
 *
 * Views rotate around their center (matching CSS transform-origin), so the
 * container's position is the object's center and callers place it at
 * `(x + width/2, y + height/2)`.
 */

import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';

import type { DeskObject } from '@infinite-desk/domain';

import {
  CHECKLIST_BOX,
  CHECKLIST_BOX_OFFSET_Y,
  CHECKLIST_ROW_H,
  stickyPad,
} from '../sticky-layout';
import { mixColors, type ThemeTokens } from './theme';

/**
 * Opacity of an empty object's on-paper prompt. The design system asks for
 * "quiet prompts on the paper itself" rather than blank surfaces, and the
 * prompt must stay clearly lighter than real ink so it never reads as content.
 */
const PROMPT_ALPHA = 0.38;

/** Height of the caption band under a photo, in world units. */
export const IMAGE_CAPTION_HEIGHT = 28;

/** File-kind label and tint for the attachment chip's icon square. */
const FILE_KINDS = {
  pdf: { label: 'PDF', c: 'red' },
  doc: { label: 'DOC', c: 'blue' },
  sheet: { label: 'XLS', c: 'green' },
  link: { label: 'URL', c: 'teal' },
  file: { label: 'FILE', c: 'olive' },
} as const;

/**
 * Builds the display container for a desk object, sized to the object.
 *
 * @param texture - Loaded bitmap for an image object. Absent while the file is
 *   still loading, or when the object has no attachment, in which case the
 *   frame draws empty and the view is rebuilt once the bitmap arrives.
 */
export function buildObjectView(
  object: DeskObject,
  theme: ThemeTokens,
  texture?: Texture,
): Container {
  const container = new Container();
  const { width, height } = object;
  container.pivot.set(width / 2, height / 2);
  container.position.set(object.x + width / 2, object.y + height / 2);
  container.angle = object.rotation;

  switch (object.payload.kind) {
    case 'sticky':
      buildSticky(container, object, theme);
      break;
    case 'image':
      buildImage(container, object, theme, texture);
      break;
    case 'file':
      buildFile(container, object, theme);
      break;
    case 'text':
      buildText(container, object, theme);
      break;
  }
  return container;
}

/** Paper sticky note with text or a checklist, pin, and shadow. */
function buildSticky(container: Container, object: DeskObject, theme: ThemeTokens): void {
  if (object.payload.kind !== 'sticky') return;
  const { width, height } = object;
  const palette = theme.stationery[object.payload.color] ?? theme.stationery.yellow;

  const paper = new Graphics();
  paper.roundRect(3, 5, width, height, 3).fill({ color: theme.shadowInk, alpha: 0.12 }); // soft shadow
  paper.roundRect(0, 0, width, height, 3).fill(palette.fill);
  container.addChild(paper);

  const compact = !!object.payload.compact;
  const pad = stickyPad(compact);

  if (object.payload.items?.length) {
    let y = pad;
    const boxY = CHECKLIST_BOX_OFFSET_Y;
    for (const item of object.payload.items) {
      const box = new Graphics();
      box
        .roundRect(pad, y + boxY, CHECKLIST_BOX, CHECKLIST_BOX, 3)
        .stroke({ width: 2, color: palette.ink, alpha: 0.7 });
      if (item.done) {
        box
          .moveTo(pad + 3, y + boxY + 7)
          .lineTo(pad + 7, y + boxY + 11)
          .lineTo(pad + 13, y + boxY + 3)
          .stroke({ width: 2, color: palette.ink });
      }
      container.addChild(box);
      const blank = item.label.length === 0;
      const label = new Text({
        // A quiet prompt on the paper, never payload — an empty row would
        // otherwise be half a component: a tickbox labelling nothing.
        text: blank ? 'Add a task' : item.label,
        style: { fontFamily: theme.fontUI, fontSize: 20, fill: palette.ink },
      });
      label.position.set(pad + 24, y);
      label.alpha = blank ? PROMPT_ALPHA : item.done ? 0.55 : 1;
      container.addChild(label);
      if (item.done && !blank) {
        const strike = new Graphics();
        strike
          .moveTo(label.x, y + 12)
          .lineTo(label.x + label.width, y + 12)
          .stroke({ width: 1.5, color: palette.ink, alpha: 0.7 });
        container.addChild(strike);
      }
      y += CHECKLIST_ROW_H;
    }
  } else {
    const blank = object.payload.text.length === 0;
    const text = new Text({
      text: blank ? 'Double-click to write' : object.payload.text,
      style: {
        fontFamily: object.payload.hand ? theme.fontHand : theme.fontUI,
        fontSize: compact ? 22 : 26,
        fill: palette.ink,
        wordWrap: true,
        wordWrapWidth: width - 2 * pad,
        lineHeight: compact ? 26 : 32,
      },
    });
    text.position.set(pad, pad);
    text.alpha = blank ? PROMPT_ALPHA : 1;
    container.addChild(text);
  }

  if (object.payload.pinned) {
    const pin = new Graphics();
    pin.circle(width / 2, 0, 8).fill(theme.danger).stroke({ width: 2.5, color: 0xffffff, alpha: 0.5 });
    container.addChild(pin);
  }
}

/** Photo with caption: the imported bitmap when loaded, its frame otherwise. */
function buildImage(
  container: Container,
  object: DeskObject,
  theme: ThemeTokens,
  texture?: Texture,
): void {
  if (object.payload.kind !== 'image') return;
  const { width, height } = object;
  const captionH = object.payload.caption ? IMAGE_CAPTION_HEIGHT : 0;
  const photoH = height - captionH;

  const photo = new Graphics();
  // Shadow on all sides, not only down-right: a print lifts off the desk, and
  // the top and left edges otherwise meet the paper with nothing between them.
  photo
    .rect(-1, -1, width + 4, photoH + 5)
    .fill({ color: theme.shadowInk, alpha: 0.13 });
  photo
    .rect(0, 0, width, photoH)
    .fill(mixColors(theme.stationery.teal.soft, theme.stationery.blue.soft, 0.5));
  container.addChild(photo);

  if (texture) {
    // Fill the frame and crop the overflow, the way a photo sits in a mount,
    // rather than letterboxing it onto the paper.
    const sprite = new Sprite(texture);
    const scale = Math.max(width / texture.width, photoH / texture.height);
    sprite.scale.set(scale);
    sprite.position.set(
      (width - texture.width * scale) / 2,
      (photoH - texture.height * scale) / 2,
    );
    const crop = new Graphics().rect(0, 0, width, photoH).fill(0xffffff);
    container.addChild(crop, sprite);
    sprite.mask = crop;
    // A thin mount edge, so a saturated photo has a border against the paper
    // and against the dark desk, where the cast shadow cannot be seen.
    const edge = new Graphics();
    edge
      .rect(0, 0, width, photoH)
      .stroke({ width: 1.5, color: theme.divider, alignment: 1 });
    container.addChild(edge);
  } else if (object.payload.attachmentId) {
    // Waiting on the file. Says so quietly, the way an empty note does, and
    // distinguishes a loading photo from a frame that has no picture at all.
    const waiting = new Text({
      text: 'Loading picture…',
      style: { fontFamily: theme.fontUI, fontSize: 16, fill: theme.inkPrimary },
    });
    waiting.position.set((width - waiting.width) / 2, photoH / 2 - 10);
    waiting.alpha = PROMPT_ALPHA;
    container.addChild(waiting);
  }

  if (object.payload.frame === 'framed') {
    // Its own graphic, drawn after the bitmap: the mount sits on top of the
    // photo, and re-adding `photo` here would lift it over the sprite instead.
    const mount = new Graphics();
    mount.rect(0, 0, width, photoH).stroke({ width: 8, color: theme.surfaceRaised, alignment: 1 });
    container.addChild(mount);
  }

  if (object.payload.frame === 'taped') {
    // Two strips crossing the corners diagonally, each with its own rotation —
    // one shared graphic can only carry one angle, which is why this used to
    // read as a pair of stickers. Colour comes from the theme so it stays
    // tape-coloured on the dark desk instead of going muddy.
    for (const [centreX, angle] of [
      [4, -40],
      [width - 4, 40],
    ] as const) {
      const strip = new Graphics();
      strip.rect(-17, -7, 34, 14).fill({ color: theme.stationery.yellow.fill, alpha: 0.55 });
      strip.position.set(centreX, 2);
      strip.angle = angle;
      container.addChild(strip);
    }
  }

  if (object.payload.caption) {
    // On its own paper band under the print, and clearly smaller than a chip
    // title — written on the mount rather than floating over the calendar.
    const band = new Graphics();
    band.rect(0, photoH, width, captionH).fill(theme.surfacePaper);
    container.addChild(band);
    const caption = new Text({
      text: object.payload.caption,
      style: { fontFamily: theme.fontUI, fontSize: 15, fill: theme.inkMuted },
    });
    caption.position.set(width / 2 - caption.width / 2, photoH + 6);
    container.addChild(caption);
  }
}

/** File attachment chip with a tinted kind square, name, and metadata. */
function buildFile(container: Container, object: DeskObject, theme: ThemeTokens): void {
  if (object.payload.kind !== 'file') return;
  const { width, height } = object;
  const kind = FILE_KINDS[object.payload.fileKind] ?? FILE_KINDS.file;
  const palette = theme.stationery[kind.c];

  const chip = new Graphics();
  chip.roundRect(2, 4, width, height, 6).fill({ color: theme.shadowInk, alpha: 0.08 });
  chip
    .roundRect(0, 0, width, height, 6)
    .fill(theme.surfaceRaised)
    .stroke({ width: 1.5, color: theme.border });
  chip.roundRect(10, height / 2 - 17, 34, 34, 5).fill(palette.soft);
  container.addChild(chip);

  const kindLabel = new Text({
    text: kind.label,
    style: { fontFamily: theme.fontUI, fontSize: 11, fontWeight: '600', fill: palette.ink },
  });
  kindLabel.position.set(27 - kindLabel.width / 2, height / 2 - kindLabel.height / 2);
  container.addChild(kindLabel);

  const name = new Text({
    text: object.payload.name,
    style: { fontFamily: theme.fontUI, fontSize: 19, fill: theme.inkPrimary },
  });
  name.position.set(54, 10);
  container.addChild(name);
  const meta = new Text({
    text: object.payload.meta,
    style: { fontFamily: theme.fontUI, fontSize: 15, fill: theme.inkMuted },
  });
  meta.position.set(54, 34);
  container.addChild(meta);
}

/** Freeform handwritten text written directly on the paper. */
function buildText(container: Container, object: DeskObject, theme: ThemeTokens): void {
  if (object.payload.kind !== 'text') return;
  const text = new Text({
    text: object.payload.text,
    style: {
      fontFamily: theme.fontHand,
      fontSize: 30,
      fill: theme.inkPrimary,
      wordWrap: true,
      wordWrapWidth: object.width,
      lineHeight: 38,
    },
  });
  text.position.set(4, 4);
  container.addChild(text);
}
