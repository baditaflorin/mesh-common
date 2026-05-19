import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type { YRoom } from "./useYRoom";

/**
 * Chunked file share through the room's existing Yjs transport. Files are
 * split into base64 chunks and stored in two parallel Y types:
 *
 *   Y.Map<fileId, FileManifest>   // metadata
 *   Y.Map<fileId, Y.Array<string>> // base64 chunks, in order
 *
 * (Y.Array must be a top-level attached Y type — you can't nest it inside
 * a plain-object Y.Map value, Yjs would JSON-serialize the whole thing.)
 *
 * The receiver reassembles a `Blob` and exposes a `download(fileId)` helper.
 * "Done" is `chunks.length === manifest.chunks`. No file-channel protocol
 * negotiation — we ride the room's CRDT pipe.
 *
 *   const fs = useFileShare(room);
 *   <input type="file" onChange={(e) => e.target.files?.[0] && fs.send(e.target.files[0])} />
 *   {fs.files.map((f) => <a onClick={() => fs.download(f.id)}>{f.manifest.name}</a>)}
 *
 * Honest framing:
 *  - Files live in Yjs history forever (until the room is GC'd). Don't share
 *    secrets this way. For small images / PDFs this is fine; for large or
 *    private payloads, prefer a direct WebRTC data channel.
 *  - Default chunk size is 16 KB (base64 → ~22 KB on the wire). Tune via
 *    `chunkBytes` if you have lots of small peers and want flushiness.
 *  - Caller-side back-pressure: we await Yjs transactions but don't throttle
 *    transmission; for files >5 MB the UI may jank. Use `signWith` if you
 *    care about integrity.
 */

export type FileManifest = {
  name: string;
  mimeType: string;
  size: number;
  chunks: number;
  by: string;
  at: number;
};

export type SharedFile = {
  id: string;
  manifest: FileManifest;
  /** Bytes received so far (sum of base64-decoded chunk lengths). */
  received: number;
  /** True iff every chunk is present. */
  complete: boolean;
};

export type FileShareApi = {
  files: SharedFile[];
  send(blob: File | Blob, opts?: { name?: string; id?: string }): Promise<string>;
  /** Triggers a browser download of an assembled file (must be `complete`). */
  download(fileId: string): Promise<void>;
  /** Get the assembled Blob (returns null if not yet complete). */
  blobOf(fileId: string): Promise<Blob | null>;
  /** Remove a file from the room. */
  remove(fileId: string): void;
};

export type FileShareOptions = {
  /** Prefix for the two Y.Maps used (manifests + chunks). Default "mesh:files". */
  mapName?: string;
  /** Bytes per chunk before base64. Default 16 * 1024 = 16384. */
  chunkBytes?: number;
  /** Maximum file size in bytes. Default 5 MB. */
  maxBytes?: number;
};

function names(prefix: string): { manifests: string; chunks: string } {
  return { manifests: `${prefix}:manifests`, chunks: `${prefix}:chunks` };
}

