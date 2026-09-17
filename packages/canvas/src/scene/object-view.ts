/**
 * Renders freely positioned desk objects (sticky notes, images, file
 * chips, freeform text) into PixiJS containers.
 *
 * Views rotate around their center (matching CSS transform-origin), so the
 * container's position is the object's center and callers place it at
 * `(x + width/2, y + height/2)`.
 */

import { Container, Graphics, Text } from 'pixi.js';

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

/** File-kind label and tint for the attachment chip's icon square. */
const FILE_KINDS = {
  pdf: { label: 'PDF', c: 'red' },
  doc: { label: 'DOC', c: 'blue' },
  sheet: { label: 'XLS', c: 'green' },
  link: { label: 'URL', c: 'teal' },
  file: { label: 'FILE', c: 'olive' },
} as const;

/** Builds the display container for a desk object, sized to the object. */
export function buildObjectView(object: DeskObject, theme: ThemeTokens): Container {
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
      buildImage(container, object, theme);
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

/** Taped photo placeholder with caption. */
function buildImage(container: Container, object: DeskObject, theme: ThemeTokens): void {
  if (object.payload.kind !== 'image') return;
  const { width, height } = object;
  const captionH = object.payload.caption ? 28 : 0;
  const photoH = height - captionH;

  const photo = new Graphics();
  photo.rect(2, 4, width, photoH).fill({ color: theme.shadowInk, alpha: 0.1 });
  photo
    .rect(0, 0, width, photoH)
    .fill(mixColors(theme.stationery.teal.soft, theme.stationery.blue.soft, 0.5));
  if (object.payload.frame === 'framed') {
    photo.rect(0, 0, width, photoH).stroke({ width: 8, color: theme.surfaceRaised, alignment: 1 });
  }
  container.addChild(photo);

  if (object.payload.frame === 'taped') {
    const tape = new Graphics();
    tape.rect(-14, -8, 44, 18).fill({ color: 0xd6c586, alpha: 0.55 });
    tape.rect(width - 30, -8, 44, 18).fill({ color: 0xd6c586, alpha: 0.55 });
    tape.angle = 0;
    container.addChild(tape);
  }

  if (object.payload.caption) {
    const caption = new Text({
      text: object.payload.caption,
      style: { fontFamily: theme.fontUI, fontSize: 17, fill: theme.inkSecondary },
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
