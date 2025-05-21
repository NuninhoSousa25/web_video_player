/**
 * Enhanced Sensor Video Processor - Sensors Module
 * Handles sensor detection, calibration, and processing
 */

// Sensor state variables
let sensorsGloballyEnabled = false;
let deviceOrientationPermissionGranted = false;
let controlsInverted = false;
let calibrationValues = { alpha: 0, beta: 0, gamma: 0 };
let manualOffsets = { alpha: 0, beta: 0, gamma: 0 }; 
let sensorValues = {
    alpha: 0,
    beta: 0,
    gamma: 0,
    mic: 0,
    light: 0,
    accelX: 0,
    accelY: 0,
    accelZ: 0
};

// Audio and sensor related variables
let microphoneStream = null;
let audioContext = null;
let analyser = null;
let audioDataArray = null;
let lightSensorSupported = false;
let currentLightLevel = null;

// Testing mode variables
let testingModeEnabled = false;

// DOM elements
let sensorToggleBtn;
let orientAlpha;
let orientBeta;
let orientGamma;
let compassNeedle;
let alphaSensitivitySlider;
let betaSensitivitySlider;
let gammaSensitivitySlider;
let smoothingSlider;
let alphaSensValue;
let betaSensValue;
let gammaSensValue;
let smoothingValue;
let alphaOffsetSlider;
let betaOffsetSlider;
let gammaOffsetSlider;
let alphaOffsetValue;
let betaOffsetValue;
let gammaOffsetValue;
let calibrateBtn;
let invertBtn;
let testingModeToggle;
let testingControls;
let testAlphaSlider;
let testBetaSlider;
let testGammaSlider;
let testMicSlider;
let testLightSlider;
let testAccelXSlider;
let micLevelValue;
let micLevelBar;
let lightLevelValue;

// Initialize the sensors module
function initializeSensors() {
    // Get DOM elements
    sensorToggleBtn = utils.getElement('sensorToggleBtn');
    orientAlpha = utils.getElement('orientAlpha');
    orientBeta = utils.getElement('orientBeta');
    orientGamma = utils.getElement('orientGamma');
    compassNeedle = utils.getElement('compassNeedle');
    alphaSensitivitySlider = utils.getElement('alphaSensitivitySlider');
    betaSensitivitySlider = utils.getElement('betaSensitivitySlider');
    gammaSensitivitySlider = utils.getElement('gammaSensitivitySlider');
    smoothingSlider = utils.getElement('smoothingSlider');
    alphaSensValue = utils.getElement('alphaSensValue');
    betaSensValue = utils.getElement('betaSensValue');
    gammaSensValue = utils.getElement('gammaSensValue');
    smoothingValue = utils.getElement('smoothingValue');
    alphaOffsetSlider = utils.getElement('alphaOffsetSlider');
    betaOffsetSlider = utils.getElement('betaOffsetSlider');
    gammaOffsetSlider = utils.getElement('gammaOffsetSlider');
    alphaOffsetValue = utils.getElement('alphaOffsetValue');
    betaOffsetValue = utils.getElement('betaOffsetValue');
    gammaOffsetValue = utils.getElement('gammaOffsetValue');
    calibrateBtn = utils.getElement('calibrateBtn');
    invertBtn = utils.getElement('invertBtn');
    testingModeToggle = utils.getElement('testingModeToggle');
    testingControls = utils.getElement('testingControls');
    testAlphaSlider = utils.getElement('testAlphaSlider');
    testBetaSlider = utils.getElement('testBetaSlider');
    testGammaSlider = utils.getElement('testGammaSlider');
    testMicSlider = utils.getElement('testMicSlider');
    testLightSlider = utils.getElement('testLightSlider');
    testAccelXSlider = utils.getElement('testAccelXSlider');
    micLevelValue = utils.getElement('micLevelValue');
    micLevelBar = utils.getElement('micLevelBar');
    lightLevelValue = utils.getElement('lightLevelValue');

    // Set up event listeners
    sensorToggleBtn.addEventListener('click', () => sensorsGloballyEnabled ? disableSensors() : setupSensors());
    
    calibrateBtn.addEventListener('click', calibrateSensors);
    invertBtn.addEventListener('click', toggleInvertControls);

    alphaSensitivitySlider.addEventListener('input', updateSensorConfigDisplayValues);
    betaSensitivitySlider.addEventListener('input', updateSensorConfigDisplayValues);
    gammaSensitivitySlider.addEventListener('input', updateSensorConfigDisplayValues);
    smoothingSlider.addEventListener('input', updateSensorConfigDisplayValues);
    alphaOffsetSlider.addEventListener('input', updateSensorConfigDisplayValues);
    betaOffsetSlider.addEventListener('input', updateSensorConfigDisplayValues);
    gammaOffsetSlider.addEventListener('input', updateSensorConfigDisplayValues);

    // Testing mode events
    testingModeToggle.addEventListener('click', toggleTestingMode);
    
    // Test slider events
    [testAlphaSlider, testBetaSlider, testGammaSlider, testMicSlider, testLightSlider, testAccelXSlider].forEach(slider => {
        slider.addEventListener('input', () => {
            if (testingModeEnabled) {
                window.mappings.applyAllSensorMappings();
            }
        });
    });
    
    // Check sensor support
    checkSensorSupport();
    
    // Initialize displays
    updateSensorConfigDisplayValues();
}

