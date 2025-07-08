const Mappings = (function() {
    let playerModuleRef;
    let sensorsModuleRef;
    let lastEffectValues = {}; // Track last values to prevent spam

    function applyAllActiveMappings() {
        let activeMappingApplied = false;

        if (!sensorsModuleRef || !sensorsModuleRef.isGloballyEnabled()) {
            UI.updateActiveMappingIndicators(); 
            return;
        }

        const activeMappings = MappingManager.getActiveMappings();
        
        activeMappings.forEach(mapping => {
            if (!mapping.enabled) return;

            const sensorValue = sensorsModuleRef.getSensorValue(mapping.sensorId);
            if (sensorValue === undefined || sensorValue === null) return; 

            const effectDetails = getEffectById(mapping.effectId);
            if (!effectDetails) return;
            
            const targetEffectValue = MappingManager.calculateEffectValue(sensorValue, mapping);

            // **FIX: Only update if value actually changed**
            const effectKey = `${mapping.effectId}`;
            const lastValue = lastEffectValues[effectKey];
            
            if (lastValue !== undefined && Math.abs(lastValue - targetEffectValue) < 0.1) {
                return; // Skip if value hasn't changed significantly
            }
            
            lastEffectValues[effectKey] = targetEffectValue;

            // Handle video effects (both standard and artistic)
            if (effectDetails.target === 'player' || effectDetails.target === 'artistic') {
                if (playerModuleRef) {
                    playerModuleRef.setEffect(effectDetails.id, targetEffectValue);
                    activeMappingApplied = true;
                }
            } else {
                console.warn(`Unknown effect target: ${effectDetails.target} for effect: ${effectDetails.id}`);
            }
        });
        
        // Only update indicators if something actually changed
        if (activeMappingApplied) {
            UI.updateActiveMappingIndicators();
        }
    }

    function init(player, sensors) {
        playerModuleRef = player;
        sensorsModuleRef = sensors; 
    }

    return {
        init,
        applyAllActiveMappings 
    };
})();
