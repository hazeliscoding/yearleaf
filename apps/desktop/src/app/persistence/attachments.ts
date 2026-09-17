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

/**
 * Largest file the desk will import, mirroring the ceiling the Rust importer
 * enforces. Checked here too so an oversized drop is refused before the
 * browser decodes it — a thirty megabyte photo is hundreds of megabytes once
 * decoded, and paying that only to be turned away at the boundary is worse
 * than not starting.
 */
export const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;

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
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} is too large to import`);
    }
    const attachment = isTauri() ? await this.importToDisk(file) : this.importToMemory(file);
    this.byId.update((map) => new Map(map).set(attachment.id, attachment));
    return attachment;
  }

  private async importToDisk(file: File): Promise<Attachment> {
    // The bytes go over as the request body, not as a command argument: an
    // argument is serialized to a JSON array of integers, which would turn a
    // four megabyte photo into roughly twelve megabytes of text.
    const wire = await invoke<AttachmentWire>('import_attachment', await file.arrayBuffer(), {
      headers: {
        'desk-id': DESK_ID,
        'media-type': file.type || 'application/octet-stream',
        // Header values must be ASCII; a file name need not be.
        'file-name': encodeURIComponent(file.name),
      },
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
