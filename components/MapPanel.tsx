import React from 'react';
import { NodeData } from '../types';
import { NODE_TYPES } from '../constants';

interface MapPanelProps {
  nodes: NodeData[];
  isVisible: boolean;
  onClose: () => void;
  onNodeClick: (nodeId: string) => void;
  isMobile: boolean;
}

const MapPanel: React.FC<MapPanelProps> = ({ nodes, isVisible, onClose, onNodeClick, isMobile }) => {
  const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);

  const desktopClasses = "absolute top-14 left-0 bottom-0 w-72 bg-slate-900/80 backdrop-blur-sm border-r border-slate-800 p-4 shadow-lg z-50 transition-transform transform";
  const mobileClasses = "fixed bottom-0 left-0 w-full h-[85vh] bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 p-4 shadow-lg z-50 transition-transform transform rounded-t-xl";

  const transformClass = isVisible
    ? 'translate-x-0 translate-y-0'
    : (isMobile ? 'translate-y-full' : '-translate-x-full');

  return (
    <div
      id="map-panel"
      className={`${isMobile ? mobileClasses : desktopClasses} ${transformClass}`}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-slate-200">Node Map</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100 text-2xl leading-none">&times;</button>
      </div>
      <div id="map-list" className="space-y-2 overflow-y-auto h-full pb-10">
        {sortedNodes.map(node => {
          const nodeType = NODE_TYPES[node.typeKey];
          return (
            <button
              key={node.id}
              onClick={() => onNodeClick(node.id)}
              className="w-full text-left p-2 rounded-md hover:bg-slate-700/60 flex items-center"
            >
              <div className={`w-4 h-4 rounded-full ${nodeType.color} mr-3 flex-shrink-0`}></div>
              <span className="truncate font-medium text-slate-200">{nodeType.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MapPanel;