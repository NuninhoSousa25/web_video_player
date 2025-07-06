// js/player/artistic-ui.js - Artistic Effects UI Controller
const ArtisticUI = (function() {
    
    let artisticEffects;
    let advancedArtisticEffects;
    
    // UI Elements
    let toggleBtn, controlsContainer;
    let sliderElements = {};
    let valueElements = {};
    let selectElements = {};
    
    // State
    let isVisible = false;
    let currentPreset = null;
    
    const SLIDER_CONFIGS = {
        // Pixel Sorting
        pixelSort: { min: 0, max: 100, default: 0, unit: '%' },
        pixelSortThreshold: { min: 0, max: 255, default: 128, unit: '' },
        
        // Flow Field
        flowField: { min: 0, max: 100, default: 0, unit: '%' },
        flowResolution: { min: 5, max: 50, default: 20, unit: '' },
        flowTurbulence: { min: 0, max: 3, default: 1.0, unit: '', step: 0.1 },
        flowSpeed: { min: 0, max: 5, default: 1.0, unit: '', step: 0.1 },
        
        // Color Processing
        colorQuantize: { min: 0, max: 100, default: 0, unit: '%' },
        ditherStrength: { min: 0, max: 100, default: 0, unit: '%' },
        solarize: { min: 0, max: 100, default: 0, unit: '%' },
        chromaShift: { min: 0, max: 100, default: 0, unit: '%' },
        
        // Digital Effects
        digitalGlitch: { min: 0, max: 100, default: 0, unit: '%' },
        datamosh: { min: 0, max: 100, default: 0, unit: '%' },
        
        // Kaleidoscope
        kaleidoscope: { min: 0, max: 100, default: 0, unit: '%' },
        kaleidoscopeSegments: { min: 3, max: 12, default: 6, unit: '' },
        
        // Procedural Noise
        perlinNoise: { min: 0, max: 100, default: 0, unit: '%' },
        noiseScale: { min: 10, max: 500, default: 100, unit: '' },
        worleyNoise: { min: 0, max: 100, default: 0, unit: '%' }
    };
    
    const SELECT_CONFIGS = {
        pixelSortMode: {
            options: [
                { value: 'brightness', label: 'Brightness' },
                { value: 'hue', label: 'Hue' },
                { value: 'saturation', label: 'Saturation' },
                { value: 'red', label: 'Red Channel' },
                { value: 'green', label: 'Green Channel' },
                { value: 'blue', label: 'Blue Channel' }
            ],
            default: 'brightness'
        },
        pixelSortDirection: {
            options: [
                { value: 'horizontal', label: 'Horizontal' },
                { value: 'vertical', label: 'Vertical' },
                { value: 'diagonal', label: 'Diagonal' },
                { value: 'radial', label: 'Radial' }
            ],
            default: 'horizontal'
        }
    };
    
    function cacheDOMElements() {
        toggleBtn = document.getElementById('toggleArtisticBtn');
        controlsContainer = document.getElementById('artisticControls');
        
        // Cache all sliders and value displays
        Object.keys(SLIDER_CONFIGS).forEach(effectId => {
            const slider = document.getElementById(effectId + 'Slider');
            const valueDisplay = document.getElementById(effectId + 'Value');
            
            if (slider) sliderElements[effectId] = slider;
            if (valueDisplay) valueElements[effectId] = valueDisplay;
        });
        
        // Cache select elements
        Object.keys(SELECT_CONFIGS).forEach(selectId => {
            const select = document.getElementById(selectId + 'Select');
            const valueDisplay = document.getElementById(selectId + 'Value');
            
            if (select) selectElements[selectId] = select;
            if (valueDisplay) valueElements[selectId] = valueDisplay;
        });
    }
    
    function updateValueDisplay(effectId, value) {
        const valueElement = valueElements[effectId];
        const config = SLIDER_CONFIGS[effectId];
        
        if (valueElement && config) {
            let displayValue = value;
            
            // Format value based on type
            if (config.step && config.step < 1) {
                displayValue = parseFloat(value).toFixed(1);
            } else {
                displayValue = Math.round(value);
            }
            
            valueElement.textContent = displayValue + config.unit;
        }
    }
    
    function updateSelectDisplay(selectId, value) {
        const valueElement = valueElements[selectId];
        const config = SELECT_CONFIGS[selectId];
        
        if (valueElement && config) {
            const option = config.options.find(opt => opt.value === value);
            if (option) {
                valueElement.textContent = option.label;
            }
        }
    }
    
    function setupSliderListeners() {
        Object.entries(sliderElements).forEach(([effectId, slider]) => {
            if (!slider) return;
            
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                updateValueDisplay(effectId, value);
                
                // Apply effect to both processors
                if (artisticEffects) {
                    artisticEffects.setEffect(effectId, value);
                }
                if (advancedArtisticEffects) {
                    advancedArtisticEffects.setEffect(effectId, value);
                }
                
                // Clear current preset if manually adjusted
                currentPreset = null;
                updatePresetButtons();
                
                // Update mapping indicators
                if (typeof UI !== 'undefined' && UI.updateActiveMappingIndicators) {
                    UI.updateActiveMappingIndicators();
                }
            });
            
            // Initialize value display
            const config = SLIDER_CONFIGS[effectId];
            if (config) {
                slider.value = config.default;
                updateValueDisplay(effectId, config.default);
            }
        });
    }
    
    function setupSelectListeners() {
        Object.entries(selectElements).forEach(([selectId, select]) => {
            if (!select) return;
            
            select.addEventListener('change', (e) => {
                const value = e.target.value;
                updateSelectDisplay(selectId, value);
                
                // Handle select-specific logic
                switch (selectId) {
                    case 'pixelSortMode':
                        if (artisticEffects) {
                            artisticEffects.setPixelSortMode(value);
                        }
                        if (advancedArtisticEffects) {
                            advancedArtisticEffects.setPixelSortMode(value);
                        }
                        break;
                        
                    case 'pixelSortDirection':
                        if (artisticEffects) {
                            artisticEffects.setPixelSortDirection(value);
                        }
                        if (advancedArtisticEffects) {
                            advancedArtisticEffects.setPixelSortDirection(value);
                        }
                        break;
                }
                
                currentPreset = null;
                updatePresetButtons();
            });
            
            // Initialize select value
            const config = SELECT_CONFIGS[selectId];
            if (config) {
                select.value = config.default;
                updateSelectDisplay(selectId, config.default);
            }
        });
    }
    
    function setupPresetButtons() {
        const presetButtons = document.querySelectorAll('.preset-btn');
        
        presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                const presetName = button.dataset.preset;
                applyPreset(presetName);
                
                currentPreset = presetName;
                updatePresetButtons();
            });
        });
    }
    
    function updatePresetButtons() {
        const presetButtons = document.querySelectorAll('.preset-btn');
        
        presetButtons.forEach(button => {
            const presetName = button.dataset.preset;
            if (presetName === currentPreset) {
                button.style.backgroundColor = '#ff9800';
                button.style.color = 'white';
            } else {
                button.style.backgroundColor = '#4caf50';
                button.style.color = 'white';
            }
        });
    }
    
    function applyPreset(presetName) {
        // First reset all effects
        resetAllEffects();
        
        // Apply preset configurations
        switch (presetName) {
            case 'glitchArt':
                setSliderValue('pixelSort', 60);
                setSliderValue('digitalGlitch', 40);
                setSliderValue('chromaShift', 30);
                setSliderValue('datamosh', 25);
                setSelectValue('pixelSortMode', 'brightness');
                setSelectValue('pixelSortDirection', 'horizontal');
                break;
                
            case 'organicFlow':
                setSliderValue('flowField', 70);
                setSliderValue('perlinNoise', 20);
                setSliderValue('colorQuantize', 15);
                setSliderValue('flowTurbulence', 2.0);
                setSliderValue('flowSpeed', 1.5);
                break;
                
            case 'retroDigital':
                setSliderValue('colorQuantize', 80);
                setSliderValue('ditherStrength', 60);
                setSliderValue('pixelSort', 30);
                setSliderValue('solarize', 20);
                setSelectValue('pixelSortMode', 'hue');
                break;
                
            case 'dreamscape':
                setSliderValue('kaleidoscope', 50);
                setSliderValue('flowField', 40);
                setSliderValue('chromaShift', 20);
                setSliderValue('perlinNoise', 30);
                setSliderValue('kaleidoscopeSegments', 8);
                break;
        }
    }
    
    function setSliderValue(effectId, value) {
        const slider = sliderElements[effectId];
        if (slider) {
            slider.value = value;
            slider.dispatchEvent(new Event('input'));
        }
    }
    
    function setSelectValue(selectId, value) {
        const select = selectElements[selectId];
        if (select) {
            select.value = value;
            select.dispatchEvent(new Event('change'));
        }
    }
    
    function resetAllEffects() {
        // Reset all sliders to default values
        Object.entries(SLIDER_CONFIGS).forEach(([effectId, config]) => {
            setSliderValue(effectId, config.default);
        });
        
        // Reset all selects to default values
        Object.entries(SELECT_CONFIGS).forEach(([selectId, config]) => {
            setSelectValue(selectId, config.default);
        });
        
        currentPreset = null;
        updatePresetButtons();
    }
    
    function toggleVisibility() {
        isVisible = !isVisible;
        
        if (controlsContainer) {
            controlsContainer.style.display = isVisible ? 'block' : 'none';
        }
        
        if (toggleBtn) {
            toggleBtn.textContent = isVisible ? 'Hide' : 'Show';
        }
        
        // Save preference
        localStorage.setItem('artisticEffectsVisible', isVisible.toString());
    }
    
    function loadVisibilityPreference() {
        const saved = localStorage.getItem('artisticEffectsVisible');
        if (saved !== null) {
            isVisible = saved === 'true';
            
            if (controlsContainer) {
                controlsContainer.style.display = isVisible ? 'block' : 'none';
            }
            
            if (toggleBtn) {
                toggleBtn.textContent = isVisible ? 'Hide' : 'Show';
            }
        }
    }
    
    function setupResetButton() {
        const resetBtn = document.getElementById('resetArtisticBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetAllEffects);
        }
    }
    
    function setupEventListeners() {
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleVisibility);
        }
        
        setupSliderListeners();
        setupSelectListeners();
        setupPresetButtons();
        setupResetButton();
    }
    
    function init(artisticEffectsRef, advancedArtisticEffectsRef) {
        artisticEffects = artisticEffectsRef;
        advancedArtisticEffects = advancedArtisticEffectsRef;
        
        cacheDOMElements();
        setupEventListeners();
        loadVisibilityPreference();
        updatePresetButtons();
    }
    
    // External API for setting effects (for sensor mappings)
    function setEffect(effectId, value) {
        setSliderValue(effectId, value);
    }
    
    function getEffectValue(effectId) {
        const slider = sliderElements[effectId];
        return slider ? parseFloat(slider.value) : 0;
    }
    
    function isEffectActive(effectId) {
        const config = SLIDER_CONFIGS[effectId];
        const currentValue = getEffectValue(effectId);
        return config ? currentValue !== config.default : false;
    }
    
    return {
        init,
        setEffect,
        getEffectValue,
        isEffectActive,
        resetAllEffects,
        applyPreset,
        toggleVisibility,
        
        // Preset names for external use
        presets: ['glitchArt', 'organicFlow', 'retroDigital', 'dreamscape']
    };
})();
