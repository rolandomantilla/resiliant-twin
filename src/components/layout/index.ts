import { BookOpen, LayoutDashboard, Radio, Users } from "lucide-react";
import type { NavItem } from "@/components/layout/nav";

/**
 * Navigation entries for the sidebar + breadcrumb (multi-page apps).
 * Add a page here to make it appear in the nav.
 */
export const routes: NavItem[] = [
  { title: "Dispatch Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Org Readiness", url: "/org-readiness", icon: Users },
  { title: "Data Feed & Replay", url: "/data-feed", icon: Radio },
  { title: "User Guide", url: "/user-guide", icon: BookOpen },
];