// Check if sensors are supported on the device
function checkSensorSupport() {
    // Check for DeviceOrientation support
    if ('DeviceOrientationEvent' in window) {
        // Support confirmed, now check if permission is needed
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ requires permission
            sensorToggleBtn.textContent = 'Request Permission';
        } else {
            // Permission not needed, can be enabled directly
            sensorToggleBtn.textContent = 'Enable Sensors';
        }
    } else {
        // No support
        sensorToggleBtn.textContent = 'Not Supported';
        sensorToggleBtn.disabled = true;
    }
    
    // Check for light sensor support
    if ('AmbientLightSensor' in window) {
        lightSensorSupported = true;
        lightLevelValue.textContent = 'Available';
    } else {
        lightSensorSupported = false;
        lightLevelValue.textContent = 'Not supported';
    }
}

// Set up all device sensors
function setupSensors() {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientationEvent);
                    deviceOrientationPermissionGranted = true;
                    sensorsGloballyEnabled = true;
                    sensorToggleBtn.textContent = 'Disable Sensors';
                    sensorToggleBtn.classList.add('active');
                    setupAdditionalSensors();
                } else {
                    alert('Motion sensor permission denied.');
                    disableSensors(); // Ensure state is reset
                }
            }).catch(err => {
                console.error("Sensor permission error:", err);
                alert('Error requesting sensor permissions.');
                disableSensors();
            });
    } else if ('DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', handleOrientationEvent);
        deviceOrientationPermissionGranted = true; // Assume granted for non-iOS13+
        sensorsGloballyEnabled = true;
        sensorToggleBtn.textContent = 'Disable Sensors';
        sensorToggleBtn.classList.add('active');
        setupAdditionalSensors();
    } else {
        alert('Device orientation not supported on your device.');
        sensorToggleBtn.textContent = 'Not Supported';
        sensorToggleBtn.disabled = true;
    }
}

// Setup additional sensors beyond device orientation
function setupAdditionalSensors() {
    // Setup motion sensor
    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', handleMotionEvent);
    }
    
    // Setup microphone
    setupMicrophone();
    
    // Setup light sensor
    setupLightSensor();
}

// Setup microphone access and processing
function setupMicrophone() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then(stream => {
                    microphoneStream = stream;
                    analyser = audioContext.createAnalyser();
                    const source = audioContext.createMediaStreamSource(stream);
                    source.connect(analyser);
                    analyser.fftSize = 256;
                    const bufferLength = analyser.frequencyBinCount;
                    audioDataArray = new Uint8Array(bufferLength);
                    
                    // Start audio processing
                    processMicrophoneInput();
                })
                .catch(err => {
                    console.error('Microphone access error:', err);
                    micLevelValue.textContent = 'Not available';
                });
        } catch (err) {
            console.error('Audio context error:', err);
            micLevelValue.textContent = 'Not supported';
        }
    }
}

