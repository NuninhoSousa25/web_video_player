// js/player.js - Enhanced fullscreen with auto-hide UI and double-tap
const Player = (function() {
    
    let mainVideoContainer, videoFullscreenBtn, fullscreenControlsOverlay;
    let fullscreenManager;
    
    // Sub-modules
    let core, effects, transforms, controls, unifiedEffects;
    
    // Fullscreen UI management
    let fsControlsTimeout;
    let lastVideoTap = 0;
    let isMouseIdle = false;
    let mouseIdleTimeout;
    let lastMouseMove = 0;
    
    // Configuration
    const FULLSCREEN_CONFIG = {
        UI_HIDE_DELAY: 2000, // 2 seconds
        DOUBLE_TAP_THRESHOLD: 300, // 300ms for double tap
        MOUSE_IDLE_DELAY: 2000, // 2 seconds for mouse idle
        TOUCH_UI_SHOW_DURATION: 3000 // Show UI for 3 seconds on touch
    };
    
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
    
    function showFullscreenControls(duration = FULLSCREEN_CONFIG.UI_HIDE_DELAY) {
        if (!mainVideoContainer.classList.contains('fullscreen')) return;
        
        clearTimeout(fsControlsTimeout);
        fullscreenControlsOverlay.classList.add('active');
        
        // Show cursor
        mainVideoContainer.style.cursor = 'default';
        
        // Auto-hide after specified duration
        fsControlsTimeout = setTimeout(() => {
            hideFullscreenControls();
        }, duration);
    }
    
    function hideFullscreenControls() {
        if (!mainVideoContainer.classList.contains('fullscreen')) return;
        
        fullscreenControlsOverlay.classList.remove('active');
        
        // Hide cursor for immersive experience
        mainVideoContainer.style.cursor = 'none';
    }
    
    function handleFullscreenInteraction(event) {
        if (!mainVideoContainer.classList.contains('fullscreen')) return;
        
        const eventType = event.type;
        
        if (eventType === 'touchstart' || eventType === 'touchend') {
            // Touch interaction - show UI for longer duration
            showFullscreenControls(FULLSCREEN_CONFIG.TOUCH_UI_SHOW_DURATION);
        } else if (eventType === 'mousemove') {
            // Mouse movement - show UI and track idle state
            const now = Date.now();
            lastMouseMove = now;
            
            if (isMouseIdle) {
                isMouseIdle = false;
                showFullscreenControls();
            }
            
            clearTimeout(mouseIdleTimeout);
            mouseIdleTimeout = setTimeout(() => {
                if (Date.now() - lastMouseMove >= FULLSCREEN_CONFIG.MOUSE_IDLE_DELAY) {
                    isMouseIdle = true;
                    hideFullscreenControls();
                }
            }, FULLSCREEN_CONFIG.MOUSE_IDLE_DELAY);
        } else if (eventType === 'click') {
            // Click - toggle UI visibility
            if (fullscreenControlsOverlay.classList.contains('active')) {
                hideFullscreenControls();
            } else {
                showFullscreenControls();
            }
        }
    }
    
    function handleDoubleTagToggleFullscreen(event) {
        const currentTime = Date.now();
        const timeSinceLastTap = currentTime - lastVideoTap;
        
        if (timeSinceLastTap < FULLSCREEN_CONFIG.DOUBLE_TAP_THRESHOLD) {
            // Double tap detected
            event.preventDefault();
            event.stopPropagation();
            
            fullscreenManager.toggle();
            
            // Reset tap timer
            lastVideoTap = 0;
        } else {
            // First tap
            lastVideoTap = currentTime;
        }
    }
    
    function setupFullscreenManager() {
        fullscreenManager = FullscreenUtils.createFullscreenManager(mainVideoContainer, {
            onEnter: () => {
                console.log('Entering fullscreen mode...');
                core.requestWakeLock();
                transforms.onFullscreenChange(true);
                
                // Show controls initially, then auto-hide
                showFullscreenControls();
                
                // Add fullscreen-specific event listeners
                setupFullscreenEventListeners();
                
                // Hide regular UI elements that shouldn't be visible in fullscreen
                document.body.classList.add('fullscreen-active');
            },
            onExit: () => {
                console.log('Exiting fullscreen mode...');
                core.releaseWakeLock();
                transforms.onFullscreenChange(false);
                
                // Clean up fullscreen event listeners
                cleanupFullscreenEventListeners();
                
                // Restore cursor and clear timeouts
                mainVideoContainer.style.cursor = 'default';
                clearTimeout(fsControlsTimeout);
                clearTimeout(mouseIdleTimeout);
                
                // Show regular UI elements
                document.body.classList.remove('fullscreen-active');
                
                isMouseIdle = false;
            },
            onError: (error) => {
                console.error("Fullscreen error:", error);
            }
        });
    }
    
    function setupFullscreenEventListeners() {
        // Mouse interactions
        mainVideoContainer.addEventListener('mousemove', handleFullscreenInteraction, { passive: true });
        mainVideoContainer.addEventListener('click', handleFullscreenInteraction);
        
        // Touch interactions  
        mainVideoContainer.addEventListener('touchstart', handleFullscreenInteraction, { passive: true });
        mainVideoContainer.addEventListener('touchend', handleFullscreenInteraction, { passive: true });
        
        // Keyboard interaction
        document.addEventListener('keydown', handleFullscreenKeydown);
        
        // Prevent context menu in fullscreen for better UX
        mainVideoContainer.addEventListener('contextmenu', preventContextMenu);
    }
    
    function cleanupFullscreenEventListeners() {
        mainVideoContainer.removeEventListener('mousemove', handleFullscreenInteraction);
        mainVideoContainer.removeEventListener('click', handleFullscreenInteraction);
        mainVideoContainer.removeEventListener('touchstart', handleFullscreenInteraction);
        mainVideoContainer.removeEventListener('touchend', handleFullscreenInteraction);
        document.removeEventListener('keydown', handleFullscreenKeydown);
        mainVideoContainer.removeEventListener('contextmenu', preventContextMenu);
    }
    
    function handleFullscreenKeydown(event) {
        if (!mainVideoContainer.classList.contains('fullscreen')) return;
        
        switch (event.key) {
            case 'Escape':
                // Let browser handle escape to exit fullscreen
                break;
            case ' ':
            case 'k':
                event.preventDefault();
                core.togglePlayPause();
                showFullscreenControls();
                break;
            case 'f':
                event.preventDefault();
                fullscreenManager.exit();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                core.seekTo(core.getCurrentTime() - 10);
                showFullscreenControls();
                break;
            case 'ArrowRight':
                event.preventDefault();
                core.seekTo(core.getCurrentTime() + 10);
                showFullscreenControls();
                break;
            case 'ArrowUp':
                event.preventDefault();
                core.setVolume(Math.min(1, core.getVolume() + 0.1));
                showFullscreenControls();
                break;
            case 'ArrowDown':
                event.preventDefault();
                core.setVolume(Math.max(0, core.getVolume() - 0.1));
                showFullscreenControls();
                break;
            default:
                // Any other key shows controls
                showFullscreenControls();
        }
    }
    
    function preventContextMenu(event) {
        event.preventDefault();
        return false;
    }
    
    function setupVideoDoubleClickHandling() {
        const videoElement = core.getVideoElement();
        
        if (videoElement) {
            // Handle double tap/click on video element
            videoElement.addEventListener('touchend', handleDoubleTagToggleFullscreen, { passive: false });
            videoElement.addEventListener('dblclick', (e) => {
                e.preventDefault();
                fullscreenManager.toggle();
            });
            
            // Also handle on the container for better hit area
            mainVideoContainer.addEventListener('touchend', handleDoubleTagToggleFullscreen, { passive: false });
            mainVideoContainer.addEventListener('dblclick', (e) => {
                e.preventDefault();
                fullscreenManager.toggle();
            });
        }
    }
    
    function setupEventListeners() {
        // Fullscreen button
        if (videoFullscreenBtn) {
            videoFullscreenBtn.addEventListener('click', () => {
                fullscreenManager.toggle();
            });
        }
        
        // Double tap/click fullscreen toggle
        setupVideoDoubleClickHandling();
        
        // Handle video events for fullscreen UI updates
        document.addEventListener('video:play', () => {
            if (mainVideoContainer.classList.contains('fullscreen')) {
                showFullscreenControls();
            }
        });
        
        document.addEventListener('video:pause', () => {
            if (mainVideoContainer.classList.contains('fullscreen')) {
                showFullscreenControls(5000); // Show longer when paused
            }
        });
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
        
        console.log('Player initialized with enhanced fullscreen controls');
    }
    
    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails) {
            console.warn(`Effect not found: ${effectId}`);
            return;
        }
        
        // Route based on effect target
        if (effectDetails.target === 'player') {
            effects.setEffect(effectId, value);
        } else if (effectDetails.target === 'artistic') {
            if (unifiedEffects) {
                unifiedEffects.setEffect(effectId, value);
                updateSliderIfNeeded(effectId, value);
            }
        } else {
            console.warn(`Unknown effect target: ${effectDetails.target} for effect: ${effectId}`);
        }
    }
    
    // Throttled slider update function
    let sliderUpdateThrottled = throttle(function(effectId, value) {
        const slider = document.getElementById(effectId + 'Slider');
        if (slider && Math.abs(slider.value - value) > 1) {
            slider.value = value;
            const event = new Event('input', { bubbles: false });
            slider.dispatchEvent(event);
        }
    }, 50);
    
    function updateSliderIfNeeded(effectId, value) {
        sliderUpdateThrottled(effectId, value);
    }
    
    // Simple throttle function
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
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
        
        // Clean up timeouts
        clearTimeout(fsControlsTimeout);
        clearTimeout(mouseIdleTimeout);
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
        showFullscreenControls, // Expose for external use
        hideFullscreenControls, // Expose for external use
        
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
