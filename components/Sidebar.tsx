
import React, { useState, useRef, useEffect } from 'react';
import { NodeData, Connection } from '../types';
import { NODE_TYPES, VideoUploadIcon } from '../constants';
import { IMAGE_GEN_STYLES, CONTRAST_VALUES, VIDEO_RESOLUTIONS, ASPECT_RATIO_DIMENSIONS, getModelConfig, modelSupports, getModelDefaults } from '../modelConfig';

interface SidebarProps {
  selectedNodes: NodeData[];
  onDeleteNodes: (nodeIds: string[]) => void;
  selectedConnectionIndices: number[];
  onDeleteConnections: () => void;
  onUpdateNodeSettings: (nodeId: string, settings: Record<string, any>) => void;
  onUploadFile: (file: File) => Promise<{ mediaId: string; url: string; } | null>;
  connections: Connection[];
  isMobile: boolean;
}

const SettingsSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="mt-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase text-slate-500 tracking-wider">{title}</h3>
        <div className="space-y-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            {children}
        </div>
    </div>
);

const ToggleSwitch: React.FC<{ label: string, checked: boolean, onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <label className="toggle-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="slider"></span>
      </label>
    </div>
);

const LabeledInput: React.FC<{ label: string, children: React.ReactNode, description?: string }> = ({ label, children, description }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <div className="mt-1">{children}</div>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
);

const Sidebar: React.FC<SidebarProps> = ({ selectedNodes, onDeleteNodes, selectedConnectionIndices, onDeleteConnections, onUpdateNodeSettings, onUploadFile, connections, isMobile }) => {
  const selectedNodeCount = selectedNodes.length;
  const selectedConnectionCount = selectedConnectionIndices.length;
  const isAnythingSelected = selectedNodeCount > 0 || selectedConnectionCount > 0;
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAnythingSelected) {
        setIsExpanded(false);
    }
  }, [isAnythingSelected]);

  // Reset scroll position when selection changes
  useEffect(() => {
    if (contentRef.current) {
        contentRef.current.scrollTop = 0;
    }
  }, [selectedNodes, selectedConnectionIndices]);
  
  const handleSettingsChange = (nodeId: string, newSettings: Partial<Record<string, any>>) => {
    const node = selectedNodes.find(n => n.id === nodeId);
    if (node) {
      onUpdateNodeSettings(node.id, { ...node.settings, ...newSettings });
    }
  };

  const handleBulkSettingsChange = (newSettings: Partial<Record<string, any>>) => {
    selectedNodes.forEach(node => {
      onUpdateNodeSettings(node.id, { ...node.settings, ...newSettings });
    });
  };

  const areAllNodesSameType = () => {
    if (selectedNodes.length <= 1) return false;
    const firstNodeType = selectedNodes[0].typeKey;
    return selectedNodes.every(node => node.typeKey === firstNodeType);
  };

  const getSharedSettings = () => {
    if (!areAllNodesSameType()) return {};
    
    const firstNode = selectedNodes[0];
    const sharedSettings: Record<string, any> = {};
    
    // Get all setting keys from the first node
    const settingKeys = Object.keys(firstNode.settings);
    
    settingKeys.forEach(key => {
      const values = selectedNodes.map(node => node.settings[key]);
      const firstValue = values[0];
      const allSame = values.every(value => 
        JSON.stringify(value) === JSON.stringify(firstValue)
      );
      
      sharedSettings[key] = {
        value: firstValue,
        isMixed: !allSame,
        allValues: values
      };
    });
    
    return sharedSettings;
  };

  const renderBulkNodeSettings = () => {
    if (!areAllNodesSameType()) return null;
    
    const nodeType = NODE_TYPES[selectedNodes[0].typeKey];
    const sharedSettings = getSharedSettings();
    
    const renderBulkModelSelector = (models: string[]) => {
      const modelSetting = sharedSettings.model;
      const displayValue = modelSetting?.isMixed ? "Mixed" : (modelSetting?.value || models[0]);
      
      return (
        <LabeledInput label="Model">
          <select
            className={`block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100 ${modelSetting?.isMixed ? 'italic text-slate-400' : ''}`}
            value={modelSetting?.isMixed ? "" : displayValue}
            onChange={(e) => handleBulkSettingsChange({ model: e.target.value })}
          >
            {modelSetting?.isMixed && <option value="">Mixed</option>}
            {models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </LabeledInput>
      );
    };

    const renderBulkImageGenSettings = () => {
      if (selectedNodes[0].typeKey !== 'image-generation') return null;
      
      const styleSetting = sharedSettings.style;
      const aspectRatioSetting = sharedSettings.aspectRatio;
      const numImagesSetting = sharedSettings.numImages;
      const contrastSetting = sharedSettings.contrast;
      
      const model = sharedSettings.model?.isMixed ? null : sharedSettings.model?.value;
      const isContrastModel = model ? modelSupports(model, 'contrast') : false;
      
      return (
        <>
          <SettingsSection title="Model Settings">
            {nodeType.models && renderBulkModelSelector(nodeType.models)}
            {isContrastModel && (
              <LabeledInput label="Contrast">
                <select
                  className={`block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100 ${contrastSetting?.isMixed ? 'italic text-slate-400' : ''}`}
                  value={contrastSetting?.isMixed ? "" : (contrastSetting?.value || 1.0)}
                  onChange={(e) => handleBulkSettingsChange({ contrast: parseFloat(e.target.value) })}
                >
                  {contrastSetting?.isMixed && <option value="">Mixed</option>}
                  {CONTRAST_VALUES.map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </LabeledInput>
            )}
          </SettingsSection>

          <SettingsSection title="Generation Settings">
            <LabeledInput label="Style">
              <select
                className={`block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100 ${styleSetting?.isMixed ? 'italic text-slate-400' : ''}`}
                value={styleSetting?.isMixed ? "" : (styleSetting?.value || 'None')}
                onChange={(e) => handleBulkSettingsChange({ style: e.target.value })}
              >
                {styleSetting?.isMixed && <option value="">Mixed</option>}
                {IMAGE_GEN_STYLES.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </LabeledInput>

            <LabeledInput label="Aspect Ratio">
              <select
                className={`block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100 ${aspectRatioSetting?.isMixed ? 'italic text-slate-400' : ''}`}
                value={aspectRatioSetting?.isMixed ? "" : (aspectRatioSetting?.value || '1:1')}
                onChange={(e) => handleBulkSettingsChange({ aspectRatio: e.target.value })}
              >
                {aspectRatioSetting?.isMixed && <option value="">Mixed</option>}
                {Object.keys(ASPECT_RATIO_DIMENSIONS).map(ratio => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
            </LabeledInput>

            <LabeledInput label="Number of Images">
              <select
                className={`block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100 ${numImagesSetting?.isMixed ? 'italic text-slate-400' : ''}`}
                value={numImagesSetting?.isMixed ? "" : (numImagesSetting?.value || 1)}
                onChange={(e) => handleBulkSettingsChange({ numImages: parseInt(e.target.value) })}
              >
                {numImagesSetting?.isMixed && <option value="">Mixed</option>}
                {[1, 2, 3, 4].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </LabeledInput>
          </SettingsSection>
        </>
      );
    };

    return (
      <div className="p-4 md:p-0">
        <div className="mb-8 hidden md:block">
          <h2 className="text-xl font-semibold text-slate-100">{selectedNodes.length} {nodeType.name} Nodes</h2>
          <p className="mt-1 text-slate-400">Bulk editing mode - changes apply to all selected nodes.</p>
        </div>
        
        {renderBulkImageGenSettings()}
        
        <button
          onClick={() => onDeleteNodes(selectedNodes.map(n => n.id))}
          className="mt-8 w-full bg-red-500/80 hover:bg-red-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
        >
          Delete All Selected
        </button>
      </div>
    );
  };

  const renderSingleNodeSettings = (node: NodeData) => {
    const nodeType = NODE_TYPES[node.typeKey];
    const settings = node.settings;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (node.typeKey === 'input-image') {
                setIsUploading(true);
                const result = await onUploadFile(file);
                setIsUploading(false);
                if (result) {
                    handleSettingsChange(node.id, { src: result.url, fileName: file.name, mediaId: result.mediaId });
                }
            } else {
                const fileUrl = URL.createObjectURL(file);
                handleSettingsChange(node.id, { src: fileUrl, fileName: file.name });
            }
        }
    };

    const isImage = node.typeKey === 'input-image';
    const isVideo = node.typeKey === 'input-video';

    const renderInputContentSettings = () => {
        if (nodeType.category !== 'Inputs') return null;
        return (
            <SettingsSection title="Content">
                {node.typeKey === 'input-text' && (
                    <LabeledInput label="Text Content">
                        <textarea
                            rows={6}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-400 text-slate-100"
                            value={settings.text || ''}
                            onChange={(e) => handleSettingsChange(node.id, { text: e.target.value })}
                        />
                    </LabeledInput>
                )}
                {(isImage || isVideo) && (
                    <LabeledInput label={isImage ? 'Image File' : 'Video File'}>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {isUploading ? (
                                    <div className="flex flex-col items-center justify-center h-full py-4">
                                        <div className="spinner"></div>
                                        <p className="text-sm text-slate-400 mt-2">Uploading...</p>
                                    </div>
                                ) : settings.src ? (
                                    <>
                                        {isImage && <img src={settings.src} alt="Preview" className="max-h-32 mx-auto rounded-md shadow-sm" />}
                                        {isVideo && <video src={settings.src} muted autoPlay loop className="max-h-32 mx-auto rounded-md shadow-sm" />}
                                        <p className="text-xs text-slate-400 pt-2 truncate">{settings.fileName}</p>
                                    </>
                                ) : (
                                  <>
                                    {isImage && <svg className="mx-auto h-12 w-12 text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>}
                                    {isVideo && <VideoUploadIcon />}
                                  </>
                                )}
                                <div className="flex text-sm text-slate-400 justify-center">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-slate-700 rounded-md font-medium text-blue-500 hover:text-blue-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-800 focus-within:ring-blue-500 px-2">
                                        <span>{settings.src ? 'Replace file' : 'Upload a file'}</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept={isImage ? 'image/*' : 'video/*'} disabled={isUploading} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </LabeledInput>
                )}
            </SettingsSection>
        );
    };

    const renderInputExposureSettings = () => {
        if (nodeType.category !== 'Inputs') return null;
        return (
            <SettingsSection title="End-User Settings">
                <ToggleSwitch
                    label="Expose as an input"
                    checked={!!settings.exposeAsInput}
                    onChange={(checked) => handleSettingsChange(node.id, { exposeAsInput: checked })}
                />
                {settings.exposeAsInput && (
                    <LabeledInput label="Instructions for user">
                        <textarea
                            rows={3}
                            placeholder="e.g., 'Upload the product image you want to use.'"
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-400 text-slate-100"
                            value={settings.instructions || ''}
                            onChange={(e) => handleSettingsChange(node.id, { instructions: e.target.value })}
                        />
                    </LabeledInput>
                )}
            </SettingsSection>
        );
    };

    const renderModelSelector = (models: string[], currentModel: string) => (
        <LabeledInput label="Model">
            <select
                className="block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100"
                value={currentModel}
                onChange={(e) => handleSettingsChange(node.id, { model: e.target.value })}
            >
                {models.map(m => <option key={m}>{m}</option>)}
            </select>
        </LabeledInput>
    );

    const renderImageGenSettings = () => {
      if (node.typeKey !== 'image-generation') return null;
      const { model, style } = settings;
      const modelConfig = getModelConfig(model);
      const isContrastModel = modelSupports(model, 'contrast');
      const guidanceConnections = connections.filter(c => c.to.nodeId === node.id && (c.to.connectorName.startsWith('Style Reference') || c.to.connectorName.startsWith('Character Reference')));
      
      const isAlchemyModel = modelSupports(model, 'alchemy');
      
      let contrastDescription = "";
      if (isAlchemyModel && modelConfig?.family === 'PHOENIX') {
          contrastDescription = "Contrast >= 2.5 required for Alchemy.";
      }
      
      let styleDescription = "";
      const isAlchemyStyle = style && !['None', 'Leonardo'].includes(style);
      if (isAlchemyModel) {
          styleDescription = "Alchemy is active for this model.";
      } else if (isAlchemyStyle) {
          styleDescription = "Warning: This style may not work correctly without an Alchemy model (e.g. Phoenix, Vision).";
      }

      return (
        <>
            <SettingsSection title="Model Settings">
                {nodeType.models && renderModelSelector(nodeType.models, settings.model)}
                {isContrastModel && (
                    <LabeledInput label="Contrast" description={contrastDescription}>
                        <select
                            className="block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100"
                            value={settings.contrast || 1.0}
                            onChange={(e) => handleSettingsChange(node.id, { contrast: parseFloat(e.target.value) })}
                        >
                            {CONTRAST_VALUES.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                        </select>
                    </LabeledInput>
                )}
                <LabeledInput label="Style" description={styleDescription}>
                    <select
                        className="block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100"
                        value={settings.style || 'Dynamic'}
                        onChange={(e) => handleSettingsChange(node.id, { style: e.target.value })}
                    >
                        {IMAGE_GEN_STYLES.map(s => <option key={s}>{s}</option>)}
                    </select>
                </LabeledInput>
                <LabeledInput label={`Number of Images: ${settings.numImages}`}>
                    <input
                        type="range"
                        min="1" max="8" step="1"
                        value={settings.numImages || 1}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                        onChange={(e) => handleSettingsChange(node.id, { numImages: parseInt(e.target.value, 10) })}
                    />
                </LabeledInput>
                <LabeledInput label="Aspect Ratio">
                    <select
                        className="block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100"
                        value={settings.aspectRatio || '1:1'}
                        onChange={(e) => handleSettingsChange(node.id, { aspectRatio: e.target.value })}
                    >
                        <option>1:1</option> <option>16:9</option> <option>9:16</option> <option>4:3</option> <option>3:4</option>
                    </select>
                </LabeledInput>
                <LabeledInput label="Seed" description="Leave blank for a random seed.">
                    <input
                        type="number" placeholder="e.g., 12345"
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-400 text-slate-100"
                        value={settings.seed || ''}
                        onChange={(e) => handleSettingsChange(node.id, { seed: e.target.value })}
                    />
                </LabeledInput>
            </SettingsSection>

            {guidanceConnections.length > 0 && (
                <SettingsSection title="Image Guidance">
                    {guidanceConnections.map(conn => {
                        const guidanceType = conn.to.connectorName.startsWith('Style Reference') ? 'Style Reference' : 'Character Reference';
                        const settingsForThisConn = settings.guidance?.find((g: any) => g.connectorName === conn.to.connectorName) || {};

                        const handleGuidanceChange = (newGuidanceSettings: any) => {
                            const otherGuidance = settings.guidance?.filter((g: any) => g.connectorName !== conn.to.connectorName) || [];
                            const newTotalGuidance = [...otherGuidance, { connectorName: conn.to.connectorName, ...settingsForThisConn, ...newGuidanceSettings }];
                            handleSettingsChange(node.id, { guidance: newTotalGuidance });
                        };

                        const strengthOptions = guidanceType === 'Style Reference' 
                            ? ['Low', 'Mid', 'High', 'Ultra', 'Max'] 
                            : ['Low', 'Mid', 'High'];
                        
                        return (
                            <div key={conn.to.connectorName} className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 space-y-3">
                                <p className="text-sm font-semibold text-slate-200">{conn.to.connectorName}</p>
                                <LabeledInput label="Strength">
                                    <select 
                                      className="block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100"
                                      value={settingsForThisConn.strengthType || 'Mid'}
                                      onChange={e => handleGuidanceChange({ strengthType: e.target.value })}
                                    >
                                       {strengthOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </LabeledInput>
                            </div>
                        );
                    })}
                </SettingsSection>
            )}
            {modelSupports(model, 'promptEnhance') && (
                <SettingsSection title="Enhancement">
                    <ToggleSwitch 
                        label="Prompt Enhance" 
                        checked={!!settings.promptEnhance} 
                        onChange={(checked) => handleSettingsChange(node.id, { promptEnhance: checked })}
                    />
                </SettingsSection>
            )}
        </>
      );
    };

    const renderTextToVideoSettings = () => {
        if (node.typeKey !== 'text-to-video') return null;
        const videoModelConfig = getModelConfig(settings.model);
        const supportedResolutions = videoModelConfig?.supports?.resolutions || VIDEO_RESOLUTIONS;
        
        const handleModelChange = (newModel: string) => {
            const newModelDefaults = getModelDefaults(newModel);
            const newSettings: any = { 
                model: newModel,
                ...newModelDefaults
            };
            handleSettingsChange(node.id, newSettings);
        }
        return (
          <SettingsSection title="Video Settings">
            <LabeledInput label="Model">
                <select
                    className="block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100"
                    value={settings.model} onChange={(e) => handleModelChange(e.target.value)}>
                    {nodeType.models!.map(m => <option key={m}>{m}</option>)}
                </select>
            </LabeledInput>
            <LabeledInput label="Resolution">
                <select
                    className="block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-slate-100"
                    value={settings.resolution} onChange={(e) => handleSettingsChange(node.id, { resolution: e.target.value })}>
                    {supportedResolutions.map(res => (
                        <option key={res} value={res}>
                            {res === 'RESOLUTION_480' ? '480p' : '720p'}
                        </option>
                    ))}
                </select>
                {supportedResolutions.length === 1 && <p className="mt-1 text-xs text-slate-400">{settings.model} only supports {supportedResolutions[0] === 'RESOLUTION_480' ? '480p' : '720p'}.</p>}
            </LabeledInput>
            {modelSupports(settings.model, 'frameInterpolation') && (
                <ToggleSwitch label="Frame Interpolation" checked={!!settings.frameInterpolation} onChange={(checked) => handleSettingsChange(node.id, { frameInterpolation: checked })}/>
            )}
            {modelSupports(settings.model, 'promptEnhance') && (
                <ToggleSwitch label="Prompt Enhance" checked={!!settings.promptEnhance} onChange={(checked) => handleSettingsChange(node.id, { promptEnhance: checked })}/>
            )}
          </SettingsSection>
        );
    };

    const renderImageToVideoSettings = () => {
        if (node.typeKey !== 'image-to-video') return null;
        return (
          <SettingsSection title="Animation Settings">
            <LabeledInput label={`Motion Strength: ${settings.motionStrength}`}>
                <input
                    type="range" min="1" max="10" step="1"
                    value={settings.motionStrength || 5}
                    className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                    onChange={(e) => handleSettingsChange(node.id, { motionStrength: parseInt(e.target.value, 10) })}
                />
            </LabeledInput>
          </SettingsSection>
        );
    };

    const renderImageEditSettings = () => {
        if (node.typeKey !== 'image-edit') return null;
        return (
            <SettingsSection title="Edit Settings">
                <LabeledInput label={`Strength: ${Number(settings.strength || 0.6).toFixed(2)}`} description="How much the output should be influenced by the prompt.">
                    <input
                        type="range"
                        min="0.1" max="1.0" step="0.05"
                        value={settings.strength || 0.6}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                        onChange={(e) => handleSettingsChange(node.id, { strength: parseFloat(e.target.value) })}
                    />
                </LabeledInput>
                <LabeledInput label="Seed" description="Leave blank for a random seed.">
                    <input
                        type="number"
                        placeholder="e.g., 12345"
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-slate-400 text-slate-100"
                        value={settings.seed || ''}
                        onChange={(e) => handleSettingsChange(node.id, { seed: e.target.value })}
                    />
                </LabeledInput>
            </SettingsSection>
        );
    };
    
    return (
        <div className="p-4 md:p-0">
            <div className="mb-4 hidden md:block">
                <h2 className="text-xl font-semibold text-slate-100">{nodeType?.name}</h2>
                <p className="mt-1 text-sm text-slate-400 truncate">ID: {node.id}</p>
            </div>

            {renderInputContentSettings()}
            {renderImageGenSettings()}
            {renderTextToVideoSettings()}
            {renderImageToVideoSettings()}
            {renderImageEditSettings()}
            {renderInputExposureSettings()}
            
            <button
                onClick={() => onDeleteNodes([node.id])}
                className="mt-8 w-full bg-red-500/80 hover:bg-red-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
                Delete Node
            </button>
        </div>
    );
  };

  const renderContent = () => {
    if (selectedConnectionCount > 0) {
      return (
        <div className="p-4 md:p-0">
          <div className="mb-8 hidden md:block">
            <h2 className="text-xl font-semibold text-slate-100">{selectedConnectionCount} Connection{selectedConnectionCount > 1 ? 's' : ''} Selected</h2>
            <p className="mt-1 text-slate-400">Bulk actions are available.</p>
          </div>
          <button
            onClick={onDeleteConnections}
            className="w-full bg-red-500/80 hover:bg-red-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            Delete Selected
          </button>
        </div>
      );
    }
    
    if (selectedNodeCount === 0) return null;

    if (selectedNodeCount > 1) {
      // If all selected nodes are the same type, show bulk editing interface
      if (areAllNodesSameType()) {
        return renderBulkNodeSettings();
      }
      
      // Otherwise, show the simple bulk delete interface
      return (
        <div className="p-4 md:p-0">
          <div className="mb-8 hidden md:block">
            <h2 className="text-xl font-semibold text-slate-100">{selectedNodeCount} Nodes Selected</h2>
            <p className="mt-1 text-slate-400">Mixed node types - only bulk delete available.</p>
          </div>
          <button
            onClick={() => onDeleteNodes(selectedNodes.map(n => n.id))}
            className="w-full bg-red-500/80 hover:bg-red-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            Delete Selected
          </button>
        </div>
      );
    }

    return renderSingleNodeSettings(selectedNodes[0]);
  };
  
  const desktopClasses = "absolute top-14 right-0 bottom-0 w-80 bg-[#111827e6] backdrop-blur-sm border-l border-slate-800 p-8 shadow-xl z-50 transition-transform transform";
  const mobileClasses = "fixed bottom-0 left-0 w-full h-[90vh] max-h-[90vh] bg-[#111827] border-t border-slate-800 rounded-t-xl shadow-2xl z-50 transition-transform duration-300 ease-in-out flex flex-col";
  
  const transformClass = isAnythingSelected
    ? (isMobile 
        ? (isExpanded ? 'translate-y-[10vh]' : 'translate-y-[calc(100%-200px)]') 
        : 'translate-x-0')
    : (isMobile ? 'translate-y-full' : 'translate-x-full');

  const getTitle = () => {
    if (selectedConnectionCount > 0) return `${selectedConnectionCount} Connection${selectedConnectionCount > 1 ? 's' : ''} Selected`;
    if (selectedNodeCount > 1) {
      if (areAllNodesSameType()) {
        return `${selectedNodeCount} ${NODE_TYPES[selectedNodes[0].typeKey]?.name || 'Node'} Nodes`;
      }
      return `${selectedNodeCount} Nodes Selected`;
    }
    if (selectedNodeCount === 1) return NODE_TYPES[selectedNodes[0].typeKey]?.name || 'Settings';
    return 'Settings';
  }

  return (
    <div
      id="sidebar"
      className={`${isMobile ? mobileClasses : desktopClasses} ${transformClass}`}
    >
      {isMobile && isAnythingSelected && (
        <div 
          className="flex-shrink-0 p-4 border-b border-slate-700/80 cursor-pointer touch-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-10 h-1.5 bg-slate-600 rounded-full mx-auto mb-3"></div>
          <h2 className="text-lg font-semibold text-center text-slate-100">{getTitle()}</h2>
        </div>
      )}
      <div ref={contentRef} className={`overflow-y-auto ${isMobile ? 'flex-grow p-4' : 'h-full pr-2'}`}>
        {renderContent()}
      </div>
    </div>
  );
};

export default Sidebar;
