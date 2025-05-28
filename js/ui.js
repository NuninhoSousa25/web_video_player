// js/ui.js
const UI = (function() {

    function updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, hueSlider,
                                       brightnessValueEl, saturationValueEl, contrastValueEl, hueValueEl) {
        if (brightnessValueEl && brightnessSlider) brightnessValueEl.textContent = `${brightnessSlider.value}%`;
        if (saturationValueEl && saturationSlider) saturationValueEl.textContent = `${saturationSlider.value}%`;
        if (contrastValueEl && contrastSlider) contrastValueEl.textContent = `${contrastSlider.value}%`;
        if (hueValueEl && hueSlider) hueValueEl.textContent = `${hueSlider.value}deg`;
    }

    function updatePointCloudParamDisplays(config, densityValueEl, displacementValueEl, pointSizeValueEl, 
                                           parallaxSensitivityValueEl, pcProcessingValueEl) { // Renamed tiltSensitivityValueEl
        if(densityValueEl) densityValueEl.textContent = config.density;
        if(displacementValueEl) displacementValueEl.textContent = config.displacementScale;
        if(pointSizeValueEl) pointSizeValueEl.textContent = config.pointSize;
        if(parallaxSensitivityValueEl) parallaxSensitivityValueEl.textContent = config.parallaxSensitivity; // Use parallaxSensitivity
        if(pcProcessingValueEl) { 
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
        // This function seems to be unused now based on player.js changes,
        // but keeping it in case it's needed elsewhere or for future refactoring.
        // Player.js now has its own showFullscreenControls method.
        if (fullscreenControlsOverlay.classList.contains('active')) { // Check if it's the video overlay
            clearTimeout(fullscreenControlsOverlay.fsTimeout); // Assuming fsTimeout is set on the element
            fullscreenControlsOverlay.classList.add('active');
            fullscreenControlsOverlay.fsTimeout = setTimeout(() => {
                fullscreenControlsOverlay.classList.remove('active');
            }, 3000);
        }
    }

    function updateActiveMappingIndicators() {
        const activeMappings = MappingManager.getActiveMappings();
        const allDots = document.querySelectorAll('.active-mapping-dot');

        allDots.forEach(dot => dot.classList.remove('active'));

        activeMappings.forEach(mapping => {
            if (mapping.enabled) {
                const dot = document.querySelector(`.active-mapping-dot[data-effect-id="${mapping.effectId}"]`);
                if (dot) {
                    dot.classList.add('active');
                }
            }
        });
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
        updateActiveMappingIndicators 
    };
})();
