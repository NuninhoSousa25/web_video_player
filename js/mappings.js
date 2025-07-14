// js/mappings.js - Fixed to handle unified effects properly
const Mappings = (function() {
    let playerModuleRef;
    let pointCloudModuleRef;
    let currentModeGetter = () => 'videoPlayer';
    let sensorsModuleRef;

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

            // FIXED: Handle all effect targets properly
            if (effectDetails.target === 'player') {
                if (playerModuleRef) {
                    playerModuleRef.setEffect(effectDetails.id, targetEffectValue);
                    activeMappingApplied = true;
                }
            } else if (effectDetails.target === 'artistic') {
                // FIXED: Artistic effects should also go through player module
                if (playerModuleRef) {
                    playerModuleRef.setEffect(effectDetails.id, targetEffectValue);
                    activeMappingApplied = true;
                }
            } else if (effectDetails.target === 'pointcloud') {
                if (pointCloudModuleRef) {
                    pointCloudModuleRef.setEffect(effectDetails.id, targetEffectValue);
                    activeMappingApplied = true;
                }
            }
        });
        
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
