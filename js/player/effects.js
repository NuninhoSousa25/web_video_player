// js/player/effects.js - Fixed to properly handle all effect routing
const PlayerEffects = (function() {
    
    let videoPlayer;
    let unifiedEffects; // Reference to unified effects system
    
    // DOM elements for sliders and displays
    let volumeSlider, brightnessSlider, saturationSlider, contrastSlider, hueSlider;
    let brightnessValue, saturationValue, contrastValue, hueValue;
    let resetFiltersBtn;
    
    // Artistic effect sliders
    let pixelSortSlider, digitalGlitchSlider, chromaShiftSlider, kaleidoscopeSlider, colorQuantizeSlider, noiseOverlaySlider;
    let pixelSortValue, digitalGlitchValue, chromaShiftValue, kaleidoscopeValue, colorQuantizeValue, noiseOverlayValue;
    
    const ELEMENT_IDS = {
        volumeSlider: 'volumeSlider',
        brightnessSlider: 'brightnessSlider',
        saturationSlider: 'saturationSlider', 
        contrastSlider: 'contrastSlider',
        hueSlider: 'hueSlider',
        brightnessValue: 'brightnessValue',
        saturationValue: 'saturationValue',
        contrastValue: 'contrastValue',
        hueValue: 'hueValue',
        resetFiltersBtn: 'resetFiltersBtn',
        
        // Artistic effects
        pixelSortSlider: 'pixelSortSlider',
        digitalGlitchSlider: 'digitalGlitchSlider',
        chromaShiftSlider: 'chromaShiftSlider',
        kaleidoscopeSlider: 'kaleidoscopeSlider',
        colorQuantizeSlider: 'colorQuantizeSlider',
        noiseOverlaySlider: 'noiseOverlaySlider',
        pixelSortValue: 'pixelSortValue',
        digitalGlitchValue: 'digitalGlitchValue',
        chromaShiftValue: 'chromaShiftValue',
        kaleidoscopeValue: 'kaleidoscopeValue',
        colorQuantizeValue: 'colorQuantizeValue',
        noiseOverlayValue: 'noiseOverlayValue'
    };
    
    function cacheDOMElements() {
        const elements = DOMUtils.cacheElementsWithMapping(ELEMENT_IDS);
        volumeSlider = elements.volumeSlider;
        brightnessSlider = elements.brightnessSlider;
        saturationSlider = elements.saturationSlider;
        contrastSlider = elements.contrastSlider;
        hueSlider = elements.hueSlider;
        brightnessValue = elements.brightnessValue;
        saturationValue = elements.saturationValue;
        contrastValue = elements.contrastValue;
        hueValue = elements.hueValue;
        resetFiltersBtn = elements.resetFiltersBtn;
        
        // Artistic effect elements
        pixelSortSlider = elements.pixelSortSlider;
        digitalGlitchSlider = elements.digitalGlitchSlider;
        chromaShiftSlider = elements.chromaShiftSlider;
        kaleidoscopeSlider = elements.kaleidoscopeSlider;
        colorQuantizeSlider = elements.colorQuantizeSlider;
        noiseOverlaySlider = elements.noiseOverlaySlider;
        pixelSortValue = elements.pixelSortValue;
        digitalGlitchValue = elements.digitalGlitchValue;
        chromaShiftValue = elements.chromaShiftValue;
        kaleidoscopeValue = elements.kaleidoscopeValue;
        colorQuantizeValue = elements.colorQuantizeValue;
        noiseOverlayValue = elements.noiseOverlayValue;
    }
    
    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails) return;

        console.log(`PlayerEffects.setEffect: ${effectId} = ${value}, target: ${effectDetails.target}`);

        // FIXED: Handle different effect targets properly
        if (effectDetails.target === 'player') {
            if (effectDetails.isFilter) {
                // CSS filter effects go through unified system
                if (unifiedEffects) {
                    unifiedEffects.setEffect(effectId, value);
                }
                
                // Update corresponding slider
                const sliderMap = {
                    'brightness': brightnessSlider,
                    'saturation': saturationSlider,
                    'contrast': contrastSlider,
                    'hue': hueSlider
                };
                
                const slider = sliderMap[effectId];
                if (slider) {
                    slider.value = value;
                }
                
            } else if (effectDetails.prop === 'playbackRate') {
                videoPlayer.playbackRate = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
                
            } else if (effectDetails.prop === 'volume') {
                videoPlayer.volume = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
                if (volumeSlider) volumeSlider.value = videoPlayer.volume;
            }
            
        } else if (effectDetails.target === 'artistic') {
            // FIXED: Artistic effects should NOT be handled here - they come from Player.setEffect
            // This method is only called for UI slider changes, not sensor mappings
            console.log(`Artistic effect ${effectId} handled by UI slider, routing to unified system`);
            if (unifiedEffects) {
                unifiedEffects.setEffect(effectId, value);
            }
            
            // Update artistic effect sliders
            const artisticSliderMap = {
                'pixelSort': pixelSortSlider,
                'digitalGlitch': digitalGlitchSlider,
                'chromaShift': chromaShiftSlider,
                'kaleidoscope': kaleidoscopeSlider,
                'colorQuantize': colorQuantizeSlider,
                'noiseOverlay': noiseOverlaySlider
            };
            
            const slider = artisticSliderMap[effectId];
            if (slider) {
                slider.value = value;
            }
        }
        
        updateFilterDisplayValues();
        UI.updateActiveMappingIndicators();
    }
    
    function updateFilterDisplayValues() {
        // Standard filter displays
        if (brightnessValue && brightnessSlider) {
            brightnessValue.textContent = `${brightnessSlider.value}%`;
        }
        if (saturationValue && saturationSlider) {
            saturationValue.textContent = `${saturationSlider.value}%`;
        }
        if (contrastValue && contrastSlider) {
            contrastValue.textContent = `${contrastSlider.value}%`;
        }
        if (hueValue && hueSlider) {
            hueValue.textContent = `${hueSlider.value}deg`;
        }
        
        // Artistic effect displays
        if (pixelSortValue && pixelSortSlider) {
            pixelSortValue.textContent = `${pixelSortSlider.value}%`;
        }
        if (digitalGlitchValue && digitalGlitchSlider) {
            digitalGlitchValue.textContent = `${digitalGlitchSlider.value}%`;
        }
        if (chromaShiftValue && chromaShiftSlider) {
            chromaShiftValue.textContent = `${chromaShiftSlider.value}%`;
        }
        if (kaleidoscopeValue && kaleidoscopeSlider) {
            kaleidoscopeValue.textContent = `${kaleidoscopeSlider.value}%`;
        }
        if (colorQuantizeValue && colorQuantizeSlider) {
            colorQuantizeValue.textContent = `${colorQuantizeSlider.value}%`;
        }
        if (noiseOverlayValue && noiseOverlaySlider) {
            noiseOverlayValue.textContent = `${noiseOverlaySlider.value}%`;
        }
    }
    
    function resetAllFilters() {
        // Reset unified effects
        if (unifiedEffects) {
            unifiedEffects.resetAllEffects();
        }
        
        // Reset all sliders to default values
        const sliderDefaults = [
            { slider: brightnessSlider, value: 100 },
            { slider: saturationSlider, value: 100 },
            { slider: contrastSlider, value: 100 },
            { slider: hueSlider, value: 0 },
            { slider: pixelSortSlider, value: 0 },
            { slider: digitalGlitchSlider, value: 0 },
            { slider: chromaShiftSlider, value: 0 },
            { slider: kaleidoscopeSlider, value: 0 },
            { slider: colorQuantizeSlider, value: 0 },
            { slider: noiseOverlaySlider, value: 0 }
        ];
        
        sliderDefaults.forEach(config => {
            if (config.slider) {
                config.slider.value = config.value;
            }
        });
        
        updateFilterDisplayValues();
        saveFilterSettings();
        UI.updateActiveMappingIndicators();
    }
    
    function loadFilterSettings() {
        const settings = {
            brightness: localStorage.getItem('videoPlayerBrightness') || 100,
            saturation: localStorage.getItem('videoPlayerSaturation') || 100,
            contrast: localStorage.getItem('videoPlayerContrast') || 100,
            hue: localStorage.getItem('videoPlayerHue') || 0,
            volume: localStorage.getItem('videoPlayerVolume') || 1
        };
        
        // Apply saved settings to sliders
        if (brightnessSlider) brightnessSlider.value = settings.brightness;
        if (saturationSlider) saturationSlider.value = settings.saturation;
        if (contrastSlider) contrastSlider.value = settings.contrast;
        if (hueSlider) hueSlider.value = settings.hue;
        if (volumeSlider) volumeSlider.value = settings.volume;
        
        // Apply effects through unified system
        if (unifiedEffects) {
            unifiedEffects.setEffect('brightness', parseFloat(settings.brightness));
            unifiedEffects.setEffect('saturation', parseFloat(settings.saturation));
            unifiedEffects.setEffect('contrast', parseFloat(settings.contrast));
            unifiedEffects.setEffect('hue', parseFloat(settings.hue));
        }
        
        // Set volume and playback rate directly on video element
        setEffect('volume', parseFloat(settings.volume));
        setEffect('playbackRate', 1); // Default playback rate
        
        updateFilterDisplayValues();
    }
    
    function saveFilterSettings() {
        if (brightnessSlider) localStorage.setItem('videoPlayerBrightness', brightnessSlider.value);
        if (saturationSlider) localStorage.setItem('videoPlayerSaturation', saturationSlider.value);
        if (contrastSlider) localStorage.setItem('videoPlayerContrast', contrastSlider.value);
        if (hueSlider) localStorage.setItem('videoPlayerHue', hueSlider.value);
        if (volumeSlider) localStorage.setItem('videoPlayerVolume', volumeSlider.value);
    }
    
    function setupEventListeners() {
        // Volume slider
        if (volumeSlider) {
            volumeSlider.addEventListener('input', function() {
                setEffect('volume', parseFloat(this.value));
                localStorage.setItem('videoPlayerVolume', this.value);
            });
        }
        
        // Standard filter sliders
        const sliderConfigs = [
            { slider: brightnessSlider, effect: 'brightness', storageKey: 'videoPlayerBrightness' },
            { slider: saturationSlider, effect: 'saturation', storageKey: 'videoPlayerSaturation' },
            { slider: contrastSlider, effect: 'contrast', storageKey: 'videoPlayerContrast' },
            { slider: hueSlider, effect: 'hue', storageKey: 'videoPlayerHue' }
        ];
        
        sliderConfigs.forEach(config => {
            if (config.slider) {
                config.slider.addEventListener('input', () => {
                    setEffect(config.effect, parseFloat(config.slider.value));
                    localStorage.setItem(config.storageKey, config.slider.value);
                });
            }
        });
        
        // Artistic effect sliders - these work fine for UI interaction
        const artisticSliderConfigs = [
            { slider: pixelSortSlider, effect: 'pixelSort' },
            { slider: digitalGlitchSlider, effect: 'digitalGlitch' },
            { slider: chromaShiftSlider, effect: 'chromaShift' },
            { slider: kaleidoscopeSlider, effect: 'kaleidoscope' },
            { slider: colorQuantizeSlider, effect: 'colorQuantize' },
            { slider: noiseOverlaySlider, effect: 'noiseOverlay' }
        ];
        
        artisticSliderConfigs.forEach(config => {
            if (config.slider) {
                config.slider.addEventListener('input', () => {
                    const value = parseFloat(config.slider.value);
                    updateFilterDisplayValues(); // Update display immediately
                    
                    // Apply through unified effects system
                    if (unifiedEffects) {
                        unifiedEffects.setEffect(config.effect, value);
                    }
                    
                    // Update mapping indicators
                    if (typeof UI !== 'undefined' && UI.updateActiveMappingIndicators) {
                        UI.updateActiveMappingIndicators();
                    }
                });
            }
        });
        
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
        loadFilterSettings();
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
            return videoPlayer.volume !== effect.default;
        } else if (effect.prop === 'playbackRate') {
            return videoPlayer.playbackRate !== effect.default;
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
    
    return {
        init,
        setEffect,
        resetAllFilters,
        isFilterApplied,
        isEffectActive,
        getCurrentFilterValue,
        updateFilterDisplayValues,
        saveFilterSettings,
        loadFilterSettings
    };
})();
