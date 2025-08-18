import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
  
  const allImages = images.length > 0 ? images : [{ src, alt }];
  const hasMultipleImages = allImages.length > 1;
  
  useEffect(() => {
    if (images.length > 0) {
      const index = images.findIndex(img => img.src === src);
      setCurrentIndex(index >= 0 ? index : 0);
    }
  }, [src, images]);

  // Close expanded view when pressing Escape key
  useEffect(() => {
    if (!isExpanded) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeExpanded();
      } else if (e.key === 'ArrowLeft' && hasMultipleImages) {
        e.preventDefault();
        navigateToPrevious();
      } else if (e.key === 'ArrowRight' && hasMultipleImages) {
        e.preventDefault();
        navigateToNext();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, hasMultipleImages, currentIndex]);

  const closeExpanded = useCallback(() => {
    setIsExpanded(false);
    setIsZoomedIn(false);
  }, []);

  const navigateToPrevious = useCallback(() => {
    const newIndex = (currentIndex - 1 + allImages.length) % allImages.length;
    setCurrentIndex(newIndex);
    setIsZoomedIn(false);
  }, [currentIndex, allImages.length]);

  const navigateToNext = useCallback(() => {
    const newIndex = (currentIndex + 1) % allImages.length;
    setCurrentIndex(newIndex);
    setIsZoomedIn(false);
  }, [currentIndex, allImages.length]);
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      setIsExpanded(true);
      setIsZoomedIn(false);
    }
  }, [isExpanded]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Only close if clicking directly on the backdrop, not on child elements
    if (e.target === e.currentTarget) {
      closeExpanded();
    }
  }, [closeExpanded]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsZoomedIn(!isZoomedIn);
  }, [isZoomedIn]);

  const goToPrevious = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigateToPrevious();
  }, [navigateToPrevious]);

  const goToNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigateToNext();
  }, [navigateToNext]);

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
            right: sidebarOpen ? '320px' : '0',
            bottom: 0,
            backgroundColor: 'rgba(16, 21, 31, 0.95)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={handleBackdropClick}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image view"
        >
          <button
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              color: 'white',
              fontSize: '2rem',
              zIndex: 1001,
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={closeExpanded}
            aria-label="Close expanded view"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
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
                ? { 
                    width: 'auto', 
                    height: 'auto', 
                    maxWidth: 'none', 
                    maxHeight: 'none', 
                    transform: 'scale(2)', 
                    transformOrigin: 'center'
                  }
                : { 
                    maxWidth: '90%', 
                    maxHeight: '90%', 
                    objectFit: 'contain' 
                  }
              )
            }}
            onClick={handleImageClick}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default ImageViewer;