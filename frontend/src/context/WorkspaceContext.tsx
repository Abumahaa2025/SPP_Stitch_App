import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  WORKSPACE_TOTAL_HEADER_HEIGHT,
  WORKSPACE_SIDEBAR_WIDTH,
  type WorkspaceNavItem,
} from '@/src/data/workspace-nav';
import { TAB_BAR_RESERVED } from '@/src/constants/chrome';

export type HomeAnchor = 'brief' | 'priorities' | 'health';

type WorkspaceContextValue = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isTablet: boolean;
  sidebarWidth: number;
  headerHeight: number;
  contentInsets: { top: number; right: number; bottom: number };
  homeAnchor: HomeAnchor | null;
  requestHomeAnchor: (anchor: HomeAnchor) => void;
  consumeHomeAnchor: () => HomeAnchor | null;
  navigateItem: (item: WorkspaceNavItem) => void;
  setNavigateItem: (fn: (item: WorkspaceNavItem) => void) => void;
  activePath: string;
  setActivePath: (path: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [sidebarOpen, setSidebarOpen] = useState(isTablet);
  const [homeAnchor, setHomeAnchor] = useState<HomeAnchor | null>(null);
  const [activePath, setActivePath] = useState('/');
  const [navHandler, setNavHandler] = useState<((item: WorkspaceNavItem) => void) | null>(null);

  const sidebarWidth = isTablet || sidebarOpen ? WORKSPACE_SIDEBAR_WIDTH : 0;

  const contentInsets = useMemo(() => ({
    top: WORKSPACE_TOTAL_HEADER_HEIGHT,
    right: isTablet ? WORKSPACE_SIDEBAR_WIDTH : 0,
    bottom: TAB_BAR_RESERVED,
  }), [isTablet]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const requestHomeAnchor = useCallback((anchor: HomeAnchor) => {
    setHomeAnchor(anchor);
  }, []);

  const consumeHomeAnchor = useCallback(() => {
    const a = homeAnchor;
    setHomeAnchor(null);
    return a;
  }, [homeAnchor]);

  const setNavigateItem = useCallback((fn: (item: WorkspaceNavItem) => void) => {
    setNavHandler(() => fn);
  }, []);

  const navigateItem = useCallback((item: WorkspaceNavItem) => {
    navHandler?.(item);
  }, [navHandler]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    isTablet,
    sidebarWidth,
    headerHeight: WORKSPACE_TOTAL_HEADER_HEIGHT,
    contentInsets,
    homeAnchor,
    requestHomeAnchor,
    consumeHomeAnchor,
    navigateItem,
    setNavigateItem,
    activePath,
    setActivePath,
  }), [
    sidebarOpen, toggleSidebar, isTablet, sidebarWidth, contentInsets,
    homeAnchor, requestHomeAnchor, consumeHomeAnchor, navigateItem, setNavigateItem,
    activePath,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace requires WorkspaceProvider');
  return ctx;
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}
