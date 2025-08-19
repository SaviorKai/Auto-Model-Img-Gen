import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const scrollDelta = useRef(0);
  const thumbnailSidebarRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  const scrollAnimation = useRef<number | null>(null);
  
  // Custom smooth scroll with Mac-like easing
  const smoothScrollTo = useCallback((element: HTMLElement, targetTop: number) => {
    const startTop = element.scrollTop;
    const distance = targetTop - startTop;
    const duration = 120; // Fast but smooth - 120ms like Mac trackpad
    let startTime: number | null = null;
    
    // Cancel any existing animation
    if (scrollAnimation.current) {
      cancelAnimationFrame(scrollAnimation.current);
    }
    
    const easeOutQuart = (t: number): number => {
      return 1 - Math.pow(1 - t, 4); // Mac-like easing curve
    };
    
    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      
      element.scrollTop = startTop + distance * easedProgress;
      
      if (progress < 1) {
        scrollAnimation.current = requestAnimationFrame(animate);
      } else {
        scrollAnimation.current = null;
      }
    };
    
    scrollAnimation.current = requestAnimationFrame(animate);
  }, []);
  
  useEffect(() => {
    if (images.length > 0) {
      const index = images.findIndex(img => img.src === src);
      setCurrentIndex(index >= 0 ? index : 0);
    }
  }, [src, images]);

  // Auto-scroll thumbnail sidebar to keep current image centered
  useEffect(() => {
    if (!isExpanded || !hasMultipleImages || !thumbnailSidebarRef.current) return;

    const sidebar = thumbnailSidebarRef.current;
    const thumbnailHeight = 136; // 128px (actual thumbnail) + 8px gap  
    const headerHeight = 56; // Header with counter + margin
    
    // Calculate position to center the current thumbnail in viewport
    const thumbnailCenter = headerHeight + (currentIndex * thumbnailHeight) + (thumbnailHeight / 2);
    const sidebarViewportCenter = sidebar.clientHeight / 2;
    const targetScrollTop = Math.max(0, thumbnailCenter - sidebarViewportCenter);
    
    // Use custom smooth scroll for Mac-like feel
    smoothScrollTo(sidebar, targetScrollTop);
  }, [currentIndex, isExpanded, hasMultipleImages, smoothScrollTo]);

  const closeExpanded = useCallback(() => {
    setIsExpanded(false);
    setIsZoomedIn(false);
  }, []);

  const navigateToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsZoomedIn(false);
    }
  }, [currentIndex]);

  const navigateToNext = useCallback(() => {
    if (currentIndex < allImages.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsZoomedIn(false);
    }
  }, [currentIndex, allImages.length]);

  // Close expanded view when pressing Escape key and handle scroll navigation
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

    const handleWheel = (e: WheelEvent) => {
      if (!hasMultipleImages) return;
      
      e.preventDefault();
      
      const now = Date.now();
      const timeSinceLastScroll = now - lastScrollTime.current;
      
      // Light throttle to prevent too-rapid navigation while keeping responsiveness
      if (timeSinceLastScroll < 50) return;
      
      // Accumulate scroll delta to match natural scroll feel
      scrollDelta.current += e.deltaY;
      
      // Trigger navigation when accumulated scroll reaches threshold
      const threshold = 100; // Adjust this to control sensitivity
      
      if (Math.abs(scrollDelta.current) >= threshold) {
        lastScrollTime.current = now;
        
        if (scrollDelta.current > 0) {
          navigateToNext();
        } else {
          navigateToPrevious();
        }
        // Reset delta after navigation
        scrollDelta.current = 0;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isExpanded, hasMultipleImages, navigateToNext, navigateToPrevious, closeExpanded]);
  
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

  const jumpToImage = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsZoomedIn(false);
  }, []);

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
            right: 0,
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
          {/* Main Image Area */}
          <div 
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              marginRight: hasMultipleImages ? '160px' : '0'
            }}
          >
            <button
              style={{
                position: 'absolute',
                top: '16px',
                right: hasMultipleImages ? '176px' : '16px',
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
                    zIndex: 1001,
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={goToPrevious}
                  aria-label="Previous image"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
                >
                  ‹
                </button>
                <button
                  style={{
                    position: 'absolute',
                    right: '176px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'white',
                    fontSize: '2.5rem',
                    zIndex: 1001,
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={goToNext}
                  aria-label="Next image"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'}
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
          </div>

          {/* Thumbnail Sidebar */}
          {hasMultipleImages && (
            <div
              ref={thumbnailSidebarRef}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '160px',
                height: '100%',
                background: 'rgba(16, 21, 31, 0.98)',
                borderLeft: '1px solid rgba(40, 44, 66, 0.5)',
                overflowY: 'auto',
                padding: '16px',
                zIndex: 1000
              }}
            >
              <div
                style={{
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}
              >
                {currentIndex + 1} of {allImages.length}
              </div>
              
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {allImages.map((image, index) => (
                  <div
                    key={index}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: currentIndex === index 
                        ? '3px solid #C66BD5' 
                        : '2px solid transparent',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Smoother easing
                      opacity: currentIndex === index ? 1 : 0.7,
                      width: '100%',
                      transform: currentIndex === index ? 'scale(1.05)' : 'scale(1)', // Slight scale for active
                      boxShadow: currentIndex === index 
                        ? '0 8px 25px rgba(198, 107, 213, 0.3)' 
                        : '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                    onClick={() => jumpToImage(index)}
                    onMouseEnter={(e) => {
                      if (currentIndex !== index) {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentIndex !== index) {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default ImageViewer;