// js/player/effects.js
const PlayerEffects = (function() {
    
    let videoPlayer;
    let currentFilterStyles = {};
    
    // DOM elements for sliders and displays
    let volumeSlider, brightnessSlider, saturationSlider, contrastSlider, hueSlider;
    let brightnessValue, saturationValue, contrastValue, hueValue;
    let resetFiltersBtn;
    
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
        resetFiltersBtn: 'resetFiltersBtn'
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
    }
    
    function applyCombinedVideoFilters() {
        if (!videoPlayer) return;
        
        let filterString = "";
        
        AVAILABLE_EFFECTS.forEach(effect => {
            if (effect.isFilter && currentFilterStyles[effect.id] !== undefined) {
                const value = currentFilterStyles[effect.id];
                const isDefaultValue = (effect.id === 'blur' && value === 0) ||
                                     (effect.id === 'hue' && value === 0) || 
                                     (effect.id === 'sepia' && value === 0) ||
                                     (effect.id === 'grayscale' && value === 0) ||
                                     (effect.id === 'invertColors' && value === 0);
                
                if (!isDefaultValue) {
                    filterString += `${effect.prop}(${value}${effect.unit}) `;
                }
            }
        });
        
        videoPlayer.style.filter = filterString.trim();
        UI.updateActiveMappingIndicators();
    }
    
    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails || effectDetails.target !== 'player' || !videoPlayer) return;

        if (effectDetails.isFilter) {
            currentFilterStyles[effectId] = value;
            applyCombinedVideoFilters();
            
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
            
            updateFilterDisplayValues();
            
        } else if (effectDetails.prop === 'playbackRate') {
            videoPlayer.playbackRate = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
            UI.updateActiveMappingIndicators();
            
        } else if (effectDetails.prop === 'volume') {
            videoPlayer.volume = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
            if (volumeSlider) volumeSlider.value = videoPlayer.volume;
            UI.updateActiveMappingIndicators();
        }
    }
    
    function updateFilterDisplayValues() {
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
    }
    
    function resetAllFilters() {
        AVAILABLE_EFFECTS.forEach(effect => {
            if (effect.isFilter && effect.target === 'player') {
                const slider = document.getElementById(effect.id + 'Slider');
                if (slider) {
                    setEffect(effect.id, effect.default);
                    slider.value = effect.default;
                } else if (currentFilterStyles.hasOwnProperty(effect.id)) {
                    setEffect(effect.id, effect.default);
                }
            }
        });
        
        updateFilterDisplayValues();
        saveFilterSettings();
        applyCombinedVideoFilters();
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
        
        // Apply effects
        setEffect('brightness', parseFloat(settings.brightness));
        setEffect('saturation', parseFloat(settings.saturation));
        setEffect('contrast', parseFloat(settings.contrast));
        setEffect('hue', parseFloat(settings.hue));
        setEffect('volume', parseFloat(settings.volume));
        
        // Set defaults for effects not saved
        AVAILABLE_EFFECTS.forEach(effect => {
            if (effect.target === 'player' && currentFilterStyles[effect.id] === undefined && effect.prop !== 'volume' && effect.prop !== 'playbackRate') {
                if (effect.isFilter) {
                    setEffect(effect.id, effect.default);
                }
            }
        });
        
        if (videoPlayer && videoPlayer.playbackRate === 1) {
            setEffect('playbackRate', getEffectById('playbackRate').default);
        }
        
        updateFilterDisplayValues();
        applyCombinedVideoFilters();
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
        
        // Filter sliders with auto-save
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
        
        // Reset button
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', resetAllFilters);
        }
    }
    
    function init(playerCore) {
        videoPlayer = playerCore.getVideoElement();
        
        cacheDOMElements();
        setupEventListeners();
        loadFilterSettings();
    }
    
    function isFilterApplied(effectId) {
        return currentFilterStyles.hasOwnProperty(effectId) && 
               currentFilterStyles[effectId] !== getEffectById(effectId)?.default;
    }
    
    function isEffectActive(effectId) {
        const effect = getEffectById(effectId);
        if (!effect) return false;
        
        if (effect.isFilter) {
            return currentFilterStyles.hasOwnProperty(effectId) && 
                   currentFilterStyles[effectId] !== effect.default;
        } else if (effect.prop === 'volume') {
            return videoPlayer.volume !== effect.default;
        } else if (effect.prop === 'playbackRate') {
            return videoPlayer.playbackRate !== effect.default;
        }
        
        return false;
    }
    
    function getCurrentFilterValue(effectId) {
        return currentFilterStyles[effectId];
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