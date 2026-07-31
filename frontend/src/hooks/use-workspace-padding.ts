import { useWorkspaceOptional } from '@/src/context/WorkspaceContext';



export function useWorkspacePadding() {

  const ws = useWorkspaceOptional();

  if (!ws) {

    return { paddingTop: 0, paddingRight: 0, paddingBottom: 0, useWorkspace: false };

  }

  return {

    paddingTop: ws.contentInsets.top,

    paddingRight: ws.contentInsets.right,

    paddingBottom: ws.contentInsets.bottom,

    useWorkspace: true,

  };

}

