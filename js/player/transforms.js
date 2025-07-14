// js/player/transforms.js - Point cloud references removed
const PlayerTransforms = (function() {
    
    let videoPlayer, mainVideoContainer;
    let rotateBtn, fitToScreenBtn;
    
    // Transform state
    let currentRotation = 0; // 0, 90, 180, 270 degrees
    let fitToScreen = false;
    let originalVideoSize = { width: 0, height: 0 };
    
    const ELEMENT_IDS = {
        rotateBtn: 'rotateBtn',
        fitToScreenBtn: 'fitToScreenBtn'
    };
    
    function cacheDOMElements() {
        const elements = DOMUtils.cacheElementsWithMapping(ELEMENT_IDS);
        rotateBtn = elements.rotateBtn;
        fitToScreenBtn = elements.fitToScreenBtn;
    }
    
    function calculateVideoTransform() {
        let transform = '';
        let containerWidth = mainVideoContainer.clientWidth;
        let containerHeight = mainVideoContainer.clientHeight;
        
        // In fullscreen, use window dimensions
        if (mainVideoContainer.classList.contains('fullscreen')) {
            containerWidth = window.innerWidth;
            containerHeight = window.innerHeight;
        }
        
        // Apply rotation
        if (currentRotation !== 0) {
            transform += `rotate(${currentRotation}deg) `;
        }
        
        // Apply scaling if fit to screen is enabled
        if (fitToScreen && originalVideoSize.width > 0 && originalVideoSize.height > 0) {
            let videoWidth = originalVideoSize.width;
            let videoHeight = originalVideoSize.height;
            
            // For 90° and 270° rotations, swap width and height for calculations
            if (currentRotation === 90 || currentRotation === 270) {
                [videoWidth, videoHeight] = [videoHeight, videoWidth];
            }
            
            const scaleX = containerWidth / videoWidth;
            const scaleY = containerHeight / videoHeight;
            const scale = Math.min(scaleX, scaleY);
            
            if (scale !== 1) {
                transform += `scale(${scale}) `;
            }
        }
        
        return transform.trim();
    }
    
    function applyVideoTransform() {
        if (!videoPlayer) return;
        
        const transform = calculateVideoTransform();
        videoPlayer.style.transform = transform;
        videoPlayer.style.transformOrigin = 'center center';
        
        updateContainerDimensions();
    }
    
    function updateContainerDimensions() {
        if (!videoPlayer || !originalVideoSize.width) return;
        
        let videoWidth = originalVideoSize.width;
        let videoHeight = originalVideoSize.height;
        
        // For 90° and 270° rotations, swap dimensions
        if (currentRotation === 90 || currentRotation === 270) {
            [videoWidth, videoHeight] = [videoHeight, videoWidth];
        }
        
        if (fitToScreen) {
            // When fit to screen, let the container fill available space
            if (mainVideoContainer.classList.contains('fullscreen')) {
                videoPlayer.style.width = '100vw';
                videoPlayer.style.height = '100vh';
            } else {
                videoPlayer.style.width = '100%';
                videoPlayer.style.height = 'auto';
            }
        } else {
            // Use natural dimensions (affected by rotation)
            const aspectRatio = videoWidth / videoHeight;
            const containerWidth = mainVideoContainer.clientWidth || 500;
            
            if (mainVideoContainer.classList.contains('fullscreen')) {
                const windowAspectRatio = window.innerWidth / window.innerHeight;
                if (aspectRatio > windowAspectRatio) {
                    videoPlayer.style.width = '100vw';
                    videoPlayer.style.height = 'auto';
                } else {
                    videoPlayer.style.width = 'auto';
                    videoPlayer.style.height = '100vh';
                }
            } else {
                videoPlayer.style.width = `${Math.min(containerWidth, videoWidth)}px`;
                videoPlayer.style.height = 'auto';
            }
        }
    }
    
    function rotateVideo() {
        currentRotation = (currentRotation + 90) % 360;
        applyVideoTransform();
        updateRotateButtonText();
        
        // Save rotation preference
        localStorage.setItem('videoPlayerRotation', currentRotation.toString());
        
        // Dispatch event for other modules
        document.dispatchEvent(new CustomEvent('video:rotated', {
            detail: { rotation: currentRotation }
        }));
    }
    
    function toggleFitToScreen() {
        fitToScreen = !fitToScreen;
        applyVideoTransform();
        updateFitToScreenButtonText();
        
        // Save fit preference
        localStorage.setItem('videoPlayerFitToScreen', fitToScreen.toString());
        
        // Dispatch event for other modules
        document.dispatchEvent(new CustomEvent('video:fitToggled', {
            detail: { fitToScreen }
        }));
    }
    
    function updateRotateButtonText() {
        if (rotateBtn) {
            const rotationText = currentRotation === 0 ? '0°' : `${currentRotation}°`;
            rotateBtn.textContent = `Rotate: ${rotationText}`;
        }
    }
    
    function updateFitToScreenButtonText() {
        if (fitToScreenBtn) {
            fitToScreenBtn.textContent = fitToScreen ? 'Fit: ON' : 'Fit: OFF';
        }
    }
    
    function resetTransforms() {
        currentRotation = 0;
        fitToScreen = false;
        applyVideoTransform();
        updateRotateButtonText();
        updateFitToScreenButtonText();
        localStorage.removeItem('videoPlayerRotation');
        localStorage.removeItem('videoPlayerFitToScreen');
        
        document.dispatchEvent(new CustomEvent('video:transformsReset'));
    }
    
    function loadTransformSettings() {
        const savedRotation = localStorage.getItem('videoPlayerRotation');
        const savedFitToScreen = localStorage.getItem('videoPlayerFitToScreen');
        
        if (savedRotation) {
            currentRotation = parseInt(savedRotation) || 0;
        }
        
        if (savedFitToScreen) {
            fitToScreen = savedFitToScreen === 'true';
        }
        
        updateRotateButtonText();
        updateFitToScreenButtonText();
    }
    
    function handleVideoMetadataLoaded(event) {
        const { videoWidth, videoHeight } = event.detail;
        
        // Store original video dimensions
        originalVideoSize.width = videoWidth;
        originalVideoSize.height = videoHeight;
        
        // Apply initial transform after a brief delay
        setTimeout(() => {
            applyVideoTransform();
        }, 100);
    }
    
    function handleVideoLoaded() {
        // Reset rotation and fit when loading new video
        resetTransforms();
    }
    
    function setupEventListeners() {
        // Button click handlers
        if (rotateBtn) {
            rotateBtn.addEventListener('click', rotateVideo);
        }
        
        if (fitToScreenBtn) {
            fitToScreenBtn.addEventListener('click', toggleFitToScreen);
        }
        
        // Window resize handler
        window.addEventListener('resize', () => {
            if (videoPlayer && videoPlayer.src) {
                setTimeout(() => {
                    applyVideoTransform();
                }, 100);
            }
        });
        
        // Listen for video events
        document.addEventListener('video:metadataLoaded', handleVideoMetadataLoaded);
        document.addEventListener('video:loaded', handleVideoLoaded);
    }
    
    function init(playerCore, container) {
        videoPlayer = playerCore.getVideoElement();
        mainVideoContainer = container;
        
        cacheDOMElements();
        setupEventListeners();
        loadTransformSettings();
    }
    
    function onFullscreenChange(isFullscreen) {
        // Update dimensions when fullscreen state changes
        setTimeout(() => {
            applyVideoTransform();
        }, 50);
    }
    
    return {
        init,
        rotateVideo,
        toggleFitToScreen,
        resetTransforms,
        applyVideoTransform,
        onFullscreenChange,
        
        // Getters
        getCurrentRotation: () => currentRotation,
        isFitToScreen: () => fitToScreen,
        getOriginalSize: () => ({ ...originalVideoSize })
    };
})();