// Process audio input from microphone
function processMicrophoneInput() {
    if (!analyser || !sensorsGloballyEnabled) return;
    
    analyser.getByteFrequencyData(audioDataArray);
    
    // Calculate average volume level
    let sum = 0;
    for (let i = 0; i < audioDataArray.length; i++) {
        sum += audioDataArray[i];
    }
    const average = sum / audioDataArray.length;
    const volumeLevel = Math.min(100, Math.round((average / 255) * 100));
    
    // Update UI
    micLevelValue.textContent = `${volumeLevel} %`;
    micLevelBar.style.width = `${volumeLevel}%`;
    
    // Update sensor value
    sensorValues.mic = volumeLevel;
    
    // Process next frame
    requestAnimationFrame(processMicrophoneInput);
}

// Setup ambient light sensor
function setupLightSensor() {
    if ('AmbientLightSensor' in window) {
        try {
            const lightSensor = new window.AmbientLightSensor();
            lightSensor.addEventListener('reading', () => {
                currentLightLevel = lightSensor.illuminance;
                lightLevelValue.textContent = `${Math.round(currentLightLevel)} lux`;
                sensorValues.light = currentLightLevel;
            });
            lightSensor.addEventListener('error', (event) => {
                console.error('Light sensor error:', event.error.name, event.error.message);
                lightLevelValue.textContent = 'Error';
            });
            lightSensor.start();
            lightSensorSupported = true;
        } catch (err) {
            console.error('Light sensor error:', err);
            lightLevelValue.textContent = 'Not available';
        }
    } else {
        lightLevelValue.textContent = 'Not supported';
    }
}

// Disable all sensors
function disableSensors() {
    window.removeEventListener('deviceorientation', handleOrientationEvent);
    window.removeEventListener('devicemotion', handleMotionEvent);
    
    sensorsGloballyEnabled = false;
    // deviceOrientationPermissionGranted remains true if it was ever granted
    sensorToggleBtn.textContent = 'Enable Sensors';
    sensorToggleBtn.classList.remove('active');
    
    // Clean up microphone
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
    
    // Reset point cloud tilt if in that mode
    if (window.pointCloudTiltAngles) {
        window.pointCloudTiltAngles = { beta: 0, gamma: 0 };
    }
}

// Handle device orientation events
function handleOrientationEvent(event) {
    if (!sensorsGloballyEnabled) return; 
    const { alpha, beta, gamma } = event;
    if (alpha == null || beta == null || gamma == null) return;

    // Update UI displays
    orientAlpha.textContent = (alpha != null ? alpha.toFixed(2) : '0.00');
    orientBeta.textContent = (beta != null ? beta.toFixed(2) : '0.00');
    orientGamma.textContent = (gamma != null ? gamma.toFixed(2) : '0.00');
    
    if (compassNeedle) {
        compassNeedle.style.transform = `rotate(${(alpha || 0)}deg)`;
    }
    
    // Update sensor values
    sensorValues.alpha = alpha || 0;
    sensorValues.beta = beta || 0;
    sensorValues.gamma = gamma || 0;
    
    // Process sensor values for existing direct mappings
    processDirectOrientationMappings(alpha || 0, beta || 0, gamma || 0);
    
    // Apply all active sensor effect mappings
    window.mappings.applyAllSensorMappings();
}

// Handle device motion events (acceleration)
function handleMotionEvent(event) {
    if (!sensorsGloballyEnabled) return;
    const { acceleration } = event;
    if (!acceleration) return;
    
    // Update sensor values
    sensorValues.accelX = acceleration.x || 0;
    sensorValues.accelY = acceleration.y || 0;
    sensorValues.accelZ = acceleration.z || 0;
    
    // Motion values will be used in applyAllSensorMappings
}

// Process orientation values with calibration and offsets
function processDirectOrientationMappings(rawAlpha, rawBeta, rawGamma) {
    // Process values accounting for calibration and manual offsets
    const effectiveAlpha = ((rawAlpha - calibrationValues.alpha - manualOffsets.alpha + 360) % 360);
    let effectiveBeta = rawBeta - calibrationValues.beta - manualOffsets.beta;
    let effectiveGamma = rawGamma - calibrationValues.gamma - manualOffsets.gamma;

    const finalAlpha = controlsInverted ? (360 - effectiveAlpha + 360) % 360 : effectiveAlpha;
    let finalBeta = controlsInverted ? -effectiveBeta : effectiveBeta;
    let finalGamma = controlsInverted ? -effectiveGamma : effectiveGamma;
    
    // Update point cloud tilt angles if in that mode
    if (window.pointCloudTiltAngles) {
        window.pointCloudTiltAngles.beta = finalBeta;
        window.pointCloudTiltAngles.gamma = finalGamma;
    }
}

// Update sensitivity and offset display values
function updateSensorConfigDisplayValues() {
    alphaSensValue.textContent = parseFloat(alphaSensitivitySlider.value).toFixed(1);
    betaSensValue.textContent = parseFloat(betaSensitivitySlider.value).toFixed(1);
    gammaSensValue.textContent = parseFloat(gammaSensitivitySlider.value).toFixed(1);
    smoothingValue.textContent = parseFloat(smoothingSlider.value).toFixed(1);
    
    alphaOffsetValue.textContent = `${alphaOffsetSlider.value}°`;
    betaOffsetValue.textContent = `${betaOffsetSlider.value}°`;
    gammaOffsetValue.textContent = `${gammaOffsetSlider.value}°`;
    
    // Update manual offsets from sliders
    manualOffsets.alpha = parseFloat(alphaOffsetSlider.value);
    manualOffsets.beta = parseFloat(betaOffsetSlider.value);
    manualOffsets.gamma = parseFloat(gammaOffsetSlider.value);
}

// Calibrate sensors to current orientation
function calibrateSensors() {
    if (!sensorsGloballyEnabled) { 
        alert('Enable sensors first.'); 
        return; 
    }
    
    calibrationValues.alpha = parseFloat(orientAlpha.textContent) || 0;
    calibrationValues.beta = parseFloat(orientBeta.textContent) || 0;
    calibrationValues.gamma = parseFloat(orientGamma.textContent) || 0;
    
    // Reset manual offsets
    manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
    alphaOffsetSlider.value = 0; 
    betaOffsetSlider.value = 0; 
    gammaOffsetSlider.value = 0;
    
    updateSensorConfigDisplayValues();

    alert('Sensors calibrated. Manual offsets reset.');
    
    // Reset video filters if in video mode
    if (window.currentMode === 'videoPlayer' && window.resetFiltersBtn) {
        window.resetFiltersBtn.click();
    }
    
    // Reset filter values
    window.lastVideoFilterValues = { 
        brightness: 100, 
        saturation: 100, 
        contrast: 100,
        hueRotate: 0,
        blur: 0,
        sepia: 0
    };
    
    // Reset point cloud tilt
    if (window.pointCloudTiltAngles) {
        window.pointCloudTiltAngles = { beta: 0, gamma: 0 };
    }
}

// Toggle inverted controls
function toggleInvertControls() {
    controlsInverted = !controlsInverted;
    invertBtn.textContent = controlsInverted ? 'Controls Inverted' : 'Invert Controls';
    invertBtn.style.backgroundColor = controlsInverted ? '#f44336' : '#555';
}

// Toggle testing mode for sensor values
function toggleTestingMode() {
    testingModeEnabled = !testingModeEnabled;
    testingModeToggle.textContent = testingModeEnabled ? 'Disable' : 'Enable';
    testingModeToggle.classList.toggle('active', testingModeEnabled);
    utils.toggleElementVisibility(testingControls, testingModeEnabled);
    
    if (testingModeEnabled) {
        // Initialize sliders with current sensor values if available
        if (sensorsGloballyEnabled) {
            testAlphaSlider.value = sensorValues.alpha;
            testBetaSlider.value = sensorValues.beta;
            testGammaSlider.value = sensorValues.gamma;
        }
        
        // Apply initial values
        window.mappings.applyAllSensorMappings();
    } else {
        // If actual sensors are enabled, use their values instead
        if (sensorsGloballyEnabled) {
            window.mappings.applyAllSensorMappings();
        }
    }
}

// Export to global scope
window.sensors = {
    initializeSensors,
    sensorsGloballyEnabled,
    testingModeEnabled,
    sensorValues,
    calibrationValues,
    manualOffsets,
    controlsInverted
};

// Export global variables for other modules to access
window.sensorsGloballyEnabled = sensorsGloballyEnabled;
window.testingModeEnabled = testingModeEnabled;
window.sensorValues = sensorValues;