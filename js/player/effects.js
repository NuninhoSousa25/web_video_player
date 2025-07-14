// js/player/effects.js - Performance optimized version
const PlayerEffects = (function() {
    
    let videoPlayer;
    let unifiedEffects; // Reference to unified effects system
    
    // DOM elements - Only essential controls remain
    let volumeSlider, resetFiltersBtn;
    
    const ELEMENT_IDS = {
        volumeSlider: 'volumeSlider',
        resetFiltersBtn: 'resetFiltersBtn'
    };
    
    // **PERFORMANCE: Reduce logging**
    const DEBUG_MODE = false;
    
    function cacheDOMElements() {
        const elements = DOMUtils.cacheElementsWithMapping(ELEMENT_IDS);
        volumeSlider = elements.volumeSlider;
        resetFiltersBtn = elements.resetFiltersBtn;
    }
    
    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails) return;

        // **REMOVED: console.log spam for production**
        if (DEBUG_MODE) {
            console.log(`PlayerEffects.setEffect: ${effectId} = ${value}, target: ${effectDetails.target}`);
        }

        // Handle different effect targets
        if (effectDetails.target === 'player') {
            if (effectDetails.isFilter) {
                // CSS filter effects go through unified system
                if (unifiedEffects) {
                    unifiedEffects.setEffect(effectId, value);
                }
                
            } else if (effectDetails.prop === 'playbackRate') {
                videoPlayer.playbackRate = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
                
            } else if (effectDetails.prop === 'volume') {
                videoPlayer.volume = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
                // Update volume slider to reflect sensor-driven changes
                if (volumeSlider) volumeSlider.value = videoPlayer.volume;
            }
            
        } else if (effectDetails.target === 'artistic') {
            // Artistic effects go to unified system
            if (DEBUG_MODE) {
                console.log(`Artistic effect ${effectId} routed to unified system`);
            }
            if (unifiedEffects) {
                unifiedEffects.setEffect(effectId, value);
            }
        }
        
        // **PERFORMANCE: Throttled UI updates only**
        throttledUIUpdate();
    }
    
    // **PERFORMANCE: Throttle UI updates**
    let uiUpdateThrottled = null;
    
    function throttledUIUpdate() {
        if (uiUpdateThrottled) {
            uiUpdateThrottled();
        }
    }
    
    function resetAllEffects() {
        if (DEBUG_MODE) {
            console.log('Resetting all effects to defaults...');
        }
        
        // Reset unified effects
        if (unifiedEffects) {
            unifiedEffects.resetAllEffects();
        }
        
        // Reset video properties
        if (videoPlayer) {
            videoPlayer.volume = 1;
            videoPlayer.playbackRate = 1;
        }
        
        // Update volume slider
        if (volumeSlider) {
            volumeSlider.value = 1;
        }
        
        // Clear any saved settings that might interfere
        localStorage.removeItem('videoPlayerBrightness');
        localStorage.removeItem('videoPlayerSaturation');
        localStorage.removeItem('videoPlayerContrast');
        localStorage.removeItem('videoPlayerHue');
        
        throttledUIUpdate();
        
        if (DEBUG_MODE) {
            console.log('All effects reset to defaults');
        }
    }
    
    function loadInitialSettings() {
        // Load only essential settings
        const savedVolume = localStorage.getItem('videoPlayerVolume') || 1;
        
        if (volumeSlider) {
            volumeSlider.value = savedVolume;
        }
        
        if (videoPlayer) {
            videoPlayer.volume = parseFloat(savedVolume);
            videoPlayer.playbackRate = 1; // Always start with normal playback
        }
        
        // Initialize unified effects with defaults (sensors will control them)
        if (unifiedEffects) {
            // Set all effects to their default values
            unifiedEffects.resetAllEffects();
        }
        
        if (DEBUG_MODE) {
            console.log('Initial settings loaded - effects ready for sensor control');
        }
    }
    
    function setupEventListeners() {
        // Volume slider - keep this for accessibility
        if (volumeSlider) {
            volumeSlider.addEventListener('input', function() {
                const volume = parseFloat(this.value);
                if (videoPlayer) {
                    videoPlayer.volume = volume;
                }
                localStorage.setItem('videoPlayerVolume', this.value);
            });
        }
        
        // Reset button
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', resetAllEffects);
        }
    }
    
    function init(playerCore, legacyArtisticEffects) {
        videoPlayer = playerCore.getVideoElement();
        
        // Get reference to unified effects system
        unifiedEffects = UnifiedVideoEffects;
        
        // **PERFORMANCE: Create throttled UI update function**
        uiUpdateThrottled = throttle(() => {
            if (typeof UI !== 'undefined' && UI.updateActiveMappingIndicators) {
                UI.updateActiveMappingIndicators();
            }
        }, 100); // Update UI at most 10 times per second
        
        cacheDOMElements();
        setupEventListeners();
        loadInitialSettings();
        
        if (DEBUG_MODE) {
            console.log('PlayerEffects initialized in performance mode');
        }
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
    
    function isFilterApplied(effectId) {
        if (unifiedEffects) {
            return unifiedEffects.isEffectActive(effectId);
        }
        
        // Fallback for non-visual effects
        const effect = getEffectById(effectId);
        if (!effect) return false;
        
        if (effect.prop === 'volume') {
            return Math.abs(videoPlayer.volume - effect.default) > 0.01;
        } else if (effect.prop === 'playbackRate') {
            return Math.abs(videoPlayer.playbackRate - effect.default) > 0.01;
        }
        
        return false;
    }
    
    function isEffectActive(effectId) {
        const effect = getEffectById(effectId);
        if (!effect) return false;
        
        // Check unified effects for visual effects
        if (effect.isFilter || effect.target === 'artistic') {
            return unifiedEffects ? unifiedEffects.isEffectActive(effectId) : false;
        }
        
        // Check video element properties for non-visual effects
        if (effect.prop === 'volume') {
            return Math.abs(videoPlayer.volume - effect.default) > 0.01;
        } else if (effect.prop === 'playbackRate') {
            return Math.abs(videoPlayer.playbackRate - effect.default) > 0.01;
        }
        
        return false;
    }
    
    function getCurrentFilterValue(effectId) {
        // For unified effects, get from the effects object
        if (unifiedEffects && unifiedEffects.effects) {
            return unifiedEffects.effects[effectId];
        }
        
        // Fallback for video properties
        const effect = getEffectById(effectId);
        if (effect) {
            if (effect.prop === 'volume') {
                return videoPlayer.volume;
            } else if (effect.prop === 'playbackRate') {
                return videoPlayer.playbackRate;
            }
        }
        
        return null;
    }
    
    // **PERFORMANCE: Optimized status function**
    function getEffectStatus() {
        if (!DEBUG_MODE) return null; // Don't generate status in production
        
        const status = {
            unifiedEffects: unifiedEffects ? unifiedEffects.effects : null,
            videoVolume: videoPlayer ? videoPlayer.volume : null,
            videoPlaybackRate: videoPlayer ? videoPlayer.playbackRate : null
        };
        
        console.log('Current effect status:', status);
        return status;
    }
    
    return {
        init,
        setEffect,
        resetAllEffects,
        isFilterApplied,
        isEffectActive,
        getCurrentFilterValue,
        getEffectStatus // For debugging
    };
})();
