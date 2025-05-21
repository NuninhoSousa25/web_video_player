// js/ui.js
const UI = (function() {
    // DOM Elements that are purely for display updates might be cached here
    // or passed into functions. For simplicity, we'll assume they are accessible
    // or passed when needed by other modules.

    function updateFilterDisplayValues(brightnessSlider, saturationSlider, contrastSlider, brightnessValueEl, saturationValueEl, contrastValueEl) {
        brightnessValueEl.textContent = `${brightnessSlider.value}%`;
        saturationValueEl.textContent = `${saturationSlider.value}%`;
        contrastValueEl.textContent = `${contrastSlider.value}%`;
    }

    function updatePointCloudParamDisplays(config, densityValueEl, displacementValueEl, pointSizeValueEl, tiltSensitivityValueEl) {
        densityValueEl.textContent = config.density;
        displacementValueEl.textContent = config.displacementScale;
        pointSizeValueEl.textContent = config.pointSize;
        tiltSensitivityValueEl.textContent = config.tiltSensitivity;
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
         // Removed the "Tilt your device..." instructions
         // You can add new relevant text here if needed, or leave it blank.
         if (sensorMappingInfoEl) {
             sensorMappingInfoEl.innerHTML = ``; // Or some other generic message
         }
    }

    function showVideoFullscreenControlsBriefly(fullscreenControlsOverlay) {
        fullscreenControlsOverlay.classList.add('active');
        setTimeout(() => fullscreenControlsOverlay.classList.remove('active'), 3000);
    }


    return {
        updateFilterDisplayValues,
        updatePointCloudParamDisplays,
        updateSensorConfigDisplayValues,
        updateLoopButton,
        updateLoopInfo,
        updatePlayPauseButtons,
        updateSensorMappingInfoText,
        showVideoFullscreenControlsBriefly
    };
})();
