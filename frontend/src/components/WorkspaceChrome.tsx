import React, { useEffect } from 'react';

import { View, StyleSheet } from 'react-native';

import { usePathname } from 'expo-router';



import { WorkspaceSidebar } from '@/src/components/WorkspaceSidebar';

import { WorkspaceChromeHeader } from '@/src/components/WorkspaceChromeHeader';

import { OSChrome } from '@/src/components/OSChrome';

import { useWorkspace } from '@/src/context/WorkspaceContext';



type Props = {

  enabled?: boolean;

};



const HIDE_CHROME = new Set(['/onboarding', '/beta-login']);



/** Global shell — calm header + bottom nav on every screen. */

export function WorkspaceChrome({ enabled = true }: Props) {

  const pathname = usePathname() || '/';

  const { isTablet, setSidebarOpen } = useWorkspace();



  useEffect(() => {

    if (isTablet) setSidebarOpen(true);

  }, [isTablet, setSidebarOpen]);



  // Portals are isolated shells — no owner chrome.
  if (!enabled || HIDE_CHROME.has(pathname) || pathname.startsWith('/portal')) return null;



  return (

    <View style={styles.root} pointerEvents="box-none">

      <WorkspaceChromeHeader />

      {isTablet ? <WorkspaceSidebar /> : null}

      <OSChrome />

    </View>

  );

}



const styles = StyleSheet.create({

  root: { ...StyleSheet.absoluteFillObject, zIndex: 20 },

});

