import { useCallback, useRef, useState } from "react";

export type FileDropRejectReason = "type" | "size" | "count" | "invalid";
export type RejectedFile = { file: File; reason: FileDropRejectReason };
export type FileDropResult = { accepted: File[]; rejected: RejectedFile[] };

export type FileDropOptions = {
  /** MIME types (`image/png`), wildcards (`image/*`), or extensions (`.png`). */
  accept?: string[];
  maxFiles?: number;
  maxBytes?: number;
  multiple?: boolean;
  validate?: (file: File) => boolean;
  onFiles?: (result: FileDropResult) => void;
};

export type FileDrop = {
  files: File[];
  rejected: RejectedFile[];
  isDragging: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Validate and append local files; no upload or sharing occurs. */
  add: (files: Iterable<File>) => FileDropResult;
  remove: (index: number) => void;
  clear: () => void;
  open: () => void;
  inputProps: {
    accept?: string;
    multiple: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  };
  dropzoneProps: {
    onDragEnter: (event: React.DragEvent<HTMLElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
    onDrop: (event: React.DragEvent<HTMLElement>) => void;
  };
};

function accepts(file: File, rules: string[]): boolean {
  if (rules.length === 0) return true;
  const filename = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return rules.some((rawRule) => {
    const rule = rawRule.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith(".")) return filename.endsWith(rule);
    if (rule.endsWith("/*")) return mime.startsWith(rule.slice(0, -1));
    return mime === rule;
  });
}

/**
 * Local, accessible file-input/dropzone state with bounded validation.
 *
 * This hook never uploads, serializes, or shares file bytes. Pair it with an
 * explicit app action (or `useFileShare` for small, consciously shared files)
 * after displaying accepted/rejected feedback to the user.
 */
export function useFileDrop(options: FileDropOptions = {}): FileDrop {
  const rules = options.accept ?? [];
  const maxFiles = Math.max(
    1,
    Math.floor(options.maxFiles ?? Number.POSITIVE_INFINITY),
  );
  const maxBytes = Math.max(0, options.maxBytes ?? Number.POSITIVE_INFINITY);
  const multiple = options.multiple ?? maxFiles > 1;
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const add = useCallback<FileDrop["add"]>(
    (incoming) => {
      const accepted: File[] = [];
      const nextRejected: RejectedFile[] = [];
      let available = Math.max(0, maxFiles - files.length);
      for (const file of incoming) {
        if (typeof File === "undefined" || !(file instanceof File)) continue;
        if (!accepts(file, rules)) {
          nextRejected.push({ file, reason: "type" });
        } else if (file.size > maxBytes) {
          nextRejected.push({ file, reason: "size" });
        } else if (options.validate?.(file) === false) {
          nextRejected.push({ file, reason: "invalid" });
        } else if (available <= 0) {
          nextRejected.push({ file, reason: "count" });
        } else {
          accepted.push(file);
          available -= 1;
        }
      }
      const result = { accepted, rejected: nextRejected };
      if (accepted.length) setFiles((current) => [...current, ...accepted]);
      setRejected(nextRejected);
      options.onFiles?.(result);
      return result;
    },
    [files.length, maxBytes, maxFiles, options, rules],
  );

  const suppress = (event: React.DragEvent<HTMLElement>) =>
    event.preventDefault();
  return {
    files,
    rejected,
    isDragging,
    inputRef,
    add,
    remove: (index) =>
      setFiles((current) =>
        current.filter((_, itemIndex) => itemIndex !== index),
      ),
    clear: () => {
      setFiles([]);
      setRejected([]);
    },
    open: () => inputRef.current?.click(),
    inputProps: {
      accept: rules.length ? rules.join(",") : undefined,
      multiple,
      onChange: (event) => {
        add(Array.from(event.currentTarget.files ?? []));
        event.currentTarget.value = "";
      },
    },
    dropzoneProps: {
      onDragEnter: (event) => {
        suppress(event);
        setDragging(true);
      },
      onDragOver: (event) => {
        suppress(event);
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: (event) => {
        suppress(event);
        setDragging(false);
      },
      onDrop: (event) => {
        suppress(event);
        setDragging(false);
        add(Array.from(event.dataTransfer.files));
      },
    },
  };
}
