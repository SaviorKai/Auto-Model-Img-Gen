
// --- SHARED CONFIGURATIONS ---

// Available styles for image generation models
export const IMAGE_GEN_STYLES = [
  'None', 'Leonardo', 'Anime', 'Bokeh', 'Cinematic', 'Creative',
  'Dynamic', 'Environment', 'Fashion', 'Film', 'Food', 'General', 'Hdr',
  'Illustration', 'Long Exposure', 'Macro', 'Minimalistic', 'Monochrome',
  'Moody', 'Neutral', 'Photography', 'Portrait', 'Raytraced', 'Render 3d',
  'Retro', 'Sketch Bw', 'Sketch Color', 'Stock Photo', 'Vibrant'
];

// Available aspect ratios and their dimensions
// Valid Leonardo Flux combinations: 1024x1024, 1456x720, 720x1456, 1248x832, 832x1248, 1184x880, 880x1184, 1104x944, 944x1104, 1568x672, 672x1568, 1392x752, 752x1392
export const ASPECT_RATIO_DIMENSIONS: { [key: string]: { width: number; height: number; } } = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1456, height: 720 },
    '9:16': { width: 720, height: 1456 },
    '4:3': { width: 1184, height: 880 },
    '3:4': { width: 880, height: 1184 },
};

// Available contrast values for supported models
export const CONTRAST_VALUES = [1.0, 1.3, 1.8, 2.5, 3.0, 3.5, 4.5];

// Available video resolutions
export const VIDEO_RESOLUTIONS = ['RESOLUTION_480', 'RESOLUTION_720'];


// --- MODEL-SPECIFIC CONFIGURATIONS ---

// Defines the detailed configuration for each available model.
export const MODEL_CONFIG: Record<string, any> = {
    // --- AUTO Model ---
    "Auto": {
        id: "auto-select",
        nodeType: 'image-generation' as const,
        family: 'AUTO',
        supports: {
            contrast: true,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {},
            promptEnhance: true
        },
        defaults: {
            style: 'Dynamic',
            contrast: 1.0,
            numImages: 1,
        }
    },

    // --- FLUX Models ---
    "FLUX.1 Kontext": {
        id: "28aeddf8-bd19-4803-80fc-79602d1a9989",
        nodeType: 'image-edit',
        family: 'FLUX',
        supports: {
            contrast: true,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {}
        },
        defaults: {
            strength: 0.6,
        }
    },
    "FLUX.1 Kontext Pro": {
        id: "28aeddf8-bd19-4803-80fc-79602d1a9989",
        nodeType: 'image-generation',
        family: 'FLUX',
        supports: {
            contrast: true,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {},
            promptEnhance: true
        },
        defaults: {
            style: 'Dynamic',
            contrast: 1.0,
            numImages: 1,
        }
    },
    "Flux Dev (Precision)": {
        id: "b2614463-296c-462a-9586-aafdb8f00e36",
        nodeType: 'image-generation',
        family: 'FLUX',
        supports: {
            contrast: true,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 299, maxInputs: 4 }
            }
        },
        defaults: {
            style: 'Dynamic',
            contrast: 1.0,
        }
    },
    "Flux Schnell (Speed)": {
        id: "1dd50843-d653-4516-a8e3-f0238ee453ff",
        nodeType: 'image-generation',
        family: 'FLUX',
        supports: {
            contrast: true,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 298, maxInputs: 4 }
            }
        },
        defaults: {
            style: 'Dynamic',
            contrast: 1.0,
        }
    },

    // --- Leonardo Models (Phoenix) ---
    "Leonardo Phoenix 1.0": {
        id: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3",
        nodeType: 'image-generation',
        family: 'PHOENIX',
        supports: {
            alchemy: true,
            contrast: true,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 166, maxInputs: 4 },
                'Character Reference': { preprocessorId: 397, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Dynamic',
            contrast: 2.5, // Required for Alchemy
        }
    },
    "Leonardo Phoenix 0.9": {
        id: "6b645e3a-d64f-4341-a6d8-7a3690fbf042",
        nodeType: 'image-generation',
        family: 'PHOENIX',
        supports: {
            alchemy: true,
            contrast: true,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 166, maxInputs: 4 },
                'Character Reference': { preprocessorId: 397, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Dynamic',
            contrast: 2.5, // Required for Alchemy
        }
    },

    // --- Leonardo Models (XL General) ---
    "Leonardo Lightning XL": {
        id: "b24e16ff-06e3-43eb-8d33-4416c2d75876",
        nodeType: 'image-generation',
        family: 'SDXL',
        supports: {
            alchemy: false,
            contrast: false,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 67, maxInputs: 4 },
                'Character Reference': { preprocessorId: 133, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Dynamic',
        }
    },
    "Leonardo Anime XL": {
        id: "e71a1c2f-4f80-4800-934f-2c68979d8cc8",
        nodeType: 'image-generation',
        family: 'SDXL',
        supports: {
            alchemy: false,
            contrast: false,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 67, maxInputs: 4 },
                'Character Reference': { preprocessorId: 133, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Anime',
        }
    },
    "Leonardo Diffusion XL": {
        id: "1e60896f-3c26-4296-8ecc-53e2afecc132",
        nodeType: 'image-generation',
        family: 'SDXL',
        supports: {
            alchemy: false,
            contrast: false,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 67, maxInputs: 4 },
                'Character Reference': { preprocessorId: 133, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Dynamic',
        }
    },
    "Leonardo Kino XL": {
        id: "aa77f04e-3eec-4034-9c07-d0f619684628",
        nodeType: 'image-generation',
        family: 'SDXL',
        supports: {
            alchemy: false,
            contrast: false,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 67, maxInputs: 4 },
                'Character Reference': { preprocessorId: 133, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Cinematic',
        }
    },
    "Leonardo Vision XL": {
        id: "5c232a9e-9061-4777-980a-ddc8e65647c6",
        nodeType: 'image-generation',
        family: 'VISION',
        supports: {
            alchemy: true,
            contrast: false, // Vision uses Alchemy but doesn't have the contrast setting
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 67, maxInputs: 4 },
                'Character Reference': { preprocessorId: 133, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Dynamic',
        }
    },

    // --- Other SDXL & Custom Models ---
    "SDXL 1.0": {
        id: "16e7060a-803e-4df3-97ee-edcfa5dc9cc8",
        nodeType: 'image-generation',
        family: 'SDXL',
        supports: {
            alchemy: false,
            contrast: false,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 67, maxInputs: 4 },
                'Character Reference': { preprocessorId: 133, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Dynamic',
        }
    },
    "AlbedoBase XL": {
        id: "2067ae52-33fd-4a82-bb92-c2c55e7d2786",
        nodeType: 'image-generation',
        family: 'SDXL',
        supports: {
            alchemy: false,
            contrast: false,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 67, maxInputs: 4 },
                'Character Reference': { preprocessorId: 133, maxInputs: 1 }
            }
        },
        defaults: {
            style: 'Dynamic',
        }
    },
    "Lucid Realism": {
        id: "05ce0082-2d80-4a2d-8653-4d1c85e2418e",
        nodeType: 'image-generation',
        family: 'CUSTOM',
        supports: {
            alchemy: false,
            contrast: false,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 431, maxInputs: 4 }
            }
        },
        defaults: {
            style: 'Photography',
        }
    },
    "Lucid Origin": {
        id: "7b592283-e8a7-4c5a-9ba6-d18c31f258b9",
        nodeType: 'image-generation',
        family: 'CUSTOM',
        supports: {
            alchemy: false,
            contrast: false,
            aspectRatios: Object.keys(ASPECT_RATIO_DIMENSIONS),
            guidance: {
                'Style Reference': { preprocessorId: 431, maxInputs: 4 }
            }
        },
        defaults: {
            style: 'Vibrant',
        }
    },
    
    // --- Video Models ---
    "MOTION2": {
        id: null, // No model ID for this API endpoint
        nodeType: 'text-to-video',
        family: 'MOTION',
        supports: {
            resolutions: ['RESOLUTION_480', 'RESOLUTION_720'],
            frameInterpolation: true,
            promptEnhance: true,
        },
        defaults: {
            resolution: 'RESOLUTION_480',
            frameInterpolation: false,
            promptEnhance: false,
        }
    },
    "VEO3": {
        id: null, // No model ID for this API endpoint
        nodeType: 'text-to-video',
        family: 'VEO',
        supports: {
            resolutions: ['RESOLUTION_720'],
            frameInterpolation: true,
            promptEnhance: true,
        },
        defaults: {
            resolution: 'RESOLUTION_720',
            frameInterpolation: false,
            promptEnhance: false,
        }
    }
};

