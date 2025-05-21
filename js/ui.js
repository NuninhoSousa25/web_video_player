// js/ui.js
const UI = (function() {

    function updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, hueSlider, // Added hueSlider
                                       brightnessValueEl, saturationValueEl, contrastValueEl, hueValueEl) { // Added hueValueEl
        if (brightnessValueEl && brightnessSlider) brightnessValueEl.textContent = `${brightnessSlider.value}%`;
        if (saturationValueEl && saturationSlider) saturationValueEl.textContent = `${saturationSlider.value}%`;
        if (contrastValueEl && contrastSlider) contrastValueEl.textContent = `${contrastSlider.value}%`;
        if (hueValueEl && hueSlider) hueValueEl.textContent = `${hueSlider.value}deg`; // Update for hue
    }

    function updatePointCloudParamDisplays(config, densityValueEl, displacementValueEl, pointSizeValueEl, 
                                           tiltSensitivityValueEl, pcProcessingValueEl) { // Added pcProcessingValueEl
        if(densityValueEl) densityValueEl.textContent = config.density;
        if(displacementValueEl) displacementValueEl.textContent = config.displacementScale;
        if(pointSizeValueEl) pointSizeValueEl.textContent = config.pointSize;
        if(tiltSensitivityValueEl) tiltSensitivityValueEl.textContent = config.tiltSensitivity;
        if(pcProcessingValueEl) { // Update processing resolution display
            const selectedOption = document.getElementById('pcProcessingResolutionSlider')?.selectedOptions[0];
            pcProcessingValueEl.textContent = selectedOption ? selectedOption.text.split(' ')[0] : config.maxProcessingDimension + 'px';
        }
    }
    
    function updateSensorConfigDisplayValues(sliders, values) {
        values.alphaSens.textContent = parseFloat(sliders.alphaSensitivity.value).toFixed(1);
        values.betaSens.textContent = parseFloat(sliders.betaSensitivity.value).toFixed(1);
        values.gammaSens.textContent = parseFloat(sliders.gammaSensitivity.value).toFixed(1);
        values.smoothing.textContent = parseFloat(sliders.smoothing.value).toFixed(1);
        values.alphaOffset.textContent = `${sliders.alphaOffset.value}°`;
        values.betaOffset.textContent = `${sliders.betaOffset.value}°`;
        values.gammaOffset.textContent = `${sliders.gammaOffset.value}°`;
    }

    function updateLoopButton(loopBtn, isLooping) {
        loopBtn.textContent = isLooping ? 'Loop: ON' : 'Loop: OFF';
    }

    function updateLoopInfo(loopInfoEl, videoPlayer, loopCount) {
        loopInfoEl.textContent = videoPlayer.loop ? `Looped ${loopCount} time${loopCount === 1 ? '' : 's'}` : '';
    }

    function updatePlayPauseButtons(playPauseBtn, playPauseFullscreenBtn, isPlaying) {
        const text = isPlaying ? 'Pause' : 'Play';
        if (playPauseBtn) playPauseBtn.textContent = text;
        if (playPauseFullscreenBtn) playPauseFullscreenBtn.textContent = text;
    }
    
    function updateSensorMappingInfoText(sensorMappingInfoEl, currentMode) {
         if (sensorMappingInfoEl) {
             sensorMappingInfoEl.innerHTML = ``; 
         }
    }

    function showVideoFullscreenControlsBriefly(fullscreenControlsOverlay) {
        fullscreenControlsOverlay.classList.add('active');
        setTimeout(() => fullscreenControlsOverlay.classList.remove('active'), 3000);
    }

    // NEW: Function to update visual indicators for active mappings
    function updateActiveMappingIndicators() {
        const activeMappings = MappingManager.getActiveMappings();
        const allDots = document.querySelectorAll('.active-mapping-dot');

        // Reset all dots
        allDots.forEach(dot => dot.classList.remove('active'));

        // Activate dots for currently mapped and enabled effects
        activeMappings.forEach(mapping => {
            if (mapping.enabled) {
                const dot = document.querySelector(`.active-mapping-dot[data-effect-id="${mapping.effectId}"]`);
                if (dot) {
                    dot.classList.add('active');
                }
            }
        });

        // Also consider effects directly manipulated by UI (not by sensors)
        // This part could be expanded if you want dots for non-default UI slider values too
        // For now, this focuses on sensor-driven mappings.
    }


    return {
        updateFilterDisplayValues,
        updatePointCloudParamDisplays,
        updateSensorConfigDisplayValues,
        updateLoopButton,
        updateLoopInfo,
        updatePlayPauseButtons,
        updateSensorMappingInfoText,
        showVideoFullscreenControlsBriefly,
        updateActiveMappingIndicators // Expose new function
    };
})();
