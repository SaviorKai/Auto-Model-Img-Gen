

import React, { useState, useEffect, useMemo } from 'react';
import { NODE_TYPES } from '../constants';
import { Position, NodeType } from '../types';

interface NodeMenuProps {
  isVisible: boolean;
  position: Position;
  onClose: () => void;
  onSelect: (typeKey: string) => void;
  filterType?: 'text' | 'image' | 'video';
  sourceConnectorType?: 'input' | 'output';
  initialCategory?: string;
}

const NodeMenu: React.FC<NodeMenuProps> = ({ isVisible, position, onClose, onSelect, filterType, sourceConnectorType, initialCategory }) => {
  const [filter, setFilter] = useState('');
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          onClose();
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible, onClose]);

  const groupedNodeTypes = useMemo(() => {
    const allNodes = Object.entries(NODE_TYPES);
    let filteredNodes: [string, NodeType][] = [];

    // Primary filter based on connection context
    if (initialCategory) {
        filteredNodes = allNodes.filter(([_, type]) => type.category === initialCategory);
    } else if (filterType) {
        if (sourceConnectorType === 'input') {
            // Dragging from an INPUT, so we need nodes that can OUTPUT this type
            filteredNodes = allNodes.filter(([_, type]) => 
                type.outputs.some(output => output.type === filterType)
            );
        } else {
            // Dragging from an OUTPUT (or context is missing), so we need nodes that can INPUT this type
            filteredNodes = allNodes.filter(([_, type]) => 
                type.inputs.some(input => input.type === filterType)
            );
        }
    } else {
        filteredNodes = allNodes as [string, NodeType][];
    }

    // Secondary filter from search input
    if (filter) {
        filteredNodes = filteredNodes.filter(([_, type]) =>
            type.name.toLowerCase().includes(filter.toLowerCase())
        );
    }

    // Special sorting for input drags to recommend the best node first
    if (filterType && sourceConnectorType === 'input') {
        const idealInputNodeKey = `input-${filterType}`;
        filteredNodes.sort(([keyA, typeA], [keyB, typeB]) => {
            const isA_Ideal = keyA === idealInputNodeKey;
            const isB_Ideal = keyB === idealInputNodeKey;

            if (isA_Ideal) return -1;
            if (isB_Ideal) return 1;
            
            return typeA.name.localeCompare(typeB.name);
        });
    }

    const groups = filteredNodes.reduce((acc, [key, type]) => {
        const category = type.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push([key, type] as [string, any]);
        return acc;
    }, {} as Record<string, [string, any][]>);

    const categoryOrder = ['Inputs', 'Primary Nodes'];
    return Object.entries(groups).sort(([a], [b]) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [filter, filterType, sourceConnectorType, initialCategory]);

  if (!isVisible) return null;

  return (
    <div
      ref={menuRef}
      id="node-menu"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="absolute z-50"
    >
      <div className="bg-slate-800 rounded-xl shadow-lg p-3 w-80 border border-slate-700">
        <input
          type="text"
          id="node-search"
          placeholder="Search for a node type..."
          className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md mb-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-100"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
        />
        <div id="node-options" className="space-y-1 max-h-72 overflow-y-auto">
          {groupedNodeTypes.map(([category, types]) => (
            <div key={category}>
               {!initialCategory && <h4 className="text-xs font-bold uppercase text-slate-500 px-2 mt-2">{category}</h4>}
              {types.map(([key, type]) => (
                <button
                  key={key}
                  className="w-full text-left p-3 rounded-md hover:bg-slate-700 flex items-start"
                  onClick={() => {
                    onSelect(key);
                    setFilter('');
                  }}
                >
                  <div className={`w-5 h-5 rounded-full ${type.color} mr-3 mt-0.5 flex-shrink-0`}></div>
                  <div className="flex-grow">
                    <span className="font-semibold text-slate-100">{type.name}</span>
                    {type.description && <p className="text-sm text-slate-400 mt-1">{type.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          ))}
          {groupedNodeTypes.length === 0 && (
            <div className="text-center text-sm text-slate-400 py-4">
              No matching nodes found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeMenu;