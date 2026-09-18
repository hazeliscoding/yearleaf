/**
 * Registry of the Lucide glyphs Deskbound uses, keyed by the kebab-case
 * names the design reference uses (`mouse-pointer-2`, `pen-line`, …).
 *
 * Only the icons the product actually renders are imported, keeping the
 * bundle tree-shaken. Lucide is a flagged substitution in the design
 * brief — swap this registry when a custom icon set exists.
 *
 * Lucide's `command` is deliberately absent: it draws the ⌘ loop as a path,
 * which named a key Windows keyboards do not have while sitting on the same
 * toolbar row as a `Ctrl` keycap that contradicted it. Leaving it out of the
 * registry makes that a compile error rather than a thing to remember.
 */

import {
  Bell,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  File,
  FileText,
  Flag,
  GripVertical,
  Hand,
  Highlighter,
  History,
  Image,
  Lasso,
  Layers2,
  Link2,
  List,
  Lock,
  Minus,
  Moon,
  MousePointer2,
  MoveUpRight,
  Pencil,
  PenLine,
  Plane,
  Plus,
  Redo2,
  Repeat,
  Search,
  Stamp,
  StickyNote,
  Sun,
  SquareCheck,
  Table2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  type IconNode,
} from 'lucide';

/** Kebab-case icon name → Lucide icon node data. */
const ICONS = {
  'bell': Bell,
  'calendar': Calendar,
  'calendar-plus': CalendarPlus,
  'check': Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'eraser': Eraser,
  'eye': Eye,
  'eye-off': EyeOff,
  'file': File,
  'file-text': FileText,
  'flag': Flag,
  'grip-vertical': GripVertical,
  'hand': Hand,
  'highlighter': Highlighter,
  'history': History,
  'image': Image,
  'lasso': Lasso,
  'layers-2': Layers2,
  'link-2': Link2,
  'list': List,
  'lock': Lock,
  'minus': Minus,
  'moon': Moon,
  'mouse-pointer-2': MousePointer2,
  'move-up-right': MoveUpRight,
  'pen-line': PenLine,
  'pencil': Pencil,
  'plane': Plane,
  'plus': Plus,
  'redo-2': Redo2,
  'repeat': Repeat,
  'search': Search,
  'stamp': Stamp,
  'sticky-note': StickyNote,
  'sun': Sun,
  'square-check': SquareCheck,
  'table-2': Table2,
  'type': Type,
  'undo-2': Undo2,
  'x': X,
  'zoom-in': ZoomIn,
  'zoom-out': ZoomOut,
} satisfies Record<string, IconNode>;

/** Every icon name Deskbound components accept. */
export type IconName = keyof typeof ICONS;

/** Resolves an icon's node data, or `undefined` for unknown names. */
export function iconNodeFor(name: IconName): IconNode | undefined {
  return ICONS[name];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Renders a Lucide icon node into a real `<svg>` element with Deskbound's
 * stroke conventions (currentColor, 1.5px stroke).
 *
 * @param node - Lucide icon node data from the registry.
 * @param size - Rendered width and height in pixels.
 */
export function renderIconNode(node: IconNode, size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const [tag, attrs] of node) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      child.setAttribute(key, String(value));
    }
    svg.appendChild(child);
  }
  return svg;
}
