/**
 * Imported binaries and the URLs the renderer loads them from.
 *
 * Two hosts, one interface: under Tauri the bytes are copied into the desk's
 * asset directory and served through the asset protocol, while a plain browser
 * keeps them in memory as object URLs and forgets them on reload. Nothing
 * outside this file needs to know which it is talking to.
 */

import { Injectable, inject, signal } from '@angular/core';
import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';

import { DESK_ID } from '../state/desk-store';

/** An imported file, as the application refers to it. */
export interface Attachment {
  readonly id: string;
  readonly fileName: string;
  readonly mediaType: string;
  readonly byteSize: number;
  /** URL the renderer can load; absent until resolved. */
  readonly url: string;
}

/** Wire shape returned by the import and load commands. */
interface AttachmentWire {
  id: string;
  fileName: string;
  relativePath: string;
  mediaType: string;
  byteSize: number;
  checksum: string;
  path: string;
}

@Injectable({ providedIn: 'root' })
export class AttachmentStore {
  /**
   * Everything imported on this desk, by id.
   *
   * Readable so the workspace can redraw when imports arrive: attachments and
   * desk objects load in parallel, and whichever loses the race would
   * otherwise leave restored pictures as empty frames until they were touched.
   */
  readonly byId = signal<ReadonlyMap<string, Attachment>>(new Map());

  constructor() {
    void this.hydrate();
  }

  /** Loads previously imported files so stored images can draw again. */
  private async hydrate(): Promise<void> {
    if (!isTauri()) return;
    try {
      const stored = await invoke<AttachmentWire[]>('load_attachments', { deskId: DESK_ID });
      const map = new Map<string, Attachment>();
      for (const wire of stored) map.set(wire.id, this.toAttachment(wire));
      this.byId.set(map);
    } catch (error) {
      console.error('attachment hydration failed', error);
    }
  }

  /** The URL for an attachment, or `null` when it is not on this desk. */
  urlFor(attachmentId: string): string | null {
    return this.byId().get(attachmentId)?.url ?? null;
  }

  /**
   * Imports a dropped file and returns it.
   *
   * On the desktop the bytes are copied into the desk directory and survive a
   * restart. In a browser there is nowhere to put them, so the object URL is
   * good for this session only — which is the same bargain the in-memory
   * persistence adapter already makes.
   */
  async import(file: File): Promise<Attachment> {
    const attachment = isTauri() ? await this.importToDisk(file) : this.importToMemory(file);
    this.byId.update((map) => new Map(map).set(attachment.id, attachment));
    return attachment;
  }

  private async importToDisk(file: File): Promise<Attachment> {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    const wire = await invoke<AttachmentWire>('import_attachment', {
      deskId: DESK_ID,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      bytes,
    });
    return this.toAttachment(wire);
  }

  private importToMemory(file: File): Attachment {
    return {
      id: `blob-${crypto.randomUUID()}`,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      byteSize: file.size,
      url: URL.createObjectURL(file),
    };
  }

  private toAttachment(wire: AttachmentWire): Attachment {
    return {
      id: wire.id,
      fileName: wire.fileName,
      mediaType: wire.mediaType,
      byteSize: wire.byteSize,
      // The asset protocol serves the desk directory; a raw path would be
      // blocked by the webview.
      url: convertFileSrc(wire.path),
    };
  }
}
