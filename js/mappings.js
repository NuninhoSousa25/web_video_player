// js/mappings.js
const Mappings = (function() {
    let playerModuleRef;
    let pointCloudModuleRef;
    let currentModeGetter = () => 'videoPlayer';

    function mapOrientationInput(rawAlpha, rawBeta, rawGamma, sensorParams, sensorsAreOff = false) {
        if (sensorsAreOff) {
            // If sensors are turned off, reset point cloud tilt
            if (pointCloudModuleRef) pointCloudModuleRef.updateTiltAngles(0, 0);
            // Optionally, you could reset video filters to default here if desired,
            // but the current logic seems to keep them as they were.
            return;
        }

        const effectiveAlpha = ((rawAlpha - sensorParams.calibration.alpha - sensorParams.manual.alpha + 360) % 360);
        let effectiveBeta = rawBeta - sensorParams.calibration.beta - sensorParams.manual.beta;
        let effectiveGamma = rawGamma - sensorParams.calibration.gamma - sensorParams.manual.gamma;

        const finalAlpha = sensorParams.inverted ? (360 - effectiveAlpha + 360) % 360 : effectiveAlpha;
        let finalBeta = sensorParams.inverted ? -effectiveBeta : effectiveBeta;
        let finalGamma = sensorParams.inverted ? -effectiveGamma : effectiveGamma;
        
        if (currentModeGetter() === 'videoPlayer' && playerModuleRef) {
            const { brightnessSlider, saturationSlider, contrastSlider } = playerModuleRef.getFilterSliderElements();
            const lastFilters = playerModuleRef.getLastFilterValues(); // For smoothing

            const alphaNormalized = ((finalAlpha + 180) % 360) - 180; // -180 to 180
            let newSaturation = 100 + Math.round((alphaNormalized * sensorParams.sensitivities.alpha) / 180 * 75); 
            let newBrightness = 100 + Math.round((finalBeta * sensorParams.sensitivities.beta) / 90 * 75); 
            let newContrast = 100 + Math.round((finalGamma * sensorParams.sensitivities.gamma) / 90 * 75);    

            newSaturation = Math.max(25, Math.min(200, newSaturation));
            newBrightness = Math.max(25, Math.min(200, newBrightness));
            newContrast = Math.max(25, Math.min(200, newContrast));
            
            // Apply smoothing and update slider values
            // Note: This will trigger the 'input' event on sliders, which in Player.js will call applyVideoFilters
            brightnessSlider.value = Utils.applySmoothing(parseFloat(lastFilters.brightness), newBrightness, sensorParams.smoothingFactor);
            saturationSlider.value = Utils.applySmoothing(parseFloat(lastFilters.saturation), newSaturation, sensorParams.smoothingFactor);
            contrastSlider.value = Utils.applySmoothing(parseFloat(lastFilters.contrast), newContrast, sensorParams.smoothingFactor);
            
            // Trigger input event manually if direct value setting doesn't, or rely on Player.js's listeners.
            // For robustness, explicit update can be good.
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            brightnessSlider.dispatchEvent(inputEvent);
            saturationSlider.dispatchEvent(inputEvent);
            contrastSlider.dispatchEvent(inputEvent);
            // UI.updateFilterDisplayValues() will be called by Player.js's slider input listeners.
            // Player.applyVideoFilters() will also be called.

        } else if (currentModeGetter() === 'pointCloud' && pointCloudModuleRef) {
            pointCloudModuleRef.updateTiltAngles(finalBeta, finalGamma);
        }
    }

    function init(player, pointcloud, modeGetterFn) {
        playerModuleRef = player;
        pointCloudModuleRef = pointcloud;
        currentModeGetter = modeGetterFn;
    }

    // Public API
    return {
        init,
        processOrientation: mapOrientationInput
    };
})();
