import type { ViewPort } from "react-zoomable-ui/dist/ViewPort";
import type { CanvasDirection } from "reaflow/dist/layout/elkLayout";
import { create } from "zustand";
import { SUPPORTED_LIMIT } from "../../../../../constants/graph";
import useJson from "../../../../../store/useJson";
import type { EdgeData, NodeData } from "../../../../../types/graph";
import { parser } from "../lib/jsonParser";

export interface Graph {
  viewPort: ViewPort | null;
  direction: CanvasDirection;
  loading: boolean;
  fullscreen: boolean;
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNode: NodeData | null;
  path: string;
  aboveSupportedLimit: boolean;
}

const initialStates: Graph = {
  viewPort: null,
  direction: "RIGHT",
  loading: true,
  fullscreen: false,
  nodes: [],
  edges: [],
  selectedNode: null,
  path: "",
  aboveSupportedLimit: false,
};

interface GraphActions {
  setGraph: (json?: string, options?: Partial<Graph>[]) => void;
  setLoading: (loading: boolean) => void;
  setDirection: (direction: CanvasDirection) => void;
  setViewPort: (ref: ViewPort) => void;
  setSelectedNode: (nodeData: NodeData) => void;
  focusFirstNode: () => void;
  toggleFullscreen: (value: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  centerView: () => void;
  clearGraph: () => void;
  setZoomFactor: (zoomFactor: number) => void;
  updateNodeValues: (nodeId: string, updates: { index: number; value: any }[]) => void;
}

const useGraph = create<Graph & GraphActions>((set, get) => ({
  ...initialStates,
  clearGraph: () => set({ nodes: [], edges: [], loading: false }),
  setSelectedNode: nodeData => set({ selectedNode: nodeData }),
  setGraph: (data, options) => {
    const { nodes, edges } = parser(data ?? useJson.getState().json);

    if (nodes.length > SUPPORTED_LIMIT) {
      return set({
        aboveSupportedLimit: true,
        ...options,
        loading: false,
      });
    }

    set({
      nodes,
      edges,
      aboveSupportedLimit: false,
      ...options,
    });
  },
  setDirection: (direction = "RIGHT") => {
    set({ direction });
    setTimeout(() => get().centerView(), 200);
  },
  setLoading: loading => set({ loading }),
  focusFirstNode: () => {
    const rootNode = document.querySelector("g[id$='node-1']");
    get().viewPort?.camera?.centerFitElementIntoView(rootNode as HTMLElement, {
      elementExtraMarginForZoom: 100,
    });
  },
  setZoomFactor: zoomFactor => {
    const viewPort = get().viewPort;
    viewPort?.camera?.recenter(viewPort.centerX, viewPort.centerY, zoomFactor);
  },
  zoomIn: () => {
    const viewPort = get().viewPort;
    viewPort?.camera?.recenter(viewPort.centerX, viewPort.centerY, viewPort.zoomFactor + 0.1);
  },
  zoomOut: () => {
    const viewPort = get().viewPort;
    viewPort?.camera?.recenter(viewPort.centerX, viewPort.centerY, viewPort.zoomFactor - 0.1);
  },
  centerView: () => {
    const viewPort = get().viewPort;
    viewPort?.updateContainerSize();

    const canvas = document.querySelector(".jsoncrack-canvas") as HTMLElement | null;
    if (canvas) {
      viewPort?.camera?.centerFitElementIntoView(canvas);
    }
  },
  toggleFullscreen: fullscreen => set({ fullscreen }),
  setViewPort: viewPort => set({ viewPort }),
  updateNodeValues: (nodeId: string, updates: { index: number; value: any }[]) => {
    try {
      const useJsonStore = require("../../../../../store/useJson").default;
      const currentJson = useJsonStore.getState().json;
      const parsed = JSON.parse(currentJson);
      const nodes = get().nodes || [];
      const nodeToUpdate = nodes.find(n => n.id === nodeId);
      
      if (!nodeToUpdate || !nodeToUpdate.path) {
        console.error("Node not found or path is undefined");
        return;
      }

      // Navigate to target using JSONPath
      let target: any = parsed;
      for (const seg of nodeToUpdate.path) {
        target = target[seg as any];
      }

      // Apply each update
      updates.forEach(u => {
        const row = nodeToUpdate.text[u.index];
        if (!row || !row.key) return;
        target[row.key] = u.value;
      });

      // Update JSON and force re-parse in graph
      const updatedJson = JSON.stringify(parsed, null, 2);
      useJsonStore.getState().setJson(updatedJson);
      
      console.log("Updated JSON:", updatedJson); // debug
    } catch (error) {
      console.error("Failed to update node values:", error);
    }
  },
}));

export default useGraph;
