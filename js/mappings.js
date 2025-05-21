// js/mappings.js
const Mappings = (function() {
    let playerModuleRef;
    let pointCloudModuleRef;
    let currentModeGetter = () => 'videoPlayer';
    let sensorsModuleRef;

    // This function will be called by Sensors.js whenever sensor data updates
    function applyAllActiveMappings() {
        if (!sensorsModuleRef || !sensorsModuleRef.isGloballyEnabled()) {
            // If sensors are off, consider resetting effects to their defaults or last user-set values
            // For now, we'll just not apply any sensor-driven changes.
            // Player filters might still be user-controlled via sliders.
            return;
        }

        const activeMappings = MappingManager.getActiveMappings();
        
        activeMappings.forEach(mapping => {
            if (!mapping.enabled) return;

            const sensorValue = sensorsModuleRef.getSensorValue(mapping.sensorId);
            if (sensorValue === undefined || sensorValue === null) return; // Sensor data not available

            const effectDetails = getEffectById(mapping.effectId);
            if (!effectDetails) return;
            
            // Calculate the target value for the effect
            const targetEffectValue = MappingManager.calculateEffectValue(sensorValue, mapping);

            // Apply the effect
            if (effectDetails.target === 'player' && playerModuleRef) {
                playerModuleRef.setEffect(effectDetails.id, targetEffectValue);
            } else if (effectDetails.target === 'pointcloud' && pointCloudModuleRef) {
                pointCloudModuleRef.setEffect(effectDetails.id, targetEffectValue);
            }
        });
    }


    function init(player, pointcloud, sensors, modeGetterFn) {
        playerModuleRef = player;
        pointCloudModuleRef = pointcloud;
        sensorsModuleRef = sensors; // Store reference to Sensors module
        currentModeGetter = modeGetterFn;
        // `Sensors.js` will call `applyAllActiveMappings` via the callback
    }

    // Public API
    return {
        init,
        applyAllActiveMappings // This is the key function now
    };
})();
