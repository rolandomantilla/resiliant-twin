import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Hexagon, LogOut } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import type { NavItem } from "@/components/layout/nav";
import { SidebarSlotContext } from "@/components/layout/sidebar-slot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

/**
 * Same shell as the shared base SidebarLayout, plus a slot under the
 * navigation that pages fill with `<SidebarSlot>` (the dispatch page puts the
 * Scenario Assistant there). Sidebar is widened to fit the chat.
 */
export function SlottedSidebarLayout({
  children,
  routes,
  user,
  authEnabled,
  onSignOut,
}: {
  children: React.ReactNode;
  routes: NavItem[];
  user?: { name?: string | null; email?: string | null };
  authEnabled: boolean;
  onSignOut: () => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY));
    if (saved >= MIN_WIDTH && saved <= MAX_WIDTH) setWidth(saved);
  }, []);

  return (
    <SidebarSlotContext.Provider value={slot}>
      <SidebarProvider
        style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}
        className={cn(
          dragging && "cursor-col-resize select-none [&_*]:transition-none!",
        )}
      >
        <ResizeHandle
          width={width}
          onResize={setWidth}
          onDraggingChange={setDragging}
        />
        <LayoutSidebar
          routes={routes}
          authEnabled={authEnabled}
          user={user}
          onSignOut={onSignOut}
          slotRef={setSlot}
        />
        <SidebarInset>
          <div className="max-h-screen h-[calc(100vh-48px)] w-full">
            <AppHeader routes={routes} />
            <main className="flex-1 overflow-auto has-[>[data-flush]]:overflow-hidden h-full w-full">
              <div className="h-full w-full px-2 py-1 has-[>[data-flush]]:p-0">
                {children}
              </div>
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SidebarSlotContext.Provider>
  );
}

const WIDTH_STORAGE_KEY = "resiliencetwin:sidebar-width";
const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 256;
const MAX_WIDTH = 720;

function clampWidth(px: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(px)));
}

/** Drag the sidebar's right edge to resize it; double-click resets. Saved per browser. */
function ResizeHandle({
  width,
  onResize,
  onDraggingChange,
}: {
  width: number;
  onResize: (px: number) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const { open, isMobile } = useSidebar();
  if (!open || isMobile) return null;

  const save = (px: number) => {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(px));
    } catch {
      // storage unavailable — width still applies for this session
    }
  };

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    let latest = startWidth;
    onDraggingChange(true);
    const move = (ev: PointerEvent) => {
      latest = clampWidth(startWidth + ev.clientX - startX);
      onResize(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onDraggingChange(false);
      save(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = clampWidth(width + (e.key === "ArrowRight" ? step : -step));
      onResize(next);
      save(next);
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a draggable splitter has no native element; role="separator" is the ARIA pattern
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => {
        onResize(DEFAULT_WIDTH);
        save(DEFAULT_WIDTH);
      }}
      className="group fixed inset-y-0 z-20 hidden w-2 -translate-x-1/2 cursor-col-resize md:block focus-visible:outline-none"
      style={{ left: width }}
    >
      <div className="mx-auto h-full w-0.5 bg-transparent transition-colors group-hover:bg-primary/40 group-focus-visible:bg-primary" />
    </div>
  );
}

function LayoutSidebar({
  routes: navRoutes,
  authEnabled,
  user,
  onSignOut,
  slotRef,
}: {
  routes: NavItem[];
  authEnabled: boolean;
  user?: { name?: string | null; email?: string | null };
  onSignOut: () => void;
  slotRef: (el: HTMLElement | null) => void;
}) {
  const currentPath = useRouterState().location.pathname;
  const { open } = useSidebar();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={APP_NAME}>
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Hexagon className="size-4" />
                </div>
                {open && (
                  <div className="flex flex-col leading-none">
                    <span className="font-semibold tracking-tight text-sm">
                      {APP_NAME}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {APP_DESCRIPTION}
                    </span>
                  </div>
                )}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navRoutes.map(({ title, url, icon: Icon }) => (
                <SidebarMenuItem key={title}>
                  <SidebarMenuButton
                    isActive={currentPath === url}
                    tooltip={title}
                    render={<Link to={url} />}
                  >
                    <Icon className="size-4" />
                    <span>{title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div
          ref={slotRef}
          className={open ? "min-h-0 flex-1 px-2 pb-2" : "hidden"}
        />
      </SidebarContent>

      {authEnabled && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      tooltip="Account"
                      className="cursor-pointer"
                    />
                  }
                >
                  <Avatar className="size-7 rounded-full">
                    <AvatarFallback className="rounded-full bg-sidebar text-[11px] font-medium">
                      {user?.name?.charAt(0) ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col leading-none">
                    <span className="text-sm font-medium">
                      {user?.name ?? "User Name"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {user?.email ?? "Email"}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-32">
                  <DropdownMenuItem onClick={onSignOut} variant="destructive">
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
