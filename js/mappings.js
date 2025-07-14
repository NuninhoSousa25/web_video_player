// js/mappings.js - Performance optimized version
const Mappings = (function() {
    let playerModuleRef;
    let sensorsModuleRef;
    
    // Performance optimization: throttle UI updates
    let uiUpdateThrottled = null;
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE_MS = 16; // ~60fps max

    function applyAllActiveMappings() {
        const now = performance.now();
        
        // Throttle the entire update cycle
        if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
            return;
        }
        lastUpdateTime = now;

        let activeMappingApplied = false;

        if (!sensorsModuleRef || !sensorsModuleRef.isGloballyEnabled()) {
            if (uiUpdateThrottled) uiUpdateThrottled(); 
            return;
        }

        const activeMappings = MappingManager.getActiveMappings();
        
        // Batch effect updates to minimize DOM manipulation
        const effectUpdates = [];
        
        activeMappings.forEach(mapping => {
            if (!mapping.enabled) return;

            const sensorValue = sensorsModuleRef.getSensorValue(mapping.sensorId);
            if (sensorValue === undefined || sensorValue === null) return; 

            const effectDetails = getEffectById(mapping.effectId);
            if (!effectDetails) return;
            
            const targetEffectValue = MappingManager.calculateEffectValue(sensorValue, mapping);

            // **CRITICAL FIX: Only update if value changed significantly**
            if (!MappingManager.hasValueChanged(mapping.effectId, targetEffectValue)) {
                return; // Skip if value hasn't changed enough
            }

            // Prepare effect update (don't apply immediately)
            effectUpdates.push({
                effectId: effectDetails.id,
                value: targetEffectValue,
                target: effectDetails.target
            });
            
            activeMappingApplied = true;
        });
        
        // Apply all effect updates in batch
        if (effectUpdates.length > 0) {
            effectUpdates.forEach(update => {
                if (playerModuleRef) {
                    // REMOVED: console.log spam
                    playerModuleRef.setEffect(update.effectId, update.value);
                }
            });
            
            // Throttled UI update - only update indicators when something actually changed
            if (uiUpdateThrottled) {
                uiUpdateThrottled();
            }
        }
    }

    function init(player, sensors) {
        playerModuleRef = player;
        sensorsModuleRef = sensors; 
        
        // Create throttled UI update function
        uiUpdateThrottled = throttle(() => {
            if (typeof UI !== 'undefined' && UI.updateActiveMappingIndicators) {
                UI.updateActiveMappingIndicators();
            }
        }, 100); // Update UI at most 10 times per second
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

    return {
        init,
        applyAllActiveMappings 
    };
})();
