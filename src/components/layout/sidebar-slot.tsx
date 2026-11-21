import { createContext, useContext } from "react";
import { createPortal } from "react-dom";

/** DOM node inside the left sidebar (below navigation) that pages can render into. */
export const SidebarSlotContext = createContext<HTMLElement | null>(null);

export function SidebarSlot({ children }: { children: React.ReactNode }) {
  const target = useContext(SidebarSlotContext);
  return target ? createPortal(children, target) : null;
}
