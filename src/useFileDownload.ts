import { useCallback, useState } from "react";

export type FileDownloadApi = { error: Error | null; downloadText: (filename: string, text: string, type?: string) => boolean; downloadJson: (filename: string, value: unknown) => boolean };
/** User-initiated local export; it never uploads or persists the supplied data. */
export function useFileDownload(): FileDownloadApi {
  const [error, setError] = useState<Error | null>(null);
  const downloadText = useCallback((filename: string, text: string, type = "text/plain;charset=utf-8") => {
    if (typeof document === "undefined" || !filename.trim()) return false;
    try { const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); setError(null); return true; }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("Could not create download.")); return false; }
  }, []);
  return { error, downloadText, downloadJson: (filename, value) => downloadText(filename, `${JSON.stringify(value, null, 2)}\n`, "application/json") };
}
