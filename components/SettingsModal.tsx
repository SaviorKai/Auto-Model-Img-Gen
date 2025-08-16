import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, geminiApiKey: string, isDevMode: boolean) => void;
  currentApiKey: string | null;
  currentGeminiApiKey: string | null;
  isDevMode: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentApiKey, currentGeminiApiKey, isDevMode }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setApiKeyInput(currentApiKey || '');
        setGeminiApiKeyInput(currentGeminiApiKey || '');
        setDevModeEnabled(isDevMode);
    }
  }, [currentApiKey, currentGeminiApiKey, isDevMode, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      onSave(apiKeyInput.trim(), geminiApiKeyInput.trim(), devModeEnabled);
    }
  };

  return (
    <div 
        className="leo-modal-overlay"
        onClick={onClose}
    >
      <div 
        className="leo-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="leo-modal-header">
          <h2 className="leo-modal-title">API Settings</h2>
          <button onClick={onClose} className="leo-modal-close">&times;</button>
        </div>
        
        <div className="leo-stack leo-stack-6">
          <div className="leo-stack leo-stack-3">
            <label htmlFor="api-key" className="leo-text-sm leo-font-medium leo-text-secondary">
              Leonardo.ai API Key
            </label>
            <input
              type="password"
              id="api-key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter your Leonardo AI key"
              className="leo-input"
            />
            <p className="leo-text-xs leo-text-tertiary">
              Get your API key from{' '}
              <a
                href="https://cloud.leonardo.ai/api-access"
                target="_blank"
                rel="noopener noreferrer"
                className="leo-text-highlight"
                style={{ textDecoration: 'none' }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Leonardo AI
              </a>
            </p>
          </div>

          <div className="leo-stack leo-stack-3">
            <label htmlFor="gemini-api-key" className="leo-text-sm leo-font-medium leo-text-secondary">
              Google Gemini API Key (for Prompt Enhancement)
            </label>
            <input
              type="password"
              id="gemini-api-key"
              value={geminiApiKeyInput}
              onChange={(e) => setGeminiApiKeyInput(e.target.value)}
              placeholder="Enter your Gemini API key"
              className="leo-input"
            />
            <p className="leo-text-xs leo-text-tertiary">
              Get your API key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="leo-text-highlight"
                style={{ textDecoration: 'none' }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Google AI Studio
              </a>
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--color-border-primary)' }}>
            <h3 className="leo-text-sm leo-font-semibold leo-text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Developer Options</h3>
            <div className="leo-cluster leo-cluster-4" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <label className="leo-text-sm leo-font-medium leo-text-secondary">Dev Mode</label>
                <p className="leo-text-xs leo-text-tertiary">Show raw API output on each node.</p>
              </div>
              <label className="leo-toggle">
                <input type="checkbox" checked={devModeEnabled} onChange={(e) => setDevModeEnabled(e.target.checked)} />
                <span className="leo-toggle-slider"></span>
              </label>
            </div>
        </div>

        <div className="leo-modal-footer">
          <button 
            onClick={onClose}
            className="leo-button leo-button-secondary leo-button-md"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="leo-button leo-button-primary leo-button-md"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;