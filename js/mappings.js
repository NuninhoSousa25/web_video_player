// js/mappings.js
const Mappings = (function() {
    let playerModuleRef;
    let pointCloudModuleRef;
    let currentModeGetter = () => 'videoPlayer';
    let sensorsModuleRef;

    function applyAllActiveMappings() {
        let activeMappingApplied = false; // Flag to see if any mapping was applied

        if (!sensorsModuleRef || !sensorsModuleRef.isGloballyEnabled()) {
            // If sensors are off, just update indicators to show no sensor mappings are active.
            // UI-driven effects will persist.
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

            if (effectDetails.target === 'player' && playerModuleRef) {
                playerModuleRef.setEffect(effectDetails.id, targetEffectValue);
                activeMappingApplied = true;
            } else if (effectDetails.target === 'pointcloud' && pointCloudModuleRef) {
                pointCloudModuleRef.setEffect(effectDetails.id, targetEffectValue);
                activeMappingApplied = true;
            }
        });
        
        // Update indicators after all mappings are processed for this cycle
        // The setEffect methods in player/pointcloud will also call this,
        // but calling it here ensures it runs even if a sensor value didn't change an effect.
        UI.updateActiveMappingIndicators();
    }


    function init(player, pointcloud, sensors, modeGetterFn) {
        playerModuleRef = player;
        pointCloudModuleRef = pointcloud;
        sensorsModuleRef = sensors; 
        currentModeGetter = modeGetterFn;
    }

    return {
        init,
        applyAllActiveMappings 
    };
})();