// Type definition for a single model config entry
export type ModelConfigEntry = typeof MODEL_CONFIG[keyof typeof MODEL_CONFIG];

// Helper functions for accessing model configuration
export const getModelsForNodeType = (nodeType: 'image-generation' | 'image-edit' | 'text-to-video') => {
    return Object.keys(MODEL_CONFIG).filter(modelName => {
        const config = MODEL_CONFIG[modelName as keyof typeof MODEL_CONFIG];
        return config.nodeType === nodeType;
    });
};

// Get model ID by name
export const getModelId = (modelName: string): string | null => {
    const config = MODEL_CONFIG[modelName as keyof typeof MODEL_CONFIG];
    return config?.id || null;
};

// Get model configuration by name
export const getModelConfig = (modelName: string): ModelConfigEntry | null => {
    return MODEL_CONFIG[modelName as keyof typeof MODEL_CONFIG] || null;
};

// Get guidance support for a model
export const getModelGuidanceSupport = (modelName: string) => {
    const config = MODEL_CONFIG[modelName as keyof typeof MODEL_CONFIG];
    return config?.supports?.guidance || {};
};

// Check if model supports a feature
export const modelSupports = (modelName: string, feature: 'alchemy' | 'contrast' | 'frameInterpolation' | 'promptEnhance'): boolean => {
    const config = MODEL_CONFIG[modelName as keyof typeof MODEL_CONFIG];
    return config?.supports?.[feature] === true;
};

// Get model defaults
export const getModelDefaults = (modelName: string) => {
    const config = MODEL_CONFIG[modelName as keyof typeof MODEL_CONFIG];
    return config?.defaults || {};
};

// Legacy compatibility - exports that match current constants.tsx usage
export const MODEL_ID_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(MODEL_CONFIG)
        .filter(([_, config]) => config.id !== null)
        .map(([name, config]) => [name, config.id as string])
);

export const MODEL_GUIDANCE_SUPPORT: Record<string, Record<string, { preprocessorId: number, maxInputs: number }>> = Object.fromEntries(
    Object.entries(MODEL_CONFIG)
        .filter(([_, config]) => config.supports?.guidance)
        .map(([name, config]) => [name, config.supports!.guidance!])
);