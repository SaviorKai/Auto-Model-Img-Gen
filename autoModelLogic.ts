/**
 * Auto Model Selection Logic
 * 
 * This module handles the automatic selection of the best AI model based on:
 * - Prompt enhancement recommendations
 * - Number of reference images available
 * - Model capabilities and rankings
 * 
 * Uses an elimination-based approach starting with all models and narrowing down
 * until the optimal model is selected.
 */

// Model capabilities and rankings
interface ModelCapabilities {
  name: string;
  rank: number; // Lower rank = better (used as tie-breaker)
  canHandleText: boolean;
  canHandleImageEdit: boolean;
  maxReferenceImages: number;
  supportedGuidanceTypes: ('CONTEXT' | 'STYLE' | 'CONTENT' | 'CHARACTER')[];
}

const MODEL_CAPABILITIES: ModelCapabilities[] = [
  {
    name: 'Lucid Origin',
    rank: 1,
    canHandleText: false,
    canHandleImageEdit: true,
    maxReferenceImages: 1,
    supportedGuidanceTypes: ['CONTENT', 'STYLE']
  },
  {
    name: 'FLUX.1 Kontext Pro',
    rank: 2,
    canHandleText: true,
    canHandleImageEdit: false,
    maxReferenceImages: 1,
    supportedGuidanceTypes: ['CONTEXT']
  },
  {
    name: 'Leonardo Phoenix 1.0',
    rank: 3,
    canHandleText: true,
    canHandleImageEdit: false,
    maxReferenceImages: 6,
    supportedGuidanceTypes: ['CONTENT', 'STYLE', 'CHARACTER']
  }
];

// Image edit models (separate category)
const IMAGE_EDIT_MODELS = ['FLUX.1 Kontext'];

// Parse recommendation string from prompt enhancement
interface ParsedRecommendation {
  needsText: boolean;
  needsImageEdit: boolean;
  preferredGuidanceTypes: ('STYLE' | 'CONTENT' | 'CHARACTER')[];
}

export function parseRecommendation(recommendationString: string): ParsedRecommendation {
  // Handle both comma and newline formats
  const needsText = recommendationString.includes('NEEDS TEXT');
  const needsImageEdit = recommendationString.includes('IMAGE EDIT');
  
  const preferredGuidanceTypes: ('STYLE' | 'CONTENT' | 'CHARACTER')[] = [];
  if (recommendationString.includes('STYLE REF')) preferredGuidanceTypes.push('STYLE');
  if (recommendationString.includes('CONTENT REF')) preferredGuidanceTypes.push('CONTENT');
  if (recommendationString.includes('CHARACTER REF')) preferredGuidanceTypes.push('CHARACTER');
  
  console.log('🔧 Parse Debug:');
  console.log('  Input string:', JSON.stringify(recommendationString));
  console.log('  needsText:', needsText);
  console.log('  needsImageEdit:', needsImageEdit);
  console.log('  preferredGuidanceTypes:', preferredGuidanceTypes);
  
  return {
    needsText,
    needsImageEdit,
    preferredGuidanceTypes
  };
}

// Determine the best guidance type for a model based on recommendations
export function selectGuidanceType(
  modelName: string, 
  preferredGuidanceTypes: ('STYLE' | 'CONTENT' | 'CHARACTER')[]
): 'Context Images' | 'Style Reference' | 'Content Reference' | 'Character Reference' {
  
  // Flux models always use Context Images
  if (modelName === 'FLUX.1 Kontext Pro' || modelName === 'FLUX.1 Kontext') {
    return 'Context Images';
  }
  
  const model = MODEL_CAPABILITIES.find(m => m.name === modelName);
  if (!model) return 'Style Reference'; // Fallback
  
  // For other models, use the first preferred guidance type that the model supports
  for (const preferredType of preferredGuidanceTypes) {
    if (model.supportedGuidanceTypes.includes(preferredType)) {
      switch (preferredType) {
        case 'STYLE': return 'Style Reference';
        case 'CONTENT': return 'Content Reference';
        case 'CHARACTER': return 'Character Reference';
      }
    }
  }
  
  // Fallback to the first supported guidance type
  if (model.supportedGuidanceTypes.includes('STYLE')) return 'Style Reference';
  if (model.supportedGuidanceTypes.includes('CONTENT')) return 'Content Reference';
  if (model.supportedGuidanceTypes.includes('CHARACTER')) return 'Character Reference';
  
  return 'Style Reference'; // Final fallback
}

// Main auto model selection function
export function selectOptimalModel(
  recommendationString: string,
  referenceImageCount: number
): { selectedModel: string; recommendedGuidanceType?: 'Context Images' | 'Style Reference' | 'Content Reference' | 'Character Reference' } {
  
  const recommendation = parseRecommendation(recommendationString);
  
  console.log('🔍 Auto Logic Debug:');
  console.log('  Parsed recommendation:', recommendation);
  
  // Step 1: Handle image editing (separate category)
  if (recommendation.needsImageEdit) {
    console.log('  → Image edit detected, selecting FLUX.1 Kontext');
    return { 
      selectedModel: 'FLUX.1 Kontext',
      recommendedGuidanceType: referenceImageCount > 0 ? 'Context Images' : undefined
    };
  }
  
  // Step 2: If there are reference images, ALWAYS use FLUX.1 Kontext Pro
  if (referenceImageCount > 0) {
    console.log(`  → ${referenceImageCount} reference images detected, selecting FLUX.1 Kontext Pro`);
    return {
      selectedModel: 'FLUX.1 Kontext Pro',
      recommendedGuidanceType: 'Context Images'
    };
  }
  
  // Step 3: Start with all available models (no reference images)
  let candidateModels = [...MODEL_CAPABILITIES];
  console.log('  → Starting candidates:', candidateModels.map(m => m.name));
  
  // Step 4: Eliminate models that can't handle text if text is needed
  if (recommendation.needsText) {
    console.log('  → Text needed, filtering out non-text models');
    candidateModels = candidateModels.filter(model => model.canHandleText);
    console.log('  → After text filter:', candidateModels.map(m => m.name));
  }
  
  // Step 5: If we have preferred guidance types, prefer models that support them
  if (recommendation.preferredGuidanceTypes.length > 0) {
    console.log('  → Preferred guidance types:', recommendation.preferredGuidanceTypes);
    const modelsWithPreferredGuidance = candidateModels.filter(model =>
      recommendation.preferredGuidanceTypes.some(type => model.supportedGuidanceTypes.includes(type))
    );
    
    // If we found models with preferred guidance, use those
    if (modelsWithPreferredGuidance.length > 0) {
      candidateModels = modelsWithPreferredGuidance;
      console.log('  → After guidance filter:', candidateModels.map(m => m.name));
    }
  }
  
  // Step 6: If no candidates remain, fallback to Lucid Origin
  if (candidateModels.length === 0) {
    console.warn('  → No suitable models found, falling back to Lucid Origin');
    return { 
      selectedModel: 'Lucid Origin',
      recommendedGuidanceType: undefined
    };
  }
  
  // Step 7: Select the best model (lowest rank wins)
  candidateModels.sort((a, b) => a.rank - b.rank);
  const selectedModel = candidateModels[0];
  console.log('  → Final selection:', selectedModel.name, 'rank:', selectedModel.rank);
  
  // Step 8: No reference images, so no guidance type needed
  const recommendedGuidanceType = undefined;
  
  return {
    selectedModel: selectedModel.name,
    recommendedGuidanceType
  };
}

// Export for debugging/testing
export { MODEL_CAPABILITIES, IMAGE_EDIT_MODELS };