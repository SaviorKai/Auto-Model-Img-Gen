
export interface Position {
  x: number;
  y: number;
}

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

export interface ConnectorDefinition {
  name: string;
  type: 'text' | 'image' | 'video';
  count?: number;
}

export interface NodeType {
  name: string;
  color: string;
  category?: string;
  icon?: React.FC;
  inputs: ConnectorDefinition[];
  outputs: ConnectorDefinition[];
  defaultSettings?: Record<string, any>;
  models?: string[];
  description?: string;
}

export interface MediaItem {
  mediaId: string;
  url: string;
  type: 'image' | 'video';
  sourceType: 'generated' | 'init';
  timestamp: number;
  runId: number;
}

export interface NodeData {
  id: string;
  typeKey: string;
  position: Position;
  settings: Record<string, any>;
  exposedConnectors?: { [connectorName: string]: number };
  status?: 'idle' | 'running' | 'completed' | 'failed';
  outputData?: MediaItem[];
  debugData?: any;
  debugInput?: any;
}

export interface ConnectionPoint {
  nodeId: string;
  connectorName: string;
}

export interface ConnectionStartPoint extends ConnectionPoint {
  type: 'input' | 'output';
  dataType: 'text' | 'image' | 'video';
}

export interface Connection {
  from: ConnectionPoint;
  to: ConnectionPoint;
  dataType: 'text' | 'image' | 'video';
}

export interface SelectionBox {
    start: Position;
    end: Position;
    isVisible: boolean;
}

export interface Workflow {
    nodes: NodeData[];
    connections: Connection[];
}