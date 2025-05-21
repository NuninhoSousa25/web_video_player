// js/sensors.js
const Sensors = (function() {
    let sensorToggleBtn, orientAlphaEl, orientBetaEl, orientGammaEl, compassNeedle,
        alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider,
        alphaSensValueEl, betaSensValueEl, gammaSensValueEl, smoothingValueEl,
        alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider,
        alphaOffsetValueEl, betaOffsetValueEl, gammaOffsetValueEl,
        calibrateBtn, invertBtn, sensorSectionControls;

    let playerModuleRef; // To be used by calibrate button if needed

    let globallyEnabled = false;
    let permissionGranted = {
        orientation: false,
        motion: false
    };
    
    let latestSensorData = {
        alpha: 0, beta: 0, gamma: 0,
        accelX: 0, accelY: 0, accelZ: 0,
    };

    let calibrationValues = { alpha: 0, beta: 0, gamma: 0 };
    let manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
    let controlsInverted = false;

    let onSensorUpdateCallback = () => {};

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

    function updateConfigDisplay() {
        // Guard against elements not being found, especially if this is called before DOM is fully ready or if elements are removed.
        if (!alphaSensValueEl || !alphaSensitivitySlider || !betaSensValueEl || !betaSensitivitySlider || 
            !gammaSensValueEl || !gammaSensitivitySlider || !smoothingValueEl || !smoothingSlider ||
            !alphaOffsetValueEl || !alphaOffsetSlider || !betaOffsetValueEl || !betaOffsetSlider ||
            !gammaOffsetValueEl || !gammaOffsetSlider) {
            // console.warn("Sensors.updateConfigDisplay: One or more UI elements for sensor config not found.");
            return; 
        }

        alphaSensValueEl.textContent = parseFloat(alphaSensitivitySlider.value).toFixed(1);
        betaSensValueEl.textContent = parseFloat(betaSensitivitySlider.value).toFixed(1);
        gammaSensValueEl.textContent = parseFloat(gammaSensitivitySlider.value).toFixed(1);
        smoothingValueEl.textContent = parseFloat(smoothingSlider.value).toFixed(1);
        
        alphaOffsetValueEl.textContent = `${alphaOffsetSlider.value}°`;
        betaOffsetValueEl.textContent = `${betaOffsetSlider.value}°`;
        gammaOffsetValueEl.textContent = `${gammaOffsetSlider.value}°`;

        manualOffsets.alpha = parseFloat(alphaOffsetSlider.value);
        manualOffsets.beta = parseFloat(betaOffsetSlider.value);
        manualOffsets.gamma = parseFloat(gammaOffsetSlider.value);

        if (globallyEnabled && onSensorUpdateCallback) {
            onSensorUpdateCallback();
        }
    }
    
    function setupEventListeners() {
        if (sensorToggleBtn) sensorToggleBtn.addEventListener('click', () => globallyEnabled ? disable() : enable());

        if (calibrateBtn) {
            calibrateBtn.addEventListener('click', () => {
                if (!globallyEnabled) { alert('Enable sensors first.'); return; }
                
                calibrationValues.alpha = parseFloat(orientAlphaEl ? orientAlphaEl.textContent : '0') || 0;
                calibrationValues.beta = parseFloat(orientBetaEl ? orientBetaEl.textContent : '0') || 0;
                calibrationValues.gamma = parseFloat(orientGammaEl ? orientGammaEl.textContent : '0') || 0;
                
                manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
                if(alphaOffsetSlider) alphaOffsetSlider.value = 0; 
                if(betaOffsetSlider) betaOffsetSlider.value = 0; 
                if(gammaOffsetSlider) gammaOffsetSlider.value = 0;
                updateConfigDisplay();

                alert('Sensors calibrated. Manual offsets reset.');

                if (playerModuleRef && playerModuleRef.resetFilters) {
                     playerModuleRef.resetFilters();
                }
                if (onSensorUpdateCallback) onSensorUpdateCallback();
            });
        }
        
        if (invertBtn) {
            invertBtn.addEventListener('click', () => {
                controlsInverted = !controlsInverted;
                invertBtn.textContent = controlsInverted ? 'Controls Inverted' : 'Invert Controls';
                invertBtn.style.backgroundColor = controlsInverted ? '#f44336' : '#555';
                if (onSensorUpdateCallback) onSensorUpdateCallback();
            });
        }

        const configSliders = [
            alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, 
            smoothingSlider, alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider
        ];

        configSliders.forEach((slider, index) => {
            if (slider) {
                slider.addEventListener('input', updateConfigDisplay);
            } else {
                // For debugging:
                // const sliderNames = ["alphaSensitivitySlider", "betaSensitivitySlider", "gammaSensitivitySlider", "smoothingSlider", "alphaOffsetSlider", "betaOffsetSlider", "gammaOffsetSlider"];
                // console.warn(`Sensor configuration slider "${sliderNames[index]}" not found in the DOM.`);
            }
        });
    }

    function updateSensorDisplay() {
        if(orientAlphaEl) orientAlphaEl.textContent = (latestSensorData.alpha != null ? latestSensorData.alpha.toFixed(2) : '0.00');
        if(orientBetaEl) orientBetaEl.textContent = (latestSensorData.beta != null ? latestSensorData.beta.toFixed(2) : '0.00');
        if(orientGammaEl) orientGammaEl.textContent = (latestSensorData.gamma != null ? latestSensorData.gamma.toFixed(2) : '0.00');
        
        if (compassNeedle) compassNeedle.style.transform = `rotate(${(latestSensorData.alpha || 0)}deg)`;
    }

    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        
        let rawAlpha = event.alpha || 0;
        let rawBeta = event.beta || 0;
        let rawGamma = event.gamma || 0;

        let procAlpha = ((rawAlpha - calibrationValues.alpha - manualOffsets.alpha + 360) % 360);
        let procBeta = rawBeta - calibrationValues.beta - manualOffsets.beta;
        let procGamma = rawGamma - calibrationValues.gamma - manualOffsets.gamma;

        if (controlsInverted) {
            latestSensorData.alpha = (360 - procAlpha + 360) % 360;
            latestSensorData.beta = -procBeta;
            latestSensorData.gamma = -procGamma;
        } else {
            latestSensorData.alpha = procAlpha;
            latestSensorData.beta = procBeta;
            latestSensorData.gamma = procGamma;
        }
        
        updateSensorDisplay();
        if (onSensorUpdateCallback) onSensorUpdateCallback();
    }

    function handleMotionEvent(event) {
        if (!globallyEnabled) return;
        const acc = event.accelerationIncludingGravity;
        const accNoGravity = event.acceleration;

        if (accNoGravity && accNoGravity.x !== null) {
            latestSensorData.accelX = accNoGravity.x;
            latestSensorData.accelY = accNoGravity.y;
            latestSensorData.accelZ = accNoGravity.z;
        } else if (acc && acc.x !== null) {
            latestSensorData.accelX = acc.x;
            latestSensorData.accelY = acc.y;
            latestSensorData.accelZ = acc.z;
        }
        
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
            orientationGranted = true;
        }

        if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
             try {
                const state = await DeviceMotionEvent.requestPermission();
                if (state === 'granted') motionGranted = true;
            } catch (e) { console.warn("Motion permission request failed:", e); }
        } else if ('DeviceMotionEvent' in window) {
            motionGranted = true;
        }
        
        return { orientationGranted, motionGranted };
    }
    
    async function enable() {
        const permissions = await requestSensorPermissions();
        permissionGranted.orientation = permissions.orientationGranted;
        permissionGranted.motion = permissions.motionGranted;

        if (!permissionGranted.orientation && !permissionGranted.motion) {
            alert('Sensor permission denied or not available for orientation and motion.');
            disable();
            return;
        }
        
        if (permissionGranted.orientation) {
            window.addEventListener('deviceorientation', handleOrientationEvent, true); // Added true for capture phase, sometimes helps
        } else {
            console.warn("Device Orientation permission not granted or API not available.");
        }
        if (permissionGranted.motion) {
            window.addEventListener('devicemotion', handleMotionEvent, true); // Added true
        } else {
            console.warn("Device Motion permission not granted or API not available.");
        }
        
        globallyEnabled = true;
        if(sensorToggleBtn) {
            sensorToggleBtn.textContent = 'Disable Sensors';
            sensorToggleBtn.classList.add('active');
        }
    }

    function disable() {
        window.removeEventListener('deviceorientation', handleOrientationEvent, true);
        window.removeEventListener('devicemotion', handleMotionEvent, true);
        globallyEnabled = false;
        if (sensorToggleBtn) {
            sensorToggleBtn.textContent = 'Enable Sensors';
            sensorToggleBtn.classList.remove('active');
        }
        
        latestSensorData = { alpha: 0, beta: 0, gamma: 0, accelX: 0, accelY: 0, accelZ: 0 };
        updateSensorDisplay();
        if (onSensorUpdateCallback) onSensorUpdateCallback();
    }
    
    function init(sensorUpdCb, pModuleRef) {
        onSensorUpdateCallback = sensorUpdCb;
        playerModuleRef = pModuleRef;
        cacheDOMElements();     // Call this first
        setupEventListeners();  // Then this
        updateConfigDisplay();  // Then update displays
        updateSensorDisplay(); 
    }

    function getSensorValue(sensorId) {
        return latestSensorData[sensorId];
    }
    
    function hideControls() { if (sensorSectionControls) sensorSectionControls.classList.add('hidden'); }
    function showControls() { if (sensorSectionControls) sensorSectionControls.classList.remove('hidden'); }

    return {
        init,
        isGloballyEnabled: () => globallyEnabled,
        getSensorValue,
        hideControls, 
        showControls,
    };
})();
