// js/player/transforms.js - Enhanced rotation and fit functionality
const PlayerTransforms = (function() {
    
    let videoPlayer, mainVideoContainer;
    let rotateBtn, fitToScreenBtn, autoRotateBtn;
    
    // Transform state
    let currentRotation = 0; // 0, 90, 180, 270 degrees
    let fitToScreen = false;
    let autoRotate = false;
    let originalVideoSize = { width: 0, height: 0 };
    let containerSize = { width: 0, height: 0 };
    
    const ELEMENT_IDS = {
        rotateBtn: 'rotateBtn',
        fitToScreenBtn: 'fitToScreenBtn',
        autoRotateBtn: 'autoRotateBtn' // New button for auto-rotate
    };
    
    function cacheDOMElements() {
        const elements = DOMUtils.cacheElementsWithMapping(ELEMENT_IDS);
        rotateBtn = elements.rotateBtn;
        fitToScreenBtn = elements.fitToScreenBtn;
        autoRotateBtn = elements.autoRotateBtn;
    }
    
    function getContainerDimensions() {
        if (mainVideoContainer.classList.contains('fullscreen')) {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        } else {
            return {
                width: mainVideoContainer.clientWidth || 500,
                height: mainVideoContainer.clientHeight || 300
            };
        }
    }
    
    function getVideoAspectRatio() {
        if (!originalVideoSize.width || !originalVideoSize.height) return 16/9; // fallback
        return originalVideoSize.width / originalVideoSize.height;
    }
    
    function getContainerAspectRatio() {
        const container = getContainerDimensions();
        return container.width / container.height;
    }
    
    function shouldAutoRotateForBetterFit() {
        if (!autoRotate || !originalVideoSize.width) return false;
        
        const videoAspect = getVideoAspectRatio();
        const containerAspect = getContainerAspectRatio();
        
        // If video is landscape (wide) and container is portrait (tall)
        const videoIsLandscape = videoAspect > 1;
        const containerIsPortrait = containerAspect < 1;
        
        // Auto-rotate if video is landscape and container is portrait
        return videoIsLandscape && containerIsPortrait;
    }
    
    function calculateOptimalRotation() {
        if (!autoRotate) return currentRotation;
        
        const videoAspect = getVideoAspectRatio();
        const containerAspect = getContainerAspectRatio();
        
        // If video is much wider than container is tall, rotate 90 degrees
        if (videoAspect > 1.5 && containerAspect < 0.8) {
            return 90;
        }
        
        // If video is very wide and container is very tall, might need 270
        if (videoAspect > 2 && containerAspect < 0.6) {
            return 270;
        }
        
        return 0; // Default to no rotation
    }
    
    function calculateVideoTransform() {
        let transform = '';
        const container = getContainerDimensions();
        
        // Determine effective rotation (manual or auto)
        let effectiveRotation = currentRotation;
        if (autoRotate) {
            effectiveRotation = calculateOptimalRotation();
        }
        
        // Apply rotation
        if (effectiveRotation !== 0) {
            transform += `rotate(${effectiveRotation}deg) `;
        }
        
        // Calculate scaling for fit to screen
        if (fitToScreen && originalVideoSize.width > 0 && originalVideoSize.height > 0) {
            let videoWidth = originalVideoSize.width;
            let videoHeight = originalVideoSize.height;
            
            // For 90° and 270° rotations, swap width and height for calculations
            if (effectiveRotation === 90 || effectiveRotation === 270) {
                [videoWidth, videoHeight] = [videoHeight, videoWidth];
            }
            
            // Calculate scale to fit within container while maintaining aspect ratio
            const scaleX = container.width / videoWidth;
            const scaleY = container.height / videoHeight;
            const scale = Math.min(scaleX, scaleY);
            
            // Apply additional scaling for better utilization of screen space
            let finalScale = scale;
            
            // If auto-rotating, be more aggressive with scaling
            if (autoRotate && effectiveRotation !== 0) {
                // Allow slight crop for better screen utilization (up to 10% crop)
                const maxScale = Math.max(scaleX, scaleY);
                const cropScale = Math.min(maxScale, scale * 1.1);
                finalScale = cropScale;
            }
            
            if (finalScale !== 1) {
                transform += `scale(${finalScale.toFixed(3)}) `;
            }
        }
        
        return transform.trim();
    }
    
    function applyVideoTransform() {
        if (!videoPlayer) return;
        
        const transform = calculateVideoTransform();
        videoPlayer.style.transform = transform;
        videoPlayer.style.transformOrigin = 'center center';
        
        updateVideoDimensions();
        updateButtonStates();
    }
    
    function updateVideoDimensions() {
        if (!videoPlayer || !originalVideoSize.width) return;
        
        const container = getContainerDimensions();
        let effectiveRotation = currentRotation;
        
        if (autoRotate) {
            effectiveRotation = calculateOptimalRotation();
        }
        
        let videoWidth = originalVideoSize.width;
        let videoHeight = originalVideoSize.height;
        
        // For 90° and 270° rotations, swap dimensions
        if (effectiveRotation === 90 || effectiveRotation === 270) {
            [videoWidth, videoHeight] = [videoHeight, videoWidth];
        }
        
        if (fitToScreen) {
            // Let CSS handle the dimensions with object-fit behavior
            if (mainVideoContainer.classList.contains('fullscreen')) {
                videoPlayer.style.width = '100vw';
                videoPlayer.style.height = '100vh';
                videoPlayer.style.objectFit = 'contain';
            } else {
                videoPlayer.style.width = '100%';
                videoPlayer.style.height = '100%';
                videoPlayer.style.objectFit = 'contain';
            }
        } else {
            // Use calculated dimensions based on container
            const aspectRatio = videoWidth / videoHeight;
            
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
                // Fit within container while maintaining aspect ratio
                if (aspectRatio > (container.width / container.height)) {
                    videoPlayer.style.width = `${Math.min(container.width, videoWidth)}px`;
                    videoPlayer.style.height = 'auto';
                } else {
                    videoPlayer.style.width = 'auto';
                    videoPlayer.style.height = `${Math.min(container.height, videoHeight)}px`;
                }
            }
            videoPlayer.style.objectFit = 'contain';
        }
    }
    
    function rotateVideo() {
        // Cycle through rotations: 0° → 90° → 180° → 270° → 0°
        currentRotation = (currentRotation + 90) % 360;
        
        // Disable auto-rotate when manually rotating
        if (autoRotate) {
            autoRotate = false;
            updateAutoRotateButtonText();
        }
        
        applyVideoTransform();
        updateRotateButtonText();
        
        // Save rotation preference
        localStorage.setItem('videoPlayerRotation', currentRotation.toString());
        localStorage.setItem('videoPlayerAutoRotate', autoRotate.toString());
        
        // Dispatch event for other modules
        document.dispatchEvent(new CustomEvent('video:rotated', {
            detail: { rotation: currentRotation, autoRotate }
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
    
    function toggleAutoRotate() {
        autoRotate = !autoRotate;
        
        if (autoRotate) {
            // Reset manual rotation when enabling auto-rotate
            currentRotation = 0;
            updateRotateButtonText();
            
            // Enable fit to screen for better auto-rotate experience
            if (!fitToScreen) {
                fitToScreen = true;
                updateFitToScreenButtonText();
            }
        }
        
        applyVideoTransform();
        updateAutoRotateButtonText();
        
        // Save preferences
        localStorage.setItem('videoPlayerAutoRotate', autoRotate.toString());
        localStorage.setItem('videoPlayerRotation', currentRotation.toString());
        localStorage.setItem('videoPlayerFitToScreen', fitToScreen.toString());
        
        // Dispatch event for other modules
        document.dispatchEvent(new CustomEvent('video:autoRotateToggled', {
            detail: { autoRotate, fitToScreen }
        }));
    }
    
    function updateRotateButtonText() {
        if (rotateBtn) {
            if (autoRotate) {
                const optimalRotation = calculateOptimalRotation();
                rotateBtn.textContent = `Auto: ${optimalRotation}°`;
                rotateBtn.style.opacity = '0.6'; // Indicate it's overridden
            } else {
                const rotationText = currentRotation === 0 ? '0°' : `${currentRotation}°`;
                rotateBtn.textContent = `Rotate: ${rotationText}`;
                rotateBtn.style.opacity = '1';
            }
        }
    }
    
    function updateFitToScreenButtonText() {
        if (fitToScreenBtn) {
            fitToScreenBtn.textContent = fitToScreen ? 'Fit: ON' : 'Fit: OFF';
        }
    }
    
    function updateAutoRotateButtonText() {
        if (autoRotateBtn) {
            autoRotateBtn.textContent = autoRotate ? 'Auto-Rotate: ON' : 'Auto-Rotate: OFF';
            autoRotateBtn.style.backgroundColor = autoRotate ? '#4caf50' : '#2c7be5';
        }
    }
    
    function updateButtonStates() {
        updateRotateButtonText();
        updateFitToScreenButtonText();
        updateAutoRotateButtonText();
    }
    
    function resetTransforms() {
        currentRotation = 0;
        fitToScreen = false;
        autoRotate = false;
        applyVideoTransform();
        updateButtonStates();
        
        localStorage.removeItem('videoPlayerRotation');
        localStorage.removeItem('videoPlayerFitToScreen');
        localStorage.removeItem('videoPlayerAutoRotate');
        
        document.dispatchEvent(new CustomEvent('video:transformsReset'));
    }
    
    function loadTransformSettings() {
        const savedRotation = localStorage.getItem('videoPlayerRotation');
        const savedFitToScreen = localStorage.getItem('videoPlayerFitToScreen');
        const savedAutoRotate = localStorage.getItem('videoPlayerAutoRotate');
        
        if (savedRotation) {
            currentRotation = parseInt(savedRotation) || 0;
        }
        
        if (savedFitToScreen) {
            fitToScreen = savedFitToScreen === 'true';
        }
        
        if (savedAutoRotate) {
            autoRotate = savedAutoRotate === 'true';
        }
        
        updateButtonStates();
    }
    
    function handleVideoMetadataLoaded(event) {
        const { videoWidth, videoHeight } = event.detail;
        
        // Store original video dimensions
        originalVideoSize.width = videoWidth;
        originalVideoSize.height = videoHeight;
        
        // Update container size
        containerSize = getContainerDimensions();
        
        // Apply initial transform after a brief delay
        setTimeout(() => {
            applyVideoTransform();
            
            // Show recommendation for auto-rotate if beneficial
            if (!autoRotate && shouldAutoRotateForBetterFit()) {
                showAutoRotateRecommendation();
            }
        }, 100);
    }
    
    function handleVideoLoaded() {
        // Don't reset on new video load, maintain user preferences
        applyVideoTransform();
    }
    
    function showAutoRotateRecommendation() {
        // Create a temporary notification suggesting auto-rotate
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(44, 123, 229, 0.9);
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
            max-width: 250px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.innerHTML = `
            📱 This video might look better with auto-rotate enabled!
            <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">Click to enable</div>
        `;
        
        notification.addEventListener('click', () => {
            toggleAutoRotate();
            document.body.removeChild(notification);
        });
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 5000);
    }
    
    function setupEventListeners() {
        // Button click handlers
        if (rotateBtn) {
            rotateBtn.addEventListener('click', rotateVideo);
        }
        
        if (fitToScreenBtn) {
            fitToScreenBtn.addEventListener('click', toggleFitToScreen);
        }
        
        if (autoRotateBtn) {
            autoRotateBtn.addEventListener('click', toggleAutoRotate);
        }
        
        // Window resize handler - important for auto-rotate
        window.addEventListener('resize', () => {
            if (videoPlayer && videoPlayer.src) {
                containerSize = getContainerDimensions();
                setTimeout(() => {
                    applyVideoTransform();
                }, 100);
            }
        });
        
        // Orientation change for mobile devices
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                containerSize = getContainerDimensions();
                applyVideoTransform();
            }, 200); // Give time for orientation change to complete
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
        // Update container size and reapply transforms when fullscreen state changes
        setTimeout(() => {
            containerSize = getContainerDimensions();
            applyVideoTransform();
        }, 50);
    }
    
    // Smart rotation based on content analysis
    function analyzeVideoAndSuggestRotation() {
        if (!originalVideoSize.width || !originalVideoSize.height) return null;
        
        const videoAspect = getVideoAspectRatio();
        const containerAspect = getContainerAspectRatio();
        
        const suggestions = [];
        
        // Very wide video on tall screen
        if (videoAspect > 2 && containerAspect < 0.8) {
            suggestions.push({
                rotation: 90,
                reason: 'Very wide video on tall screen - 90° rotation recommended',
                confidence: 0.9
            });
        }
        
        // Moderately wide video on portrait screen
        if (videoAspect > 1.5 && containerAspect < 0.7) {
            suggestions.push({
                rotation: 90,
                reason: 'Wide video on portrait screen - rotation may improve viewing',
                confidence: 0.7
            });
        }
        
        return suggestions.length > 0 ? suggestions[0] : null;
    }
    
    return {
        init,
        rotateVideo,
        toggleFitToScreen,
        toggleAutoRotate,
        resetTransforms,
        applyVideoTransform,
        onFullscreenChange,
        analyzeVideoAndSuggestRotation,
        
        // Getters
        getCurrentRotation: () => currentRotation,
        getEffectiveRotation: () => autoRotate ? calculateOptimalRotation() : currentRotation,
        isFitToScreen: () => fitToScreen,
        isAutoRotate: () => autoRotate,
        getOriginalSize: () => ({ ...originalVideoSize }),
        shouldAutoRotateForBetterFit
    };
})();
