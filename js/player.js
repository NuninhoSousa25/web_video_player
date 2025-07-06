// js/player.js - Updated to use Unified Effects System
const Player = (function() {
    
    let mainVideoContainer, videoFullscreenBtn, fullscreenControlsOverlay;
    let fullscreenManager;
    let currentModeGetter = () => 'videoPlayer';
    let pointCloudModuleRef;
    
    // Sub-modules
    let core, effects, transforms, controls, unifiedEffects;
    
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
        
        // Initialize sub-modules in correct order
        core = PlayerCore;
        unifiedEffects = UnifiedVideoEffects; // Initialize unified effects first
        effects = PlayerEffects;
        transforms = PlayerTransforms;
        controls = PlayerControls;
        
        // Initialize in correct dependency order
        core.init(modeGetter, pcModule);
        unifiedEffects.init(core); // Initialize unified effects with core
        effects.init(core, null); // No longer need legacy artistic effects
        transforms.init(core, mainVideoContainer, modeGetter, pcModule);
        controls.init(core);
        
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
        
        // All visual effects go through the unified system now
        if (effectDetails.isFilter || effectDetails.target === 'artistic') {
            if (unifiedEffects) {
                unifiedEffects.setEffect(effectId, value);
            }
        } else {
            // Non-visual effects (volume, playback rate) still go through effects module
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
        // Unified effects reset is handled by effects module
    }
    
    function getDOM() {
        return controls.getDOM();
    }
    
    function isFilterApplied(effectId) {
        const effectDetails = getEffectById(effectId);
        if (effectDetails && (effectDetails.isFilter || effectDetails.target === 'artistic')) {
            return unifiedEffects ? unifiedEffects.isEffectActive(effectId) : false;
        }
        return effects.isFilterApplied(effectId);
    }
    
    function isEffectActive(effectId) {
        const effectDetails = getEffectById(effectId);
        if (effectDetails && (effectDetails.isFilter || effectDetails.target === 'artistic')) {
            return unifiedEffects ? unifiedEffects.isEffectActive(effectId) : false;
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
        
        if (unifiedEffects && unifiedEffects.stopProcessing) {
            unifiedEffects.stopProcessing();
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
