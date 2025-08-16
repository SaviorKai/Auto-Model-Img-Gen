import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Global state for expanded image
let expandedImageSrc: string | null = null;
const expandedImageListeners: Set<() => void> = new Set();

export const getExpandedImageSrc = () => expandedImageSrc;

interface ImageItem {
  src: string;
  alt: string;
}

interface ImageViewerProps {
  src: string;
  alt: string;
  className?: string;
  images?: ImageItem[];
  initialIndex?: number;
  sidebarOpen?: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ 
  src, 
  alt, 
  className = '', 
  images = [], 
  initialIndex = 0,
  sidebarOpen = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [, forceUpdate] = useState({});
  
  const allImages = images.length > 0 ? images : [{ src, alt }];
  const hasMultipleImages = allImages.length > 1;
  
  useEffect(() => {
    if (images.length > 0) {
      const index = images.findIndex(img => img.src === src);
      setCurrentIndex(index >= 0 ? index : 0);
    }
  }, [src, images]);

  useEffect(() => {
    if (!sidebarOpen && isExpanded) {
      setIsExpanded(false);
      setIsZoomedIn(false);
      expandedImageSrc = null;
    }
  }, [sidebarOpen, isExpanded]);

  useEffect(() => {
    const updateListener = () => forceUpdate({});
    expandedImageListeners.add(updateListener);
    return () => {
      expandedImageListeners.delete(updateListener);
    };
  }, []);
  
  const handleClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setIsZoomedIn(false);
      expandedImageSrc = allImages[currentIndex].src;
      expandedImageListeners.forEach(listener => listener());
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsExpanded(false);
      setIsZoomedIn(false);
      expandedImageSrc = null;
      expandedImageListeners.forEach(listener => listener());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setIsZoomedIn(false);
      expandedImageSrc = null;
      expandedImageListeners.forEach(listener => listener());
    } else if (e.key === 'ArrowLeft' && hasMultipleImages) {
      e.preventDefault();
      const newIndex = (currentIndex - 1 + allImages.length) % allImages.length;
      setCurrentIndex(newIndex);
      setIsZoomedIn(false);
      expandedImageSrc = allImages[newIndex].src;
      expandedImageListeners.forEach(listener => listener());
    } else if (e.key === 'ArrowRight' && hasMultipleImages) {
      e.preventDefault();
      const newIndex = (currentIndex + 1) % allImages.length;
      setCurrentIndex(newIndex);
      setIsZoomedIn(false);
      expandedImageSrc = allImages[newIndex].src;
      expandedImageListeners.forEach(listener => listener());
    }
  };

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = (currentIndex - 1 + allImages.length) % allImages.length;
    setCurrentIndex(newIndex);
    setIsZoomedIn(false);
    expandedImageSrc = allImages[newIndex].src;
    expandedImageListeners.forEach(listener => listener());
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIndex = (currentIndex + 1) % allImages.length;
    setCurrentIndex(newIndex);
    setIsZoomedIn(false);
    expandedImageSrc = allImages[newIndex].src;
    expandedImageListeners.forEach(listener => listener());
  };

  return (
    <>
      <img 
        src={src} 
        alt={alt} 
        className={className}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
      />
      
      {isExpanded && createPortal(
        <div 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: '320px',
            bottom: 0,
            backgroundColor: 'rgba(16, 21, 31, 0.9)',
            backdropFilter: 'blur(8px)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={handleBackdropClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image view"
        >
          <button
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              color: 'white',
              fontSize: '2rem',
              zIndex: 10,
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => {
              setIsExpanded(false);
              setIsZoomedIn(false);
              expandedImageSrc = null;
              expandedImageListeners.forEach(listener => listener());
            }}
            aria-label="Close expanded view"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
          >
            ×
          </button>
          
          {hasMultipleImages && (
            <>
              <button
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'white',
                  fontSize: '2.5rem',
                  zIndex: 10,
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={goToPrevious}
                aria-label="Previous image"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)'}
              >
                ‹
              </button>
              <button
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'white',
                  fontSize: '2.5rem',
                  zIndex: 10,
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={goToNext}
                aria-label="Next image"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)'}
              >
                ›
              </button>
            </>
          )}
          
          <img 
            src={allImages[currentIndex].src} 
            alt={allImages[currentIndex].alt} 
            style={{
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              ...(isZoomedIn 
                ? { width: 'auto', height: 'auto', maxWidth: 'none', maxHeight: 'none', transform: 'scale(1)' }
                : { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
              )
            }}
            onClick={() => setIsZoomedIn(!isZoomedIn)}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default ImageViewer;