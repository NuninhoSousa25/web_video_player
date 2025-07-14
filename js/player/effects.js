// js/player/effects.js - Slider-free version, effects controlled only by sensors
const PlayerEffects = (function() {
    
    let videoPlayer;
    let unifiedEffects; // Reference to unified effects system
    
    // DOM elements - Only essential controls remain
    let volumeSlider, resetFiltersBtn;
    
    const ELEMENT_IDS = {
        volumeSlider: 'volumeSlider',
        resetFiltersBtn: 'resetFiltersBtn'
    };
    
    function cacheDOMElements() {
        const elements = DOMUtils.cacheElementsWithMapping(ELEMENT_IDS);
        volumeSlider = elements.volumeSlider;
        resetFiltersBtn = elements.resetFiltersBtn;
    }
    
    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails) return;

        console.log(`PlayerEffects.setEffect: ${effectId} = ${value}, target: ${effectDetails.target}`);

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
            console.log(`Artistic effect ${effectId} routed to unified system`);
            if (unifiedEffects) {
                unifiedEffects.setEffect(effectId, value);
            }
        }
        
        // Update mapping indicators (this still works without sliders)
        UI.updateActiveMappingIndicators();
    }
    
    function resetAllFilters() {
        console.log('Resetting all effects to defaults...');
        
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
        
        UI.updateActiveMappingIndicators();
        
        console.log('All effects reset to defaults');
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
        
        console.log('Initial settings loaded - effects ready for sensor control');
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
            resetFiltersBtn.addEventListener('click', resetAllFilters);
        }
    }
    
    function init(playerCore, legacyArtisticEffects) {
        videoPlayer = playerCore.getVideoElement();
        
        // Get reference to unified effects system
        unifiedEffects = UnifiedVideoEffects;
        
        cacheDOMElements();
        setupEventListeners();
        loadInitialSettings();
        
        console.log('PlayerEffects initialized in slider-free mode');
    }
    
    function isFilterApplied(effectId) {
        if (unifiedEffects) {
            return unifiedEffects.isEffectActive(effectId);
        }
        
        // Fallback for non-visual effects
        const effect = getEffectById(effectId);
        if (!effect) return false;
        
        if (effect.prop === 'volume') {
            return videoPlayer.volume !== effect.default;
        } else if (effect.prop === 'playbackRate') {
            return videoPlayer.playbackRate !== effect.default;
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
            return Math.abs(videoPlayer.volume - effect.default) > 0.01; // Small tolerance for floating point
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
    
    // New function: Get current effect status for debugging
    function getEffectStatus() {
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
        resetAllFilters,
        isFilterApplied,
        isEffectActive,
        getCurrentFilterValue,
        getEffectStatus // For debugging
    };
})();