function newId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function useFileShare(room: YRoom | null, opts?: FileShareOptions): FileShareApi {
  const mapName = opts?.mapName ?? "mesh:files";
  const chunkBytes = opts?.chunkBytes ?? 16 * 1024;
  const maxBytes = opts?.maxBytes ?? 5 * 1024 * 1024;

  const [files, setFiles] = useState<SharedFile[]>([]);

  useEffect(() => {
    if (!room) {
      setFiles([]);
      return;
    }
    const { manifests: mName, chunks: cName } = names(mapName);
    const manifests = room.doc.getMap<FileManifest>(mName);
    const chunksMap = room.doc.getMap<Y.Array<string>>(cName);

    const recompute = () => {
      const out: SharedFile[] = [];
      for (const [id, manifest] of manifests.entries()) {
        if (!manifest || typeof manifest !== "object") continue;
        const arr = chunksMap.get(id);
        const have = arr instanceof Y.Array ? arr.length : 0;
        const received =
          arr instanceof Y.Array
            ? arr.toArray().reduce((acc, c) => acc + Math.floor((c.length * 3) / 4), 0)
            : 0;
        out.push({
          id,
          manifest,
          received,
          complete: have === manifest.chunks,
        });
      }
      out.sort((a, b) => a.manifest.at - b.manifest.at);
      setFiles(out);
    };

    recompute();
    manifests.observeDeep(recompute);
    chunksMap.observeDeep(recompute);
    return () => {
      manifests.unobserveDeep(recompute);
      chunksMap.unobserveDeep(recompute);
    };
  }, [room, mapName]);

  const send = useCallback<FileShareApi["send"]>(
    async (blob, sendOpts) => {
      if (!room) throw new Error("useFileShare: room is null");
      if (blob.size > maxBytes) throw new Error(`useFileShare: file too large (${blob.size} > ${maxBytes})`);
      const id = sendOpts?.id ?? newId();
      const name = sendOpts?.name ?? (blob instanceof File ? blob.name : "file");
      const buf = new Uint8Array(await blob.arrayBuffer());
      const total = Math.ceil(buf.length / chunkBytes) || 1;

      const { manifests: mName, chunks: cName } = names(mapName);
      const manifests = room.doc.getMap<FileManifest>(mName);
      const chunksMap = room.doc.getMap<Y.Array<string>>(cName);

      const manifest: FileManifest = {
        name,
        mimeType: blob.type || "application/octet-stream",
        size: buf.length,
        chunks: total,
        by: room.peerId,
        at: Date.now(),
      };

      const chunksArr = new Y.Array<string>();
      // Attach Y.Array to the doc by inserting it as a top-level value.
      room.doc.transact(() => {
        manifests.set(id, manifest);
        chunksMap.set(id, chunksArr);
      });

      for (let i = 0; i < total; i++) {
        const slice = buf.subarray(i * chunkBytes, Math.min((i + 1) * chunkBytes, buf.length));
        const b64 = bytesToBase64(slice);
        room.doc.transact(() => {
          chunksArr.push([b64]);
        });
      }

      return id;
    },
    [room, mapName, chunkBytes, maxBytes],
  );

  const blobOf = useCallback<FileShareApi["blobOf"]>(
    async (fileId) => {
      if (!room) return null;
      const { manifests: mName, chunks: cName } = names(mapName);
      const manifest = room.doc.getMap<FileManifest>(mName).get(fileId);
      const arr = room.doc.getMap<Y.Array<string>>(cName).get(fileId);
      if (!manifest || !(arr instanceof Y.Array)) return null;
      if (arr.length !== manifest.chunks) return null;
      const parts: BlobPart[] = [];
      for (const b64 of arr.toArray()) {
        const bytes = base64ToBytes(b64);
        // Copy into a fresh ArrayBuffer so the TS lib's strict BlobPart type matches.
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        parts.push(new Uint8Array(ab as ArrayBuffer));
      }
      return new Blob(parts, { type: manifest.mimeType });
    },
    [room, mapName],
  );

  const download = useCallback<FileShareApi["download"]>(
    async (fileId) => {
      const blob = await blobOf(fileId);
      if (!blob || typeof document === "undefined") return;
      const file = files.find((f) => f.id === fileId);
      const name = file?.manifest.name ?? fileId;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    },
    [blobOf, files],
  );

  const remove = useCallback<FileShareApi["remove"]>(
    (fileId) => {
      if (!room) return;
      const { manifests: mName, chunks: cName } = names(mapName);
      room.doc.transact(() => {
        room.doc.getMap<FileManifest>(mName).delete(fileId);
        room.doc.getMap<Y.Array<string>>(cName).delete(fileId);
      });
    },
    [room, mapName],
  );

  return useMemo(() => ({ files, send, download, blobOf, remove }), [files, send, download, blobOf, remove]);
}
