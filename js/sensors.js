// js/sensors.js
const Sensors = (function() {
    let sensorToggleBtn, orientAlphaEl, orientBetaEl, orientGammaEl, compassNeedle,
        alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider,
        alphaSensValueEl, betaSensValueEl, gammaSensValueEl, smoothingValueEl,
        alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider,
        alphaOffsetValueEl, betaOffsetValueEl, gammaOffsetValueEl,
        calibrateBtn, invertBtn, sensorSectionControls;;

     let globallyEnabled = false;
    let permissionGranted = {
        orientation: false,
        motion: false
    };
    // ... (calibrationValues, manualOffsets, controlsInverted stay)
    
    let latestSensorData = {
        alpha: 0, beta: 0, gamma: 0,
        accelX: 0, accelY: 0, accelZ: 0,
        // rawAccelX:0, rawAccelY:0, rawAccelZ:0, // If you need raw + gravity-compensated
    };

    // No longer directly calls Mappings.processOrientation
    // let onOrientationChangeCallback = (alpha, beta, gamma, accelData, sensorParams, sensorsAreOff) => {};
    let onSensorUpdateCallback = () => {}; // Generic callback when any sensor data is updated. Mappings.js will listen.

    function cacheDOMElements() {
        sensorToggleBtn = document.getElementById('sensorToggleBtn');
        orientAlphaEl = document.getElementById('orientAlpha');
        orientBetaEl = document.getElementById('orientBeta');
        orientGammaEl = document.getElementById('orientGamma');
        compassNeedle = document.getElementById('compassNeedle');
        alphaSensitivitySlider = document.getElementById('alphaSensitivitySlider');
        betaSensitivitySlider = document.getElementById('betaSensitivitySlider');
        gammaSensitivitySlider = document.getElementById('gammaSensitivitySlider');
        smoothingSlider = document.getElementById('smoothingSlider');
        alphaSensValueEl = document.getElementById('alphaSensValue');
        betaSensValueEl = document.getElementById('betaSensValue');
        gammaSensValueEl = document.getElementById('gammaSensValue');
        smoothingValueEl = document.getElementById('smoothingValue');
        alphaOffsetSlider = document.getElementById('alphaOffsetSlider');
        betaOffsetSlider = document.getElementById('betaOffsetSlider');
        gammaOffsetSlider = document.getElementById('gammaOffsetSlider');
        alphaOffsetValueEl = document.getElementById('alphaOffsetValue');
        betaOffsetValueEl = document.getElementById('betaOffsetValue');
        gammaOffsetValueEl = document.getElementById('gammaOffsetValue');
        calibrateBtn = document.getElementById('calibrateBtn');
        invertBtn = document.getElementById('invertBtn');
         sensorSectionControls = document.getElementById('sensorSectionControls'); 
    }

    function updateSensorDisplay() { // New generic display updater
        orientAlphaEl.textContent = (latestSensorData.alpha != null ? latestSensorData.alpha.toFixed(2) : '0.00');
        orientBetaEl.textContent = (latestSensorData.beta != null ? latestSensorData.beta.toFixed(2) : '0.00');
        orientGammaEl.textContent = (latestSensorData.gamma != null ? latestSensorData.gamma.toFixed(2) : '0.00');
        if (compassNeedle) compassNeedle.style.transform = `rotate(${(latestSensorData.alpha || 0)}deg)`;
        // Add accelX, Y, Z display updates here if you add HTML elements for them
    }

    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        const { alpha, beta, gamma } = event;

        // Apply calibration and manual offsets for orientation
        latestSensorData.alpha = (( (alpha || 0) - calibrationValues.alpha - manualOffsets.alpha + 360) % 360);
        latestSensorData.beta = (beta || 0) - calibrationValues.beta - manualOffsets.beta;
        latestSensorData.gamma = (gamma || 0) - calibrationValues.gamma - manualOffsets.gamma;

        if (controlsInverted) {
            latestSensorData.alpha = (360 - latestSensorData.alpha + 360) % 360;
            latestSensorData.beta = -latestSensorData.beta;
            latestSensorData.gamma = -latestSensorData.gamma;
        }
        
        updateSensorDisplay();
        if (onSensorUpdateCallback) onSensorUpdateCallback();
    }

    function handleMotionEvent(event) {
        if (!globallyEnabled) return;
        const acc = event.accelerationIncludingGravity; // For raw data
        const accNoGravity = event.acceleration; // For processed data (if available)

        if (accNoGravity && accNoGravity.x !== null) {
            latestSensorData.accelX = accNoGravity.x;
            latestSensorData.accelY = accNoGravity.y;
            latestSensorData.accelZ = accNoGravity.z;
        } else if (acc && acc.x !== null) {
            // Fallback or if you want to handle gravity yourself (more complex)
            // For simplicity, we'll just use whatever is available.
            // This might not be ideal if accNoGravity isn't well supported or if gravity is needed for some calculation
            latestSensorData.accelX = acc.x;
            latestSensorData.accelY = acc.y;
            latestSensorData.accelZ = acc.z; // This will include gravity, especially on Z
        }
        // No calibration/offsets for acceleration in this simple example
        // updateSensorDisplay(); // Already called by handleOrientationEvent if it also fires
        if (onSensorUpdateCallback) onSensorUpdateCallback();
    }
    
    async function requestSensorPermissions() {
        let orientationGranted = false;
        let motionGranted = false;

        if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
            try {
                const state = await DeviceOrientationEvent.requestPermission();
                if (state === 'granted') orientationGranted = true;
            } catch (e) { console.warn("Orientation permission request failed:", e); }
        } else if ('DeviceOrientationEvent' in window) {
            orientationGranted = true; // Assume granted for older browsers/Android
        }

        if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
             try {
                const state = await DeviceMotionEvent.requestPermission();
                if (state === 'granted') motionGranted = true;
            } catch (e) { console.warn("Motion permission request failed:", e); }
        } else if ('DeviceMotionEvent' in window) {
            motionGranted = true; // Assume granted
        }
        
        return { orientationGranted, motionGranted };
    }
    
    async function enable() {
        const permissions = await requestSensorPermissions();
        permissionGranted.orientation = permissions.orientationGranted;
        permissionGranted.motion = permissions.motionGranted;

        if (!permissionGranted.orientation && !permissionGranted.motion) {
            alert('Motion sensor permission denied or not available.');
            disable(); // Ensure state is reset
            return;
        }
        
        if (permissionGranted.orientation) {
            window.addEventListener('deviceorientation', handleOrientationEvent);
        }
        if (permissionGranted.motion) {
            window.addEventListener('devicemotion', handleMotionEvent);
        }
        
        globallyEnabled = true;
        sensorToggleBtn.textContent = 'Disable Sensors';
        sensorToggleBtn.classList.add('active');
    }

    function disable() {
        window.removeEventListener('deviceorientation', handleOrientationEvent);
        window.removeEventListener('devicemotion', handleMotionEvent);
        globallyEnabled = false;
        sensorToggleBtn.textContent = 'Enable Sensors';
        sensorToggleBtn.classList.remove('active');
        
        // Reset latest data to avoid stale values being used if re-enabled
        latestSensorData = { alpha: 0, beta: 0, gamma: 0, accelX: 0, accelY: 0, accelZ: 0 };
        updateSensorDisplay();
        if (onSensorUpdateCallback) onSensorUpdateCallback(); // Notify that sensors are off / values reset
    }
    
    // ... (calibrateBtn, invertBtn, updateConfigDisplay event listeners remain similar)
    // Modify calibrateBtn to also reset latestSensorData for display
    calibrateBtn.addEventListener('click', () => {
        if (!globallyEnabled) { alert('Enable sensors first.'); return; }
        // Read from CURRENT display values (which are raw before calibration)
        calibrationValues.alpha = parseFloat(orientAlphaEl.textContent) || 0;
        calibrationValues.beta = parseFloat(orientBetaEl.textContent) || 0;
        calibrationValues.gamma = parseFloat(orientGammaEl.textContent) || 0;
        
        manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
        alphaOffsetSlider.value = 0; betaOffsetSlider.value = 0; gammaOffsetSlider.value = 0;
        updateConfigDisplay(); // This updates manualOffsets state too

        // After calibration, the current `latestSensorData` should reflect 0,0,0 (or close) for orientation
        // So, re-evaluate latestSensorData based on new calibration.
        // Or, simpler: just tell Mappings.js things have changed.
        // For now, assume the next sensor event will provide the calibrated values.
        // Resetting filters in Player should be done by Mappings.js if a mapping targets them and gets reset.
        
        alert('Sensors calibrated. Manual offsets reset.');
        if (playerModuleRef && playerModuleRef.resetFilters) {
            // Check if any current mapping involves player filters and reset them
            // This is now more complex. The individual filter sliders are less "master".
            // Perhaps remove this direct call and let mappings handle it.
            // For now, let's keep it if the old UI for filters is still primary.
             playerModuleRef.resetFilters();
        }
        // This is crucial: force an update so mappings can react to calibration
        if (onSensorUpdateCallback) onSensorUpdateCallback();
    });

      function init(sensorUpdateCb, playerRef) { // playerRef for calibrateBtn's filter reset
        onSensorUpdateCallback = sensorUpdateCb;
        playerModuleRef = playerRef;
        cacheDOMElements();
        setupEventListeners(); // Ensure this is defined and sets up all sensor UI controls
        updateConfigDisplay(); // Initial display for sensitivity/offset sliders
        updateSensorDisplay(); // Initial display for alpha/beta/gamma etc.
    }

    function getSensorValue(sensorId) {
        // The values in latestSensorData for alpha, beta, gamma are already calibrated and offset.
        return latestSensorData[sensorId];
    }
    
    function hideControls() { if (sensorSectionControls) sensorSectionControls.classList.add('hidden'); }
    function showControls() { if (sensorSectionControls) sensorSectionControls.classList.remove('hidden'); }


    // Public API
    return {
        init,
        isGloballyEnabled: () => globallyEnabled,
        getSensorValue,
        // Expose these if main.js needs to control their visibility based on mode
        hideControls, 
        showControls,
        // Expose calibration/inversion settings if Mappings.js needs them directly
        // Though it's better if getSensorValue returns fully processed values
        // getCalibration: () => ({...calibrationValues}),
        // getManualOffsets: () => ({...manualOffsets}),
        // getInversionState: () => controlsInverted
    };
})();
