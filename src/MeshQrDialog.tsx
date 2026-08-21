import type { ReactNode } from "react";
import { MeshDialog } from "./ui/MeshDialog";
import { PersonalQR } from "./PersonalQR";
export function MeshQrDialog({ open, onOpenChange, payload, title = "Share QR code", description, footer }: { open: boolean; onOpenChange: (open: boolean) => void; payload: string; title?: string; description?: string; footer?: ReactNode }) {
  return <MeshDialog open={open} onOpenChange={onOpenChange} title={title} description={description} footer={footer}><div className="mesh-qr-dialog"><PersonalQR payload={payload} size={240} ariaLabel={title} /><code>{payload}</code></div></MeshDialog>;
}
