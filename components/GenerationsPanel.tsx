import React from 'react';
import { MediaItem } from '../types';
import ImageViewer, { getExpandedImageSrc } from './ImageViewer';

interface GenerationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  generations: MediaItem[];
  isMobile: boolean;
}

const GenerationsPanel: React.FC<GenerationsPanelProps> = ({ isOpen, onClose, generations, isMobile }) => {

  const groupedByRun = generations.reduce((acc, gen) => {
    (acc[gen.runId] = acc[gen.runId] || []).push(gen);
    return acc;
  }, {} as Record<string, MediaItem[]>);

  const sortedRunIds = Object.keys(groupedByRun).sort((a, b) => Number(b) - Number(a));

  const handleDragStart = (e: React.DragEvent, mediaItem: MediaItem) => {
    e.dataTransfer.setData('application/x-blueprint-media-item', JSON.stringify(mediaItem));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const desktopClasses = "fixed top-0 right-0 h-full bg-[#111827e6] backdrop-blur-sm border-l border-slate-800 shadow-xl z-[100] transition-transform transform overflow-hidden";
  const mobileClasses = "fixed bottom-0 left-0 w-full h-[85vh] bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 rounded-t-xl shadow-lg z-[100] transition-transform transform overflow-hidden";

  const transformClass = isOpen 
    ? (isMobile ? 'translate-y-0' : 'translate-x-0')
    : (isMobile ? 'translate-y-full' : 'translate-x-full');

  return (
    <div
      className={`${isMobile ? mobileClasses : desktopClasses} ${transformClass}`}
      style={!isMobile ? { width: '320px' } : {}}
    >
      <div className="flex justify-between items-center p-4 border-b border-slate-800">
        <h2 className="text-xl font-semibold text-slate-100">Generations</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
      </div>

      <div 
        className="p-4 overflow-y-scroll"
        style={{ 
          height: isMobile ? 'calc(85vh - 73px)' : 'calc(100vh - 73px)'
        }}
      >
        {generations.length === 0 ? (
          <div className="text-center text-slate-400 mt-10">
            <p>No generations yet.</p>
            <p className="text-sm mt-1">Run a workflow to see your results here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedRunIds.map(runId => (
              <div key={runId}>
                <h3 className="text-sm font-semibold text-slate-400 mb-3">
                  Run at {new Date(Number(runId)).toLocaleString()}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {groupedByRun[runId].map((gen, index) => {
                    const imagesInRun = groupedByRun[runId]
                      .filter(item => item.type === 'image')
                      .map(item => ({ src: item.url, alt: `Generation ${groupedByRun[runId].indexOf(item) + 1}` }));
                    
                    const isCurrentlyViewed = getExpandedImageSrc() === gen.url;
                    
                    return (
                      <div 
                        key={`${gen.mediaId}-${index}`} 
                        className={`rounded-lg overflow-hidden group relative aspect-square bg-slate-800 cursor-grab ${
                          isCurrentlyViewed ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''
                        }`}
                        style={{ height: '120px' }}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, gen)}
                      >
                        {gen.type === 'video' ? (
                          <video 
                            src={gen.url} 
                            muted 
                            autoPlay 
                            loop 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageViewer 
                            src={gen.url} 
                            alt={`Generation ${index + 1}`} 
                            className="w-full h-full object-cover"
                            images={imagesInRun}
                            sidebarOpen={isOpen}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerationsPanel;