// js/sensors.js
const Sensors = (function() {
    let sensorToggleBtn, orientAlphaEl, orientBetaEl, orientGammaEl, compassNeedle,
        alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider,
        alphaSensValueEl, betaSensValueEl, gammaSensValueEl, smoothingValueEl,
        alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider,
        alphaOffsetValueEl, betaOffsetValueEl, gammaOffsetValueEl,
        calibrateBtn, invertBtn;

    let globallyEnabled = false;
    let permissionGranted = false;
    let controlsInverted = false;
    let calibrationValues = { alpha: 0, beta: 0, gamma: 0 };
    let manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
    
    // Callback for when orientation changes, to be set by Mappings.js
    let onOrientationChangeCallback = (alpha, beta, gamma) => {}; 
    let playerModuleRef; // To reset filters on calibrate

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
    }

    function updateConfigDisplay() {
        UI.updateSensorConfigDisplayValues(
            { 
                alphaSensitivity: alphaSensitivitySlider, betaSensitivity: betaSensitivitySlider, gammaSensitivity: gammaSensitivitySlider, 
                smoothing: smoothingSlider, alphaOffset: alphaOffsetSlider, betaOffset: betaOffsetSlider, gammaOffset: gammaOffsetSlider 
            },
            { 
                alphaSens: alphaSensValueEl, betaSens: betaSensValueEl, gammaSens: gammaSensValueEl, 
                smoothing: smoothingValueEl, alphaOffset: alphaOffsetValueEl, betaOffset: betaOffsetValueEl, gammaOffset: gammaOffsetValueEl 
            }
        );
        manualOffsets.alpha = parseFloat(alphaOffsetSlider.value);
        manualOffsets.beta = parseFloat(betaOffsetSlider.value);
        manualOffsets.gamma = parseFloat(gammaOffsetSlider.value);
    }

    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        const { alpha, beta, gamma } = event;
        if (alpha == null || beta == null || gamma == null) return;

        orientAlphaEl.textContent = (alpha != null ? alpha.toFixed(2) : '0.00');
        orientBetaEl.textContent = (beta != null ? beta.toFixed(2) : '0.00');
        orientGammaEl.textContent = (gamma != null ? gamma.toFixed(2) : '0.00');
        if (compassNeedle) compassNeedle.style.transform = `rotate(${(alpha || 0)}deg)`;
        
        // Pass raw values to Mappings module
        onOrientationChangeCallback(alpha || 0, beta || 0, gamma || 0, {
            calibration: calibrationValues,
            manual: manualOffsets,
            inverted: controlsInverted,
            sensitivities: { 
                alpha: parseFloat(alphaSensitivitySlider.value),
                beta: parseFloat(betaSensitivitySlider.value),
                gamma: parseFloat(gammaSensitivitySlider.value)
            },
            smoothingFactor: parseFloat(smoothingSlider.value)
        });
    }
    
    function enable() {
        if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientationEvent);
                        permissionGranted = true;
                        globallyEnabled = true;
                        sensorToggleBtn.textContent = 'Disable Sensors';
                        sensorToggleBtn.classList.add('active');
                    } else {
                        alert('Motion sensor permission denied.');
                        disable();
                    }
                }).catch(err => {
                     console.error("Sensor permission error:", err);
                     alert('Error requesting sensor permissions.');
                     disable();
                });
        } else if ('DeviceOrientationEvent' in window) {
            window.addEventListener('deviceorientation', handleOrientationEvent);
            permissionGranted = true;
            globallyEnabled = true;
            sensorToggleBtn.textContent = 'Disable Sensors';
            sensorToggleBtn.classList.add('active');
        } else {
            alert('Device orientation not supported on your device.');
            sensorToggleBtn.textContent = 'Not Supported';
            sensorToggleBtn.disabled = true;
        }
    }

    function disable() {
        window.removeEventListener('deviceorientation', handleOrientationEvent);
        globallyEnabled = false;
        sensorToggleBtn.textContent = 'Enable Sensors';
        sensorToggleBtn.classList.remove('active');
        // Notify PointCloud or Mappings to reset tilt if sensors off
        if (onOrientationChangeCallback) {
             onOrientationChangeCallback(0,0,0, { // Send neutral values
                calibration: {alpha:0, beta:0, gamma:0},
                manual: {alpha:0, beta:0, gamma:0},
                inverted: false,
                sensitivities: { alpha: 1, beta: 1, gamma: 1},
                smoothingFactor: 0
            }, true); // Pass a flag indicating sensors are off
        }
    }

    function setupEventListeners() {
        sensorToggleBtn.addEventListener('click', () => globallyEnabled ? disable() : enable());

        [alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider, 
         alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider].forEach(slider => {
            slider.addEventListener('input', updateConfigDisplay);
        });

        calibrateBtn.addEventListener('click', () => {
            if (!globallyEnabled) { alert('Enable sensors first.'); return; }
            calibrationValues.alpha = parseFloat(orientAlphaEl.textContent) || 0;
            calibrationValues.beta = parseFloat(orientBetaEl.textContent) || 0;
            calibrationValues.gamma = parseFloat(orientGammaEl.textContent) || 0;
            
            manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
            alphaOffsetSlider.value = 0; betaOffsetSlider.value = 0; gammaOffsetSlider.value = 0;
            updateConfigDisplay();

            alert('Sensors calibrated. Manual offsets reset.');
            if (playerModuleRef) playerModuleRef.resetFilters(); 
            // Mappings module will pick up new calibration & reset relevant state
        });
        
        invertBtn.addEventListener('click', () => {
            controlsInverted = !controlsInverted;
            invertBtn.textContent = controlsInverted ? 'Controls Inverted' : 'Invert Controls';
            invertBtn.style.backgroundColor = controlsInverted ? '#f44336' : '#555';
        });
    }

    function init(orientationCb, playerRef) {
        onOrientationChangeCallback = orientationCb;
        playerModuleRef = playerRef;
        cacheDOMElements();
        setupEventListeners();
        updateConfigDisplay(); // Initial display
    }

    return {
        init,
        isGloballyEnabled: () => globallyEnabled
    };
})();
