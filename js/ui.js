
// js/ui.js
const UI = (function() {

    // Removed: updateFilterDisplayValues (video filters removed from UI)
    // Removed: updateSensorConfigDisplayValues (sensor config removed from UI)
    // Removed: updateLoopInfo (loop info text removed from UI)
    // Removed: showVideoFullscreenControlsBriefly (handled internally by Player now)

    function updatePointCloudParamDisplays(config, densityValueEl, displacementValueEl, pointSizeValueEl, 
                                           parallaxSensitivityValueEl, pcProcessingValueEl) { 
        if(densityValueEl) densityValueEl.textContent = config.density;
        if(displacementValueEl) displacementValueEl.textContent = config.displacementScale;
        if(pointSizeValueEl) pointSizeValueEl.textContent = config.pointSize;
        if(parallaxSensitivityValueEl) parallaxSensitivityValueEl.textContent = config.parallaxSensitivity; 
        if(pcProcessingValueEl) { 
            const selectedOption = document.getElementById('pcProcessingResolutionSlider')?.selectedOptions[0];
            pcProcessingValueEl.textContent = selectedOption ? selectedOption.text.split(' ')[0] : config.maxProcessingDimension + 'px';
        }
    }
    
    function updateLoopButton(loopBtn, isLooping) {
        loopBtn.textContent = isLooping ? 'Loop: ON' : 'Loop: OFF';
    }

    function updatePlayPauseButtons(playPauseBtn, playPauseFullscreenBtn, isPlaying) {
        const text = isPlaying ? 'Pause' : 'Play';
        if (playPauseBtn) playPauseBtn.textContent = text;
        if (playPauseFullscreenBtn) playPauseFullscreenBtn.textContent = text;
    }
    
    // Removed updateSensorMappingInfoText as its content is now static in main.js or removed.

    function updateActiveMappingIndicators() {
        // This function now depends on App.player and App.pointcloud to check if effects are active
        // This requires `App` to be initialized and modules to be accessible,
        // which `main.js` does by exposing them in its return.
        
        const activeMappings = MappingManager.getActiveMappings();
        const allDots = document.querySelectorAll('.active-mapping-dot');

        allDots.forEach(dot => dot.classList.remove('active'));

        activeMappings.forEach(mapping => {
            if (mapping.enabled) {
                const effectDetails = getEffectById(mapping.effectId);
                let isActive = false;
                
                if (effectDetails.target === 'player' && App.player) {
                    isActive = App.player.isEffectActive(mapping.effectId);
                } else if (effectDetails.target === 'pointcloud' && App.pointcloud) {
                    isActive = App.pointcloud.isEffectActive(mapping.effectId);
                }

                if (isActive) {
                    const dot = document.querySelector(`.active-mapping-dot[data-effect-id="${mapping.effectId}"]`);
                    if (dot) {
                        dot.classList.add('active');
                    }
                }
            }
        });
    }


    return {
        updatePointCloudParamDisplays,
        updateLoopButton,
        updatePlayPauseButtons,
        updateActiveMappingIndicators 
    };
})();
