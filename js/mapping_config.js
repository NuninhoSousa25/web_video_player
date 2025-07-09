// js/mapping_manager.js - Fixed for mobile sensor calculations
const MappingManager = (function() {
    let mappings = [];
    const MAPPINGS_STORAGE_KEY = 'sensorEffectMappings';
    const DEBUG_MODE = false; // Set to true for detailed logging

    function debugLog(message, data = null) {
        if (DEBUG_MODE) {
            console.log('[MappingManager]', message, data);
        }
    }

    function loadMappings() {
        const storedMappings = localStorage.getItem(MAPPINGS_STORAGE_KEY);
        if (storedMappings) {
            mappings = JSON.parse(storedMappings);
        } else {
            // Use mobile-optimized default mappings
            mappings = [
                { id: Date.now() + 1, sensorId: 'beta', effectId: 'brightness', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 50, rangeMax: 200 },
                { id: Date.now() + 2, sensorId: 'gamma', effectId: 'contrast', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 50, rangeMax: 200 },
                { id: Date.now() + 3, sensorId: 'alpha', effectId: 'hue', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 0, rangeMax: 360 },
                { id: Date.now() + 4, sensorId: 'accelX', effectId: 'saturation', enabled: true, sensitivity: 2.0, invert: false, rangeMin: 0, rangeMax: 200 },
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

        debugLog('Loaded mappings:', mappings);
    }

    function saveMappings() {
        localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
        debugLog('Saved mappings to localStorage');
    }

    function getMappings() {
        return [...mappings]; // Return a copy
    }

    function getActiveMappings() {
        const active = mappings.filter(m => m.enabled);
        debugLog('Active mappings:', active);
        return active;
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
        debugLog('Added new mapping:', mappingToAdd);
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
            debugLog('Updated mapping:', mappings[index]);
            return mappings[index];
        }
        return null;
    }

    function deleteMapping(mappingId) {
        const beforeCount = mappings.length;
        mappings = mappings.filter(m => m.id !== mappingId);
        saveMappings();
        debugLog(`Deleted mapping ${mappingId}, ${beforeCount} -> ${mappings.length}`);
    }

    function getMappingById(id) {
        return mappings.find(m => m.id === id);
    }

    // NEW: Improved calculation for mobile devices
    function calculateEffectValue(sensorValue, mapping) {
        const sensorDetails = getSensorById(mapping.sensorId);
        const effectDetails = getEffectById(mapping.effectId);

        if (!sensorDetails || !effectDetails) {
            debugLog('Missing sensor or effect details', { sensorId: mapping.sensorId, effectId: mapping.effectId });
            return effectDetails ? effectDetails.default : 0;
        }

        debugLog('Calculating effect value', {
            sensorValue,
            sensorId: mapping.sensorId,
            effectId: mapping.effectId,
            mapping: mapping
        });

        // Handle null or undefined sensor values
        if (sensorValue === null || sensorValue === undefined || isNaN(sensorValue)) {
            debugLog('Invalid sensor value, returning default');
            return effectDetails.default;
        }

        // Step 1: Normalize sensor input to 0-1 range
        const sensorRange = sensorDetails.typicalMax - sensorDetails.typicalMin;
        let normalizedSensor = 0;
        
        if (sensorRange !== 0) {
            // Clamp sensor value to expected range first
            const clampedSensorValue = Math.max(
                sensorDetails.typicalMin, 
                Math.min(sensorDetails.typicalMax, sensorValue)
            );
            
            normalizedSensor = (clampedSensorValue - sensorDetails.typicalMin) / sensorRange;
        }

        // Ensure normalized value is between 0 and 1
        normalizedSensor = Math.max(0, Math.min(1, normalizedSensor));

        debugLog('Normalized sensor value', {
            originalValue: sensorValue,
            normalizedValue: normalizedSensor,
            sensorRange: sensorRange,
            sensorMin: sensorDetails.typicalMin,
            sensorMax: sensorDetails.typicalMax
        });

        // Step 2: Apply sensitivity
        // Sensitivity affects how much the sensor movement translates to effect change
        // Values > 1 make the effect more sensitive, < 1 less sensitive
        let sensitizedValue = normalizedSensor;
        
        if (mapping.sensitivity !== 1.0) {
            // Apply sensitivity as a power function for better control
            if (mapping.sensitivity > 1) {
                // More sensitive: compress the input range
                sensitizedValue = Math.pow(normalizedSensor, 1 / mapping.sensitivity);
            } else {
                // Less sensitive: expand the input range
                sensitizedValue = Math.pow(normalizedSensor, mapping.sensitivity);
            }
        }

        // Step 3: Apply inversion if needed
        if (mapping.invert) {
            sensitizedValue = 1 - sensitizedValue;
        }

        debugLog('After sensitivity and inversion', {
            sensitizedValue: sensitizedValue,
            sensitivity: mapping.sensitivity,
            inverted: mapping.invert
        });

        // Step 4: Map to effect's output range
        const outputRange = mapping.rangeMax - mapping.rangeMin;
        let effectValue = mapping.rangeMin + (sensitizedValue * outputRange);

        // Step 5: Clamp to effect's absolute min/max
        effectValue = Math.max(effectDetails.min, Math.min(effectDetails.max, effectValue));

        // Step 6: Apply effect-specific formatting
        if (effectDetails.id === 'playbackRate') {
            effectValue = parseFloat(effectValue.toFixed(2));
        } else if (effectDetails.unit === '%' || effectDetails.prop === 'blur' || effectDetails.prop === 'hue-rotate') {
            effectValue = Math.round(effectValue);
        } else if (effectDetails.prop === 'volume') {
            effectValue = parseFloat(effectValue.toFixed(2));
        }

        debugLog('Final effect value', {
            effectValue: effectValue,
            mappingRange: [mapping.rangeMin, mapping.rangeMax],
            effectRange: [effectDetails.min, effectDetails.max],
            effectUnit: effectDetails.unit
        });

        return effectValue;
    }

    // NEW: Batch calculation for multiple mappings (performance optimization)
    function calculateMultipleEffectValues(sensorValues, activeMappings) {
        const results = {};
        
        activeMappings.forEach(mapping => {
            if (!mapping.enabled) return;
            
            const sensorValue = sensorValues[mapping.sensorId];
            if (sensorValue !== undefined && sensorValue !== null) {
                results[mapping.effectId] = calculateEffectValue(sensorValue, mapping);
            }
        });
        
        return results;
    }

    // NEW: Validation function for mappings
    function validateMapping(mapping) {
        const sensor = getSensorById(mapping.sensorId);
        const effect = getEffectById(mapping.effectId);
        
        if (!sensor || !effect) {
            return { valid: false, errors: ['Invalid sensor or effect ID'] };
        }

        const errors = [];
        
        // Validate sensitivity
        if (mapping.sensitivity <= 0 || mapping.sensitivity > 10) {
            errors.push('Sensitivity must be between 0.1 and 10');
        }

        // Validate range
        if (mapping.rangeMin >= mapping.rangeMax) {
            errors.push('Range minimum must be less than maximum');
        }

        if (mapping.rangeMin < effect.min || mapping.rangeMax > effect.max) {
            errors.push(`Range must be within effect bounds (${effect.min} - ${effect.max})`);
        }

        return { valid: errors.length === 0, errors };
    }

    // NEW: Debug function to test mapping calculations
    function testMapping(mappingId, testSensorValue) {
        const mapping = getMappingById(mappingId);
        if (!mapping) {
            console.error('Mapping not found:', mappingId);
            return;
        }

        console.log('Testing mapping:', mapping);
        console.log('Test sensor value:', testSensorValue);
        
        const result = calculateEffectValue(testSensorValue, mapping);
        console.log('Result:', result);
        
        return result;
    }

    // NEW: Get mapping statistics
    function getMappingStats() {
        const stats = {
            total: mappings.length,
            active: mappings.filter(m => m.enabled).length,
            bySensor: {},
            byEffect: {}
        };

        mappings.forEach(mapping => {
            // Count by sensor
            if (!stats.bySensor[mapping.sensorId]) {
                stats.bySensor[mapping.sensorId] = 0;
            }
            stats.bySensor[mapping.sensorId]++;

            // Count by effect
            if (!stats.byEffect[mapping.effectId]) {
                stats.byEffect[mapping.effectId] = 0;
            }
            stats.byEffect[mapping.effectId]++;
        });

        return stats;
    }

    // NEW: Enable debug mode
    function enableDebugMode() {
        DEBUG_MODE = true;
        console.log('[MappingManager] Debug mode enabled');
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
        calculateMultipleEffectValues,
        validateMapping,
        testMapping,
        getMappingStats,
        enableDebugMode
    };
})();
