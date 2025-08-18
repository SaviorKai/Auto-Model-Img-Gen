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
    canHandleText: true, // Can handle short text (1-2 words)
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
  const needsText = recommendationString.includes('NEEDS TEXT LONG') || recommendationString.includes('NEEDS TEXT SHORT');
  const needsImageEdit = recommendationString.includes('IMAGE EDIT');
  
  const preferredGuidanceTypes: ('STYLE' | 'CONTENT' | 'CHARACTER')[] = [];
  if (recommendationString.includes('STYLE REF')) preferredGuidanceTypes.push('STYLE');
  if (recommendationString.includes('CONTENT REF')) preferredGuidanceTypes.push('CONTENT');
  if (recommendationString.includes('CHARACTER REF')) preferredGuidanceTypes.push('CHARACTER');
  
  
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

// Helper function to analyze text complexity from the recommendation string
function analyzeTextComplexity(recommendationString: string, originalPrompt?: string): 'none' | 'short' | 'long' {
  // Override Gemini's classification if we can detect specific quoted text
  if (originalPrompt && (recommendationString.includes('NEEDS TEXT LONG') || recommendationString.includes('NEEDS TEXT SHORT'))) {
    // Look for quoted text patterns to override Gemini's classification
    const quotedTextPatterns = [
      /"([^"]{1,50})"/g,
      /'([^']{1,50})'/g,
      /reading "([^"]{1,50})"/gi,
      /says "([^"]{1,50})"/gi,
      /text "([^"]{1,50})"/gi,
      /label "([^"]{1,50})"/gi,
      /sign "([^"]{1,50})"/gi
    ];
    
    for (const pattern of quotedTextPatterns) {
      const matches = [...originalPrompt.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const wordCount = match[1].trim().split(/\s+/).length;
          if (wordCount <= 2) {
            return 'short';
          } else if (wordCount >= 3) {
            return 'long';
          }
        }
      }
    }
  }
  
  // Check for the new specific text indicators
  if (recommendationString.includes('NEEDS TEXT LONG')) {
    return 'long';
  }
  
  if (recommendationString.includes('NEEDS TEXT SHORT')) {
    return 'short';
  }
  
  // If neither specific indicator is found, check for generic NEEDS TEXT
  if (recommendationString.includes('NEEDS TEXT')) {
    // If we have the original prompt, do a backup analysis
    if (originalPrompt) {
      // Look for common patterns that indicate short text (quoted text)
      const shortTextPatterns = [
        /add the word[s]? ["']([^"']{1,20})["']/i,
        /write ["']([^"']{1,20})["']/i,
        /text says? ["']([^"']{1,20})["']/i,
        /label[ed]? ["']([^"']{1,20})["']/i,
        /sign says? ["']([^"']{1,20})["']/i
      ];
      
      for (const pattern of shortTextPatterns) {
        const match = originalPrompt.match(pattern);
        if (match && match[1]) {
          const wordCount = match[1].trim().split(/\s+/).length;
          if (wordCount <= 2) {
            return 'short';
          }
        }
      }
      
      // Look for patterns that indicate long text (complex descriptions)
      const longTextPatterns = [
        /paragraph/i,
        /sentence/i,
        /story/i,
        /description/i,
        /article/i,
        /essay/i,
        /multiple words/i,
        /several words/i,
        /long text/i,
        /detailed text/i
      ];
      
      for (const pattern of longTextPatterns) {
        if (originalPrompt.match(pattern)) {
          return 'long';
        }
      }
      
      // Count words in the entire prompt as a fallback
      const promptWordCount = originalPrompt.trim().split(/\s+/).length;
      
      // If the prompt itself is short and simple, likely needs short text
      if (promptWordCount <= 5) {
        return 'short';
      }
    }
    
    // Default to short text for ambiguous cases (Lucid Origin is better for general use)
    return 'short';
  }
  
  return 'none';
}

// Main auto model selection function
export function selectOptimalModel(
  recommendationString: string,
  referenceImageCount: number,
  originalPrompt?: string
): { selectedModel: string; recommendedGuidanceType?: 'Context Images' | 'Style Reference' | 'Content Reference' | 'Character Reference' } {
  
  const recommendation = parseRecommendation(recommendationString);
  
  // Step 1: Handle image editing (separate category)
  if (recommendation.needsImageEdit) {
    return { 
      selectedModel: 'FLUX.1 Kontext',
      recommendedGuidanceType: referenceImageCount > 0 ? 'Context Images' : undefined
    };
  }
  
  // Step 2: If there are reference images, ALWAYS use FLUX.1 Kontext Pro
  if (referenceImageCount > 0) {
    return {
      selectedModel: 'FLUX.1 Kontext Pro',
      recommendedGuidanceType: 'Context Images'
    };
  }
  
  // Step 3: Start with all available models (no reference images)
  let candidateModels = [...MODEL_CAPABILITIES];
  
  // Step 4: Handle text requirements with specific model selection
  if (recommendation.needsText) {
    const textComplexity = analyzeTextComplexity(recommendationString, originalPrompt);
    
    if (textComplexity === 'long') {
      return {
        selectedModel: 'Leonardo Phoenix 1.0',
        recommendedGuidanceType: recommendation.preferredGuidanceTypes.length > 0 
          ? selectGuidanceType('Leonardo Phoenix 1.0', recommendation.preferredGuidanceTypes)
          : undefined
      };
    } else if (textComplexity === 'short') {
      return {
        selectedModel: 'Lucid Origin',
        recommendedGuidanceType: recommendation.preferredGuidanceTypes.length > 0 
          ? selectGuidanceType('Lucid Origin', recommendation.preferredGuidanceTypes)
          : undefined
      };
    }
  }
  
  // Step 5: If we have preferred guidance types, prefer models that support them
  if (recommendation.preferredGuidanceTypes.length > 0) {
    const modelsWithPreferredGuidance = candidateModels.filter(model =>
      recommendation.preferredGuidanceTypes.some(type => model.supportedGuidanceTypes.includes(type))
    );
    
    // If we found models with preferred guidance, use those
    if (modelsWithPreferredGuidance.length > 0) {
      candidateModels = modelsWithPreferredGuidance;
    }
  }
  
  // Step 6: If no candidates remain, fallback to Lucid Origin
  if (candidateModels.length === 0) {
    return { 
      selectedModel: 'Lucid Origin',
      recommendedGuidanceType: undefined
    };
  }
  
  // Step 7: Select the best model (lowest rank wins)
  candidateModels.sort((a, b) => a.rank - b.rank);
  const selectedModel = candidateModels[0];
  
  // Step 8: No reference images, so no guidance type needed
  const recommendedGuidanceType = undefined;
  
  return {
    selectedModel: selectedModel.name,
    recommendedGuidanceType
  };
}

// Export for debugging/testing
export { MODEL_CAPABILITIES, IMAGE_EDIT_MODELS };