

import { NodeType } from './types';
import { 
  IMAGE_GEN_STYLES, 
  ASPECT_RATIO_DIMENSIONS, 
  MODEL_ID_MAP, 
  MODEL_GUIDANCE_SUPPORT,
  getModelsForNodeType
} from './modelConfig';

export const NODE_WIDTH = 256;
export const GRID_SIZE = 24;
export const VIRTUAL_CANVAS_SIZE = 10000;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.0;

export const TYPE_COLORS: Record<string, string> = {
  text: '#3b82f6', // blue-500
  image: '#8b5cf6', // violet-500
  video: '#22c55e', // green-500
};

// Model configuration now imported from modelConfig.ts - single source of truth
// Export for backward compatibility
export { IMAGE_GEN_STYLES, ASPECT_RATIO_DIMENSIONS, MODEL_ID_MAP, MODEL_GUIDANCE_SUPPORT };


export const TextIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" />
    </svg>
);

export const ImageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

export const VideoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

export const VideoUploadIcon = () => (
    <svg className="mx-auto h-12 w-12 text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M34.5 21.75l-12 6.75-12-6.75" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.5 21.75v-9a2 2 0 012-2h13a2 2 0 012 2v9m-17 0v9a2 2 0 002 2h13a2 2 0 002-2v-9" />
    </svg>
);

export const NODE_TYPES: Record<string, NodeType> = {
  // === INPUT NODES ===
  'input-text': {
    name: 'Text',
    color: 'bg-slate-600',
    category: 'Inputs',
    icon: TextIcon,
    inputs: [],
    outputs: [{ name: 'Text', type: 'text' }],
    defaultSettings: {
      text: '',
      exposeAsInput: false,
      instructions: '',
    },
  },
  'input-image': {
    name: 'Image',
    color: 'bg-slate-600',
    category: 'Inputs',
    icon: ImageIcon,
    inputs: [],
    outputs: [{ name: 'Image', type: 'image' }],
    defaultSettings: {
      src: '',
      fileName: '',
      mediaId: null,
      exposeAsInput: false,
      instructions: '',
    },
  },
  'input-video': {
    name: 'Video',
    color: 'bg-slate-600',
    category: 'Inputs',
    icon: VideoIcon,
    inputs: [],
    outputs: [{ name: 'Video', type: 'video' }],
    defaultSettings: {
      src: '',
      fileName: '',
      exposeAsInput: false,
      instructions: '',
    },
  },

  // === PRIMARY NODES ===
  'image-generation': {
    name: 'Image Generation',
    color: 'bg-purple-600',
    category: 'Primary Nodes',
    description: 'Turn text prompts into stunning images. Supports advanced image guidance.',
    inputs: [
      { name: 'Prompt', type: 'text' },
      { name: 'Negative Prompt', type: 'text' },
      { name: 'Style Reference', type: 'image', count: 4 },
      { name: 'Character Reference', type: 'image', count: 1 },
    ],
    outputs: [{ name: 'Image', type: 'image' }],
    defaultSettings: {
        model: 'Leonardo Diffusion XL',
        style: 'Dynamic',
        numImages: 1,
        aspectRatio: '1:1',
        seed: '',
        contrast: 1.0,
        guidance: [],
    },
    models: getModelsForNodeType('image-generation'),
  },
  'text-to-video': {
    name: 'Text to Video',
    color: 'bg-green-600',
    category: 'Primary Nodes',
    description: 'Create videos from text descriptions.',
    inputs: [
      { name: 'Prompt', type: 'text' },
      { name: 'Negative Prompt', type: 'text' },
    ],
    outputs: [{ name: 'Video', type: 'video' }],
    defaultSettings: {
      model: 'MOTION2',
      resolution: 'RESOLUTION_480',
      frameInterpolation: false,
      promptEnhance: false,
    },
    models: getModelsForNodeType('text-to-video')
  },
  'image-to-video': {
    name: 'Image to Video (Motion)',
    color: 'bg-emerald-600',
    category: 'Primary Nodes',
    description: 'Animate a static image to create a short video.',
    inputs: [
      { name: 'Image', type: 'image' },
    ],
    outputs: [{ name: 'Video', type: 'video' }],
    defaultSettings: {
      motionStrength: 5,
    }
  },
  'image-edit': {
    name: 'Image Edit',
    color: 'bg-yellow-600',
    category: 'Primary Nodes',
    description: 'Modify existing images with simple text instructions.',
    inputs: [
      { name: 'Prompt', type: 'text' },
      { name: 'Image to Edit', type: 'image' },
    ],
    outputs: [{ name: 'Image', type: 'image' }],
    defaultSettings: {
        model: 'FLUX.1 Kontext',
        strength: 0.6,
        seed: '',
    },
    models: getModelsForNodeType('image-edit')
  },
};

export const KeyboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

export const MapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l6.553 3.276a1 1 0 001.447-.894V5.618a1 1 0 00-1.447-.894L15 7m-6 3l6-3m0 0l6-3m-6 3v10" />
    </svg>
);

export const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const ExportIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

export const ImportIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

export const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);