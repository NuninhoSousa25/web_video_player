// js/player.js - Point cloud references removed
const Player = (function() {
    
    let mainVideoContainer, videoFullscreenBtn, fullscreenControlsOverlay;
    let fullscreenManager;
    
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
                fullscreenManager.toggle();
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
    
    function init() {
        cacheDOMElements();
        
        // Initialize sub-modules in correct order
        core = PlayerCore;
        unifiedEffects = UnifiedVideoEffects;
        effects = PlayerEffects;
        transforms = PlayerTransforms;
        controls = PlayerControls;
        
        // Initialize in correct dependency order
        core.init();
        unifiedEffects.init(core);
        effects.init(core, null);
        transforms.init(core, mainVideoContainer);
        controls.init(core);
        
        setupFullscreenManager();
        setupEventListeners();
    }
    
    // Public API - properly route all effects
    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails) {
            console.warn(`Effect not found: ${effectId}`);
            return;
        }
        
        console.log(`Player.setEffect: ${effectId} = ${value}, target: ${effectDetails.target}`);
        
        // Route based on effect target
        if (effectDetails.target === 'player') {
            // Standard player effects (filters, volume, playback rate)
            effects.setEffect(effectId, value);
        } else if (effectDetails.target === 'artistic') {
            // Artistic effects go directly to unified system
            if (unifiedEffects) {
                console.log(`Routing artistic effect ${effectId} to unified system`);
                unifiedEffects.setEffect(effectId, value);
                
                // Also update the UI slider if this came from sensor mapping
                const slider = document.getElementById(effectId + 'Slider');
                if (slider && slider.value != value) {
                    slider.value = value;
                    // Trigger display update
                    const event = new Event('input');
                    slider.dispatchEvent(event);
                }
                
                // Update mapping indicators
                if (typeof UI !== 'undefined' && UI.updateActiveMappingIndicators) {
                    UI.updateActiveMappingIndicators();
                }
            }
        } else {
            console.warn(`Unknown effect target: ${effectDetails.target} for effect: ${effectId}`);
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
