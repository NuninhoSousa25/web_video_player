// js/mapping_manager.js - Updated with battery and time mappings
const MappingManager = (function() {
    let mappings = [];
    const MAPPINGS_STORAGE_KEY = 'sensorEffectMappings';
    let lastEffectValues = {}; // Track last values to prevent spam

    function loadMappings() {
        const storedMappings = localStorage.getItem(MAPPINGS_STORAGE_KEY);
        if (storedMappings) {
            mappings = JSON.parse(storedMappings);
        } else {
            // NEW: Default mappings with battery and time sensors
            mappings = [
                // Time of day controls hue (color temperature throughout day)
                { 
                    id: Date.now() + 100, 
                    sensorId: 'timeOfDay', 
                    effectId: 'hue', 
                    sensitivity: 1.0, 
                    rangeMin: 200,    // Warm orange/red in morning
                    rangeMax: 320,    // Cool blue at night  
                    invert: false,
                    enabled: true
                },
                
                // Battery level controls brightness
                { 
                    id: Date.now() + 101, 
                    sensorId: 'batteryLevel', 
                    effectId: 'brightness', 
                    sensitivity: 1.0, 
                    rangeMin: 60,     // Dim when battery low
                    rangeMax: 120,    // Bright when battery full
                    invert: false,
                    enabled: true
                },
                
                // Keep some original mappings that work
                { id: Date.now() + 102, sensorId: 'beta', effectId: 'contrast', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 50, rangeMax: 150 },
                { id: Date.now() + 103, sensorId: 'gamma', effectId: 'saturation', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 50, rangeMax: 150 },
                { id: Date.now() + 104, sensorId: 'micVolume', effectId: 'noiseOverlay', enabled: true, sensitivity: 2.0, invert: false, rangeMin: 0, rangeMax: 80 }
            ];
            saveMappings();
        }
        
        // Ensure all effects have default ranges if missing
        mappings.forEach(m => {
            const effect = getEffectById(m.effectId);
            if (effect && (m.rangeMin === undefined || m.rangeMax === undefined)) {
                m.rangeMin = effect.min;
                m.rangeMax = effect.max;
            }
        });
    }

    function saveMappings() {
        localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
    }

    function getMappings() {
        return [...mappings]; // Return a copy
    }

    function getActiveMappings() {
        return mappings.filter(m => m.enabled);
    }

    function addMapping(newMappingData) {
        const newId = Date.now();
        const effect = getEffectById(newMappingData.effectId);
        const mappingToAdd = {
            id: newId,
            sensorId: newMappingData.sensorId,
            effectId: newMappingData.effectId,
            enabled: newMappingData.enabled !== undefined ? newMappingData.enabled : true,
            sensitivity: parseFloat(newMappingData.sensitivity) || 1.0,
            invert: newMappingData.invert || false,
            rangeMin: parseFloat(newMappingData.rangeMin) ?? effect?.min ?? 0,
            rangeMax: parseFloat(newMappingData.rangeMax) ?? effect?.max ?? 100,
        };
        mappings.push(mappingToAdd);
        saveMappings();
        return mappingToAdd;
    }

    function updateMapping(mappingId, updatedData) {
        const index = mappings.findIndex(m => m.id === mappingId);
        if (index !== -1) {
            mappings[index] = { ...mappings[index], ...updatedData };
            // Ensure numeric types
            mappings[index].sensitivity = parseFloat(mappings[index].sensitivity);
            mappings[index].rangeMin = parseFloat(mappings[index].rangeMin);
            mappings[index].rangeMax = parseFloat(mappings[index].rangeMax);
            saveMappings();
            return mappings[index];
        }
        return null;
    }

    function deleteMapping(mappingId) {
        mappings = mappings.filter(m => m.id !== mappingId);
        saveMappings();
    }

    function getMappingById(id) {
        return mappings.find(m => m.id === id);
    }

    // UPDATED: Calculates the output value with change detection
    function calculateEffectValue(sensorValue, mapping) {
        const sensorDetails = getSensorById(mapping.sensorId);
        const effectDetails = getEffectById(mapping.effectId);

        if (!sensorDetails || !effectDetails) return effectDetails ? effectDetails.default : 0;

        // Normalize sensor input (0 to 1)
        let normalizedSensor = 0;
        const sensorRange = sensorDetails.typicalMax - sensorDetails.typicalMin;
        
        if (sensorRange !== 0) {
            normalizedSensor = (sensorValue - sensorDetails.typicalMin) / sensorRange;
        }
        normalizedSensor = Math.max(0, Math.min(1, normalizedSensor)); // Clamp to 0-1

        if (mapping.invert) {
            normalizedSensor = 1 - normalizedSensor;
        }

        // Apply sensitivity by scaling the normalized value
        let sensitizedValue = normalizedSensor * mapping.sensitivity;
        sensitizedValue = Math.max(0, Math.min(1, sensitizedValue)); // Keep in 0-1 range

        // Linearly interpolate to the effect's output range
        const outputRange = mapping.rangeMax - mapping.rangeMin;
        let effectValue = mapping.rangeMin + (sensitizedValue * outputRange);
        
        // Clamp to effect's absolute min/max
        effectValue = Math.max(effectDetails.min, Math.min(effectDetails.max, effectValue));
        
        // For properties that need specific formatting
        if (effectDetails.id === 'playbackRate') {
            effectValue = parseFloat(effectValue.toFixed(2));
        } else if (effectDetails.unit === '%' || effectDetails.prop === 'blur' || effectDetails.prop === 'hue-rotate') {
            effectValue = Math.round(effectValue); // Integer for filters
        } else if (effectDetails.prop === 'volume') {
             effectValue = parseFloat(effectValue.toFixed(2));
        }

        return effectValue;
    }

    // NEW: Function to check if effect value has meaningfully changed
    function hasValueChanged(effectId, newValue, threshold = 0.5) {
        const lastValue = lastEffectValues[effectId];
        if (lastValue === undefined) {
            lastEffectValues[effectId] = newValue;
            return true;
        }
        
        const changed = Math.abs(lastValue - newValue) >= threshold;
        if (changed) {
            lastEffectValues[effectId] = newValue;
        }
        
        return changed;
    }

    // NEW: Reset the change tracking (useful when sensors are disabled/enabled)
    function resetChangeTracking() {
        lastEffectValues = {};
    }
    
    loadMappings(); // Load on init

    return {
        getMappings,
        getActiveMappings,
        addMapping,
        updateMapping,
        deleteMapping,
        getMappingById,
        calculateEffectValue,
        hasValueChanged,
        resetChangeTracking
    };
})();
