


import React, { memo, useState } from 'react';
import { NodeData, Connection, ConnectionStartPoint, ConnectionPoint, ConnectorDefinition, MediaItem } from '../types';
import { NODE_TYPES, TYPE_COLORS, CloseIcon } from '../constants';
import { getModelGuidanceSupport } from '../modelConfig';
import ImageViewer from './ImageViewer';

interface NodeComponentProps {
  node: NodeData;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onNodeMouseUp: (e: React.MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onConnectorMouseDown: (e: React.MouseEvent<HTMLDivElement>, from: ConnectionPoint, type: 'input' | 'output') => void;
  onConnectorMouseUp: (e: React.MouseEvent<HTMLDivElement>, to: ConnectionPoint, type: 'input' | 'output') => void;
  onExposeMore: (nodeId: string, connectorName: string) => void;
  draggingConnectionInfo: ConnectionStartPoint | null;
  connections: Connection[];
  isDevMode: boolean;
}

const renderDebugValue = (value: any, level: number): React.ReactNode => {
    if (value === null) return <span className="text-pink-400">null</span>;
    if (typeof value === 'string') {
        if (value.startsWith('http')) {
            return <a href={value} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">{value}</a>;
        }
        return <span className="text-amber-300 break-all">"{value}"</span>;
    }
    if (typeof value === 'number') return <span className="text-emerald-400">{value}</span>;
    if (typeof value === 'boolean') return <span className="text-pink-400">{String(value)}</span>;
    if (Array.isArray(value)) {
        return (
            <div className={`pl-4 ${level > 0 ? 'border-l border-slate-600' : ''}`}>
                <span className="text-slate-500">[</span>
                {value.map((item, index) => (
                    <div key={index} className="pl-2">
                        {renderDebugValue(item, level + 1)}
                        {index < value.length - 1 && <span className="text-slate-500">,</span>}
                    </div>
                ))}
                <span className="text-slate-500">]</span>
            </div>
        );
    }
    if (typeof value === 'object') {
        return (
             <div className={`pl-4 ${level > 0 ? 'border-l border-slate-600' : ''}`}>
                <span className="text-slate-500">{'{'}</span>
                {Object.entries(value).map(([key, val], index, arr) => (
                    <div key={key} className="pl-2">
                        <strong className="text-sky-400">{key}:</strong>{' '}
                        {renderDebugValue(val, level + 1)}
                        {index < arr.length - 1 && <span className="text-slate-500">,</span>}
                    </div>
                ))}
                <span className="text-slate-500">{'}'}</span>
            </div>
        );
    }
    return String(value);
};

const NodeComponent: React.FC<NodeComponentProps> = ({
  node,
  isSelected,
  onMouseDown,
  onNodeMouseUp,
  onDelete,
  onConnectorMouseDown,
  onConnectorMouseUp,
  onExposeMore,
  draggingConnectionInfo,
  connections,
  isDevMode,
}) => {
  const nodeType = NODE_TYPES[node.typeKey];
  const [copied, setCopied] = useState<string | null>(null);

  if (!nodeType) return null;

  const isConnectionInProgress = !!draggingConnectionInfo;
  
  const sanitizeForId = (name: string) => name.replace(/\s+/g, '-');
  
  const allConnectedPoints = connections.flatMap(c => [{nodeId: c.from.nodeId, connectorName: c.from.connectorName}, {nodeId: c.to.nodeId, connectorName: c.to.connectorName}]);

  const handlePreviewDragStart = (e: React.DragEvent, mediaItem: MediaItem) => {
    e.dataTransfer.setData('application/x-blueprint-media-item', JSON.stringify(mediaItem));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const renderStatusOverlay = () => {
    const isVisible = node.status && node.status !== 'idle';
    return (
      <div className={`node-status-overlay ${isVisible ? 'visible' : ''}`}>
        {node.status === 'running' && <div className="spinner"></div>}
        {node.status === 'completed' && (
          <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {node.status === 'failed' && (
          <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
    );
  };
  
  const renderHeader = () => {
    const closeButton = (className: string) => (
      <button
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
      >
        <CloseIcon />
      </button>
    );

    if (nodeType.category === 'Inputs' && nodeType.icon) {
      const Icon = nodeType.icon;
      return (
        <div className="node-header-input">
          <div className="icon-container">
            <Icon />
          </div>
          <span className="font-semibold select-none flex-grow">{nodeType.name}</span>
          {closeButton("delete-node-btn p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors")}
        </div>
      );
    }

    return (
      <div className={`node-header ${nodeType.color} text-white p-3 flex justify-between items-center h-12`}>
        <span className="font-bold select-none">{nodeType.name}</span>
        {closeButton("delete-node-btn p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors")}
      </div>
    );
  };

  const renderContentPreview = () => {
    const { src, text } = node.settings;

    let content = <p className="preview-text">Empty - Select to configure</p>;
    if (src) {
        if (node.typeKey === 'input-image') {
            content = <ImageViewer src={src} alt="Preview" className="preview-media" />;
        } else if (node.typeKey === 'input-video') {
            content = <video src={src} muted autoPlay loop className="preview-media" />;
        }
    } else if (text) {
        content = <p className="preview-text">{text}</p>;
    }

    return (
        <div className="node-content-preview">
            {content}
        </div>
    );
  };

  const renderConnector = (
      connectorDef: ConnectorDefinition, 
      type: 'input' | 'output', 
      nameOverride?: string, 
      isDisabledOverride?: boolean
    ) => {
    const connectorName = nameOverride || connectorDef.name;
    let isDisabled = isDisabledOverride || false;

    if (isConnectionInProgress) {
        const isSelf = node.id === draggingConnectionInfo.nodeId;
        const typeMismatch = connectorDef.type !== draggingConnectionInfo.dataType;
        if (type === 'input') {
            isDisabled = isSelf || typeMismatch || (draggingConnectionInfo.type === 'input');
        } else { // output
            isDisabled = isSelf || typeMismatch || (draggingConnectionInfo.type === 'output');
        }
    }
    
    const isConnected = allConnectedPoints.some(c => c.nodeId === node.id && c.connectorName === connectorName);
    
    let isCompatibleTarget = false;
    if (isConnectionInProgress && !isDisabled) {
        if(type === 'input' && draggingConnectionInfo.type === 'output') isCompatibleTarget = true;
        if(type === 'output' && draggingConnectionInfo.type === 'input') isCompatibleTarget = true;
    }

    const wrapperStyle: React.CSSProperties = {};
    if (isCompatibleTarget && draggingConnectionInfo) {
        const color = TYPE_COLORS[draggingConnectionInfo.dataType] || '#3b82f6';
        wrapperStyle.backgroundColor = `${color}33`;
        wrapperStyle.outline = `2px dashed ${color}`;
        wrapperStyle.outlineOffset = '-2px';
    }

    const connectorStyle: React.CSSProperties = {
      backgroundColor: TYPE_COLORS[connectorDef.type] || '#9ca3af',
    };

    if (isConnected) {
        connectorStyle.boxShadow = `0 0 0 2px ${TYPE_COLORS[connectorDef.type]}`;
    }

    let displayName = nameOverride || connectorDef.name;

    return (
      <div
        key={`${type}-${connectorName}`}
        className={`connector-wrapper ${isDisabled ? 'disabled' : ''}`}
        style={wrapperStyle}
        onMouseDown={(e) => !isDisabled && onConnectorMouseDown(e, { nodeId: node.id, connectorName }, type)}
        onMouseUp={(e) => !isDisabled && onConnectorMouseUp(e, { nodeId: node.id, connectorName }, type)}
        onTouchStart={(e) => {
          if (!isDisabled) {
            e.preventDefault();
            e.stopPropagation();
            // Convert touch event to mouse event format
            const touch = e.touches[0];
            const mouseEvent = {
              clientX: touch.clientX,
              clientY: touch.clientY,
              stopPropagation: () => e.stopPropagation(),
              preventDefault: () => e.preventDefault(),
              button: 0
            } as React.MouseEvent<HTMLDivElement>;
            onConnectorMouseDown(mouseEvent, { nodeId: node.id, connectorName }, type);
          }
        }}
        onTouchEnd={(e) => {
          if (!isDisabled) {
            // Just prevent default browser behavior but let the event bubble up to canvas
            // The canvas will handle showing the menu if there's a connection in progress
            e.preventDefault();
            // DO NOT call e.stopPropagation() - let it bubble up to canvas
          }
        }}
      >
        <div
          id={`connector-${node.id}-${sanitizeForId(connectorName)}`}
          className={`connector ${type}`}
          style={connectorStyle}
        />
        <span className="connector-label">{displayName}</span>
      </div>
    );
  };

  const renderDebugSection = (title: string, data: any) => {
    if (!data) return null;
    
    const copyToClipboard = () => {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(title);
      setTimeout(() => setCopied(null), 1500);
    };
    
    const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation();
    };

    return (
      <div className="mb-2 last:mb-0">
        <div className="flex justify-between items-center mb-1">
          <h4 className="text-xs font-bold uppercase text-sky-400 tracking-wider">{title}</h4>
          <button 
            onClick={copyToClipboard} 
            className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-700/50 hover:bg-slate-700 transition-all w-16 text-center"
          >
            {copied === title ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div 
          className="text-xs font-mono max-h-48 overflow-y-auto bg-slate-800/50 p-2 rounded-md"
          onWheel={handleWheel}
        >
          {renderDebugValue(data, 0)}
        </div>
      </div>
    );
  };

  const renderDebugData = () => {
    if (!isDevMode || (!node.debugInput && !node.debugData)) return null;
    return (
        <div className="debug-data-container bg-slate-900/70 p-3 border-t border-slate-700">
            {renderDebugSection("Dev Input", node.debugInput)}
            {renderDebugSection("Dev Output", node.debugData)}
        </div>
    );
  };
  
  const hasContentPreview = nodeType.category === 'Inputs';
  const hasGeneratedOutputs = node.outputData && node.outputData.length > 0;
  const supportedGuidanceForModel = node.typeKey === 'image-generation' ? getModelGuidanceSupport(node.settings.model) : null;

  return (
    <div
      id={node.id}
      className={`node w-64 ${isSelected ? 'selected' : ''} ${nodeType.category === 'Inputs' ? 'input-node' : ''}`}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onMouseUp={(e) => onNodeMouseUp(e, node.id)}
    >
      {renderStatusOverlay()}
      {renderHeader()}
      {hasContentPreview && renderContentPreview()}
      <div className="connectors-container" style={hasContentPreview || hasGeneratedOutputs ? {} : {borderBottomLeftRadius: '0.75rem', borderBottomRightRadius: '0.75rem'}}>
        <div className="inputs-column">
          {nodeType.inputs.map((input) => {
            const isGuidanceInput = input.name === 'Style Reference' || input.name === 'Character Reference';
            let isDisabledByModel = false;
            if (isGuidanceInput) {
                isDisabledByModel = !(supportedGuidanceForModel && supportedGuidanceForModel[input.name]);
            }
            
            if (!input.count || input.count <= 1) {
              return renderConnector(input, 'input', undefined, isDisabledByModel);
            }
            
            const exposedCount = node.exposedConnectors?.[input.name] || 1;
            const connectorsToShow = Array.from({ length: exposedCount }).map((_, i) => {
              const connectorName = `${input.name} ${i + 1}`;
              return renderConnector(input, 'input', connectorName, isDisabledByModel);
            });
            const showPlusButton = exposedCount < input.count;
            
            return (
              <React.Fragment key={input.name}>
                {connectorsToShow}
                {showPlusButton && (
                  <div className={`connector-wrapper justify-start pl-2 ${isDisabledByModel ? 'disabled' : ''}`}>
                    <button 
                        onClick={() => !isDisabledByModel && onExposeMore(node.id, input.name)} 
                        className="expose-more-btn"
                        disabled={isDisabledByModel}
                    >
                        +
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="outputs-column">
          {(() => {
              const outputDef = nodeType.outputs[0];
              if (!outputDef) return null;
              
              const numOutputsToRender = node.typeKey === 'image-generation' 
                  ? (node.settings.numImages || 1) 
                  : nodeType.outputs.length;

              return Array.from({ length: numOutputsToRender }).map((_, i) => {
                  const connectorName = `${outputDef.name}${numOutputsToRender > 1 ? ` ${i + 1}` : ''}`;
                  return renderConnector(outputDef, 'output', connectorName);
              });
          })()}
        </div>
      </div>
      
      {hasGeneratedOutputs && (
        <div className="generated-outputs-container max-h-60 overflow-y-auto">
            {node.outputData!.map((item, index) => {
                const MediaTag = item.type === 'video' ? 'video' : 'img';
                return (
                    <div 
                      key={`${item.mediaId}-${index}`} 
                      className="generated-output-item cursor-grab"
                      draggable="true"
                      onDragStart={(e) => handlePreviewDragStart(e, item)}
                    >
                        {item.type === 'video' ? (
                            <video 
                                src={item.url} 
                                className="generated-output-thumbnail" 
                                muted 
                                autoPlay 
                                loop 
                            />
                        ) : (
                            <ImageViewer 
                                src={item.url} 
                                alt={`Generated ${item.type}`} 
                                className="generated-output-thumbnail" 
                            />
                        )}
                        <div className="flex-grow text-xs text-slate-400">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      {renderDebugData()}
    </div>
  );
};

export default memo(NodeComponent);