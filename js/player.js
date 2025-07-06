// js/player.js - Refactored Player Module
const Player = (function() {
    
    let mainVideoContainer, videoFullscreenBtn, fullscreenControlsOverlay;
    let fullscreenManager;
    let currentModeGetter = () => 'videoPlayer';
    let pointCloudModuleRef;
    
    // Sub-modules
    let core, effects, transforms, controls, artisticEffects;
    
    // Fullscreen controls management
    let fsControlsTimeout;
    let lastVideoTap = 0;
    
    const ELEMENT_IDS = {
        mainVideoContainer: 'mainVideoContainer',
        videoFullscreenBtn: 'videoFullscreenBtn',
        fullscreenControlsOverlay: 'fullscreenControlsOverlay'
    };
    
    function cacheDOMElements() {
        const elements = DOMUtils.cacheElementsWithMapping(ELEMENT_IDS);
        mainVideoContainer = elements.mainVideoContainer;
        videoFullscreenBtn = elements.videoFullscreenBtn;
        fullscreenControlsOverlay = elements.fullscreenControlsOverlay;
    }
    
    function showFullscreenControls() {
        if (!mainVideoContainer.classList.contains('fullscreen')) return;
        
        clearTimeout(fsControlsTimeout);
        fullscreenControlsOverlay.classList.add('active');
        
        fsControlsTimeout = setTimeout(() => {
            fullscreenControlsOverlay.classList.remove('active');
        }, 3000);
    }
    
    function setupFullscreenManager() {
        fullscreenManager = FullscreenUtils.createFullscreenManager(mainVideoContainer, {
            onEnter: () => {
                core.requestWakeLock();
                transforms.onFullscreenChange(true);
                showFullscreenControls();
            },
            onExit: () => {
                core.releaseWakeLock();
                transforms.onFullscreenChange(false);
            },
            onError: (error) => {
                console.error("Fullscreen error:", error);
            }
        });
    }
    
    function setupDoubleClickFullscreen() {
        const videoElement = core.getVideoElement();
        
        FullscreenUtils.addDoubleTabFullscreenHandler(
            videoElement,
            () => {
                if (currentModeGetter() === 'videoPlayer') {
                    fullscreenManager.toggle();
                }
            }
        );
    }
    
    function setupFullscreenControlsInteraction() {
        const interactionEvents = ['click', 'mousemove', 'touchstart'];
        
        interactionEvents.forEach(eventType => {
            mainVideoContainer.addEventListener(eventType, (e) => {
                if (mainVideoContainer.classList.contains('fullscreen')) {
                    showFullscreenControls();
                }
            });
        });
    }
    
    function setupEventListeners() {
        // Fullscreen button
        if (videoFullscreenBtn) {
            videoFullscreenBtn.addEventListener('click', () => {
                fullscreenManager.toggle();
            });
        }
        
        setupFullscreenControlsInteraction();
        setupDoubleClickFullscreen();
    }
    
    function init(modeGetter, pcModule) {
        currentModeGetter = modeGetter;
        pointCloudModuleRef = pcModule;
        
        cacheDOMElements();
        
        // Initialize sub-modules
        core = PlayerCore;
        effects = PlayerEffects;
        transforms = PlayerTransforms;
        controls = PlayerControls;
        artisticEffects = SimpleArtisticEffects; // Add the new artistic effects
        
        core.init(modeGetter, pcModule);
        effects.init(core);
        transforms.init(core, mainVideoContainer, modeGetter, pcModule);
        controls.init(core);
        artisticEffects.init(core); // Initialize artistic effects
        
        setupFullscreenManager();
        setupEventListeners();
    }
    
    function handleModeChange(newMode) {
        controls.handleModeChange(newMode);
    }
    
    // Public API - delegate to appropriate sub-modules
    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails) return;
        
        if (effectDetails.target === 'artistic') {
            artisticEffects.setEffect(effectId, value);
        } else {
            effects.setEffect(effectId, value);
        }
    }
    
    function getVideoElement() {
        return core.getVideoElement();
    }
    
    function getMainVideoContainer() {
        return mainVideoContainer;
    }
    
    function enterVideoFullscreenMode() {
        return fullscreenManager.enter();
    }
    
    function exitVideoFullscreenMode() {
        return fullscreenManager.exit();
    }
    
    function resetFilters() {
        effects.resetAllFilters();
        // Reset artistic effects too
        if (artisticEffects) {
            ['pixelSort', 'digitalGlitch', 'chromaShift', 'kaleidoscope', 'colorQuantize', 'noiseOverlay'].forEach(effectId => {
                artisticEffects.setEffect(effectId, 0);
            });
        }
    }
    
    function getDOM() {
        return controls.getDOM();
    }
    
    function isFilterApplied(effectId) {
        const effectDetails = getEffectById(effectId);
        if (effectDetails && effectDetails.target === 'artistic') {
            return artisticEffects.isEffectActive(effectId);
        }
        return effects.isFilterApplied(effectId);
    }
    
    function isEffectActive(effectId) {
        const effectDetails = getEffectById(effectId);
        if (effectDetails && effectDetails.target === 'artistic') {
            return artisticEffects.isEffectActive(effectId);
        }
        return effects.isEffectActive(effectId);
    }
    
    // Transform methods
    function rotateVideo() {
        transforms.rotateVideo();
    }
    
    function toggleFitToScreen() {
        transforms.toggleFitToScreen();
    }
    
    function resetVideoTransform() {
        transforms.resetTransforms();
    }
    
    function getCurrentRotation() {
        return transforms.getCurrentRotation();
    }
    
    function isFitToScreen() {
        return transforms.isFitToScreen();
    }
    
    function destroy() {
        if (fullscreenManager) {
            fullscreenManager.destroy();
        }
        
        if (core) {
            core.destroy();
        }
    }
    
    return {
        init,
        destroy,
        handleModeChange,
        
        // Core player methods
        setEffect,
        getVideoElement,
        getMainVideoContainer,
        getDOM,
        
        // Fullscreen methods
        enterVideoFullscreenMode,
        exitVideoFullscreenMode,
        
        // Effect methods
        resetFilters,
        isFilterApplied,
        isEffectActive,
        
        // Transform methods
        rotateVideo,
        toggleFitToScreen,
        resetVideoTransform,
        getCurrentRotation,
        isFitToScreen
    };
})();
