// js/mapping_manager.js
const MappingManager = (function() {
    let mappings = [];
    const MAPPINGS_STORAGE_KEY = 'sensorEffectMappings';

    function loadMappings() {
        const storedMappings = localStorage.getItem(MAPPINGS_STORAGE_KEY);
        if (storedMappings) {
            mappings = JSON.parse(storedMappings);
        } else {
            // Default initial mappings
            mappings = [
                { id: Date.now() + 1, sensorId: 'beta', effectId: 'brightness', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 50, rangeMax: 150 },
                { id: Date.now() + 2, sensorId: 'gamma', effectId: 'contrast', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 50, rangeMax: 150 },
                { id: Date.now() + 3, sensorId: 'alpha', effectId: 'saturation', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 0, rangeMax: 200 },
            ];
            saveMappings();
        }
        // Ensure all effects have default ranges if missing (e.g. after adding new effect)
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

    // Calculates the output value for an effect based on sensor input and mapping
    function calculateEffectValue(sensorValue, mapping) {
        const sensorDetails = getSensorById(mapping.sensorId);
        const effectDetails = getEffectById(mapping.effectId);

        if (!sensorDetails || !effectDetails) return effectDetails ? effectDetails.default : 0;

        // Normalize sensor input (0 to 1)
        // This is a crucial step and might need adjustment based on actual sensor behavior
        let normalizedSensor = 0;
        const sensorRange = sensorDetails.typicalMax - sensorDetails.typicalMin;
        
        if (sensorRange !== 0) {
            normalizedSensor = (sensorValue - sensorDetails.typicalMin) / sensorRange;
        }
        normalizedSensor = Math.max(0, Math.min(1, normalizedSensor)); // Clamp to 0-1

        if (mapping.invert) {
            normalizedSensor = 1 - normalizedSensor;
        }

        // Apply sensitivity (can make sensor more or less responsive around its midpoint)
        // A simple way: treat sensitivity as a multiplier on the deviation from 0.5
        // This is a placeholder; more sophisticated sensitivity curves could be used.
        // For now, let's interpret sensitivity as a direct multiplier on the normalized value that affects the output range span.
        // Or, more simply, just scale the output range based on sensitivity later (easier to reason about for users)
        // Let's apply sensitivity to the normalized value to control how "fast" it traverses the 0-1 range.
        // A sensitivity of 2 means it reaches 1 when the raw sensor is halfway through its range.
        // A sensitivity of 0.5 means it reaches 0.5 when the raw sensor is at its max.
        // This interpretation might be complex. Let's use sensitivity to scale the output delta.

        // Linearly interpolate to the effect's output range
        const outputRange = mapping.rangeMax - mapping.rangeMin;
        let effectValue = mapping.rangeMin + (normalizedSensor * outputRange);
        
        // Clamp to effect's absolute min/max
        effectValue = Math.max(effectDetails.min, Math.min(effectDetails.max, effectValue));
        
        // For properties like playbackRate that don't accept many decimal places
        if (effectDetails.id === 'playbackRate') {
            effectValue = parseFloat(effectValue.toFixed(2));
        } else if (effectDetails.unit === '%' || effectDetails.prop === 'blur' || effectDetails.prop === 'hue-rotate') {
            effectValue = Math.round(effectValue); // Integer for filters
        } else if (effectDetails.prop === 'volume') {
             effectValue = parseFloat(effectValue.toFixed(2));
        }


        return effectValue;
    }
    
    loadMappings(); // Load on init

    return {
        getMappings,
        getActiveMappings,
        addMapping,
        updateMapping,
        deleteMapping,
        getMappingById,
        calculateEffectValue
    };
})();
