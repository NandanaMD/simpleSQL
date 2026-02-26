import { create } from 'zustand';

interface TreeNode {
  id: string;
  type: 'connection' | 'database' | 'table' | 'view' | 'column';
  label: string;
  connectionId: string;
  database?: string;
  table?: string;
  column?: string;
  columnMeta?: {
    dataType: string;
    isPrimaryKey: boolean;
    isNullable: boolean;
    isUnique: boolean;
  };
  isExpanded: boolean;
  isLoading: boolean;
  children?: TreeNode[];
}

interface ExplorerStore {
  nodes: TreeNode[];
  expandedNodes: Set<string>;
  loadingNodes: Set<string>;

  addConnection: (connectionId: string, name: string) => void;
  removeConnection: (connectionId: string) => void;
  toggleNode: (nodeId: string) => void;
  setNodeChildren: (nodeId: string, children: TreeNode[]) => void;
  setNodeLoading: (nodeId: string, isLoading: boolean) => void;
  clearNodes: () => void;
}

export const useExplorerStore = create<ExplorerStore>()((set) => ({
  nodes: [],
  expandedNodes: new Set(),
  loadingNodes: new Set(),

  addConnection: (connectionId: string, name: string) => {
    const node: TreeNode = {
      id: connectionId,
      type: 'connection',
      label: name,
      connectionId,
      isExpanded: false,
      isLoading: false,
      children: [],
    };

    set((state) => ({
      nodes: [...state.nodes, node],
    }));
  },

  removeConnection: (connectionId: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedNodes);
      newExpanded.delete(connectionId);

      return {
        nodes: state.nodes.filter((node) => node.id !== connectionId),
        expandedNodes: newExpanded,
      };
    });
  },

  toggleNode: (nodeId: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedNodes);

      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }

      return { expandedNodes: newExpanded };
    });
  },

  setNodeChildren: (nodeId: string, children: TreeNode[]) => {
    set((state) => {
      const updateNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, children };
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };

      // Clean up expanded/loading states for old children that no longer exist
      const newExpandedNodes = new Set(state.expandedNodes);
      const newLoadingNodes = new Set(state.loadingNodes);
      const newChildIds = new Set(children.map(c => c.id));
      
      // Remove any expanded/loading states for children of this node that are no longer present
      Array.from(state.expandedNodes).forEach(id => {
        if (id.startsWith(nodeId + ':') && !newChildIds.has(id)) {
          newExpandedNodes.delete(id);
        }
      });
      
      Array.from(state.loadingNodes).forEach(id => {
        if (id.startsWith(nodeId + ':') && !newChildIds.has(id)) {
          newLoadingNodes.delete(id);
        }
      });

      return { 
        nodes: updateNode(state.nodes),
        expandedNodes: newExpandedNodes,
        loadingNodes: newLoadingNodes
      };
    });
  },

  setNodeLoading: (nodeId: string, isLoading: boolean) => {
    set((state) => {
      const newLoading = new Set(state.loadingNodes);

      if (isLoading) {
        newLoading.add(nodeId);
      } else {
        newLoading.delete(nodeId);
      }

      return { loadingNodes: newLoading };
    });
  },

  clearNodes: () => {
    set({ nodes: [], expandedNodes: new Set(), loadingNodes: new Set() });
  },
}));
