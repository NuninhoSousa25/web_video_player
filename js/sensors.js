// js/sensors.js
const Sensors = (function() {
    // Constants
    const DEFAULT_SMOOTHING_FACTOR = 0.3;
    const DEFAULT_PROXIMITY_MAX = 25;
    const CIRCULAR_SENSORS = ['alpha', 'compassHeading'];
    const SENSOR_UPDATE_FREQUENCY = 2; // Hz

    // Helper function to get sensor details from AVAILABLE_SENSORS (from mapping_config.js)
    function getSensorById(id) {
        // Ensure AVAILABLE_SENSORS is accessible. This assumes mapping_config.js is loaded
        // before sensors.js, or AVAILABLE_SENSORS is a globally accessible constant.
        // For this context, we'll assume it's accessible.
        if (typeof AVAILABLE_SENSORS === 'undefined') {
            console.warn("AVAILABLE_SENSORS not found. Ensure mapping_config.js is loaded.");
            return null;
        }
        return AVAILABLE_SENSORS.find(sensor => sensor.id === id);
    }

    // DOM Elements
    let sensorToggleBtn, orientAlphaEl, orientBetaEl, orientGammaEl, compassNeedle,
        // micVolumeDisplayEl, // Example if you add mic volume display
        alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider,
        alphaSensValueEl, betaSensValueEl, gammaSensValueEl, smoothingValueEl,
        alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider,
        alphaOffsetValueEl, betaOffsetValueEl, gammaOffsetValueEl,
        calibrateBtn, invertBtn, sensorSectionControls, micVolumeValueEl;

    // Module References
    let playerModuleRef;
    let pointCloudModuleRef; // Added reference for PointCloud parallax

    // State
    let globallyEnabled = false;
    let permissionGranted = {
        orientation: false,
        motion: false,
        proximity: false,
        microphone: false,
        gyroscope: false,
        gravity: false
    };
    
    // Sensor Data
    const createInitialSensorData = () => ({
        alpha: 0, beta: 0, gamma: 0,
        accelX: 0, accelY: 0, accelZ: 0,
        // Use getSensorById for typicalMax if available, otherwise fallback to DEFAULT_PROXIMITY_MAX
        proximity: getSensorById('proximity')?.typicalMax || DEFAULT_PROXIMITY_MAX,
        micVolume: 0,
        compassHeading: 0,
        gyroX: 0, gyroY: 0, gyroZ: 0,
        gravityX: 0, gravityY: 0, gravityZ: 0
    });

    let latestSensorData = createInitialSensorData();
    let smoothedSensorData = { ...latestSensorData };

    // Calibration and Configuration
    let calibrationValues = { alpha: 0, beta: 0, gamma: 0 };
    let manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
    let controlsInverted = false;
    let smoothingFactor = DEFAULT_SMOOTHING_FACTOR;

    // Callbacks
    let onSensorUpdateCallback = () => {}; // This calls Mappings.applyAllActiveMappings

    // Sensor Instances
    let proximitySensorInstance = null;

    // Audio handling
    let audioContext = null;
    let analyserNode = null;
    let microphoneSource = null;
    let audioDataArray = null;
    let micVolumeUpdateId = null;
    let isMicSetup = false;
    let micRetryCount = 0;
    const MAX_MIC_RETRIES = 3;

    function cacheDOMElements() {
        sensorToggleBtn = document.getElementById('sensorToggleBtn');
        orientAlphaEl = document.getElementById('orientAlpha');
        orientBetaEl = document.getElementById('orientBeta');
        orientGammaEl = document.getElementById('orientGamma');
        compassNeedle = document.getElementById('compassNeedle');
        micVolumeValueEl = document.getElementById('micVolumeValue');
        
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
        if (!alphaSensValueEl || !alphaSensitivitySlider || !betaSensValueEl || !betaSensitivitySlider || 
            !gammaSensValueEl || !gammaSensitivitySlider || !smoothingValueEl || !smoothingSlider ||
            !alphaOffsetValueEl || !alphaOffsetSlider || !betaOffsetValueEl || !betaOffsetSlider ||
            !gammaOffsetValueEl || !gammaOffsetSlider) {
            return; 
        }

        alphaSensValueEl.textContent = parseFloat(alphaSensitivitySlider.value).toFixed(1);
        betaSensValueEl.textContent = parseFloat(betaSensitivitySlider.value).toFixed(1);
        gammaSensValueEl.textContent = parseFloat(gammaSensitivitySlider.value).toFixed(1);
        
        smoothingFactor = parseFloat(smoothingSlider.value); // Update smoothingFactor
        smoothingValueEl.textContent = smoothingFactor.toFixed(1);
        
        alphaOffsetValueEl.textContent = `${alphaOffsetSlider.value}°`;
        betaOffsetValueEl.textContent = `${betaOffsetSlider.value}°`;
        gammaOffsetValueEl.textContent = `${gammaOffsetSlider.value}°`;

        manualOffsets.alpha = parseFloat(alphaOffsetSlider.value);
        manualOffsets.beta = parseFloat(betaOffsetSlider.value);
        manualOffsets.gamma = parseFloat(gammaOffsetSlider.value);

        // No need to call onSensorUpdateCallback here, it's called by sensor event handlers
    }
    
    function setupEventListeners() {
        if (sensorToggleBtn) sensorToggleBtn.addEventListener('click', () => globallyEnabled ? disable() : enable());

        if (calibrateBtn) {
            calibrateBtn.addEventListener('click', () => {
                if (!globallyEnabled) { alert('Enable sensors first.'); return; }
                
                // Calibrate using the RAW (unsmoothed, non-inverted) latest sensor data for alpha,beta,gamma
                // For simplicity, we'll use the current 'latestSensorData' which *is* processed (offsets, inversion)
                // but we effectively reset offsets by this calibration.
                // A more "pure" calibration would store the truly raw event values before any processing.
                calibrationValues.alpha = latestSensorData.alpha; // Calibrate to current processed Alpha
                calibrationValues.beta = latestSensorData.beta;   // Calibrate to current processed Beta
                calibrationValues.gamma = latestSensorData.gamma; // Calibrate to current processed Gamma
                
                // Reset manual offsets as calibration sets a new zero point
                manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
                if(alphaOffsetSlider) alphaOffsetSlider.value = 0; 
                if(betaOffsetSlider) betaOffsetSlider.value = 0; 
                if(gammaOffsetSlider) gammaOffsetSlider.value = 0;
                updateConfigDisplay(); // Update display of offsets

                alert('Sensors calibrated. Manual offsets reset.');

                if (playerModuleRef && playerModuleRef.resetFilters) {
                     playerModuleRef.resetFilters();
                }
                // Trigger a re-application of mappings with new calibration
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

        configSliders.forEach((slider) => {
            if (slider) {
                slider.addEventListener('input', updateConfigDisplay);
            }
        });

        if (smoothingSlider) {
            smoothingSlider.addEventListener('input', () => {
                smoothingFactor = parseFloat(smoothingSlider.value);
                if (smoothingValueEl) smoothingValueEl.textContent = smoothingFactor.toFixed(1);
            });
        }
    }
    
    function updateSensorDisplay() {
        const updateValue = (elementId, value, decimals = 2) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value != null ? value.toFixed(decimals) : '0.00';
            }
        };

        // Update orientation values
        updateValue('orientAlpha', smoothedSensorData.alpha);
        updateValue('orientBeta', smoothedSensorData.beta);
        updateValue('orientGamma', smoothedSensorData.gamma);
        
        // Update proximity value (1 decimal place)
        updateValue('proximityValue', smoothedSensorData.proximity, 1);
        
        // Update gyroscope values
        updateValue('gyroXValue', smoothedSensorData.gyroX);
        updateValue('gyroYValue', smoothedSensorData.gyroY);
        updateValue('gyroZValue', smoothedSensorData.gyroZ);

        // Update gravity values
        updateValue('gravityXValue', smoothedSensorData.gravityX);
        updateValue('gravityYValue', smoothedSensorData.gravityY);
        updateValue('gravityZValue', smoothedSensorData.gravityZ);
        
        // Update compass needle
        if (compassNeedle) {
            compassNeedle.style.transform = `rotate(${smoothedSensorData.alpha || 0}deg)`;
        }
    }

    function mapCircularValue(value, min, max) {
        if (value == null) return 0;
        
        const range = max - min;
        const halfRange = range / 2;
        
        // Normalize to 0-range
        let normalized = ((value - min) % range + range) % range;
        
        // Map to -halfRange to +halfRange
        if (normalized > halfRange) {
            normalized = range - normalized;
        }
        
        return normalized;
    }

    function applySmoothing(currentSmoothed, rawNewValue) {
        if (smoothingFactor === 0) return rawNewValue;
        if (rawNewValue == null) return currentSmoothed;
        
        const current = Number(currentSmoothed) || 0;
        const raw = Number(rawNewValue) || 0;
        return current * smoothingFactor + raw * (1 - smoothingFactor);
    }

    function processSensorDataAndUpdate() {
        // Apply smoothing to all relevant sensor data
        for (const key in latestSensorData) {
            if (!smoothedSensorData.hasOwnProperty(key)) continue;

            // Handle circular values differently
            if (CIRCULAR_SENSORS.includes(key)) {
                const mappedValue = mapCircularValue(latestSensorData[key], 0, 360);
                const mappedSmoothed = mapCircularValue(smoothedSensorData[key], 0, 360);
                smoothedSensorData[key] = applySmoothing(mappedSmoothed, mappedValue);
            } else {
                smoothedSensorData[key] = applySmoothing(smoothedSensorData[key], latestSensorData[key]);
            }
        }

        updateSensorDisplay();

        // Update PointCloud with smoothed beta and gamma for parallax
        if (pointCloudModuleRef?.updateSensorTilt) {
            pointCloudModuleRef.updateSensorTilt(smoothedSensorData.beta, smoothedSensorData.gamma);
        }

        onSensorUpdateCallback?.();
    }


    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        
        try {
            const rawAlpha = event.alpha ?? 0;
            const rawBeta = event.beta ?? 0;
            const rawGamma = event.gamma ?? 0;

            // Apply calibration and offsets
            const calAlpha = ((rawAlpha - calibrationValues.alpha + 360) % 360);
            const calBeta = rawBeta - calibrationValues.beta;
            const calGamma = rawGamma - calibrationValues.gamma;

            const offsetAlpha = ((calAlpha - manualOffsets.alpha + 360) % 360);
            const offsetBeta = calBeta - manualOffsets.beta;
            const offsetGamma = calGamma - manualOffsets.gamma;

            // Apply inversion if needed
            latestSensorData.alpha = controlsInverted ? (360 - offsetAlpha + 360) % 360 : offsetAlpha;
            latestSensorData.beta = controlsInverted ? -offsetBeta : offsetBeta;
            latestSensorData.gamma = controlsInverted ? -offsetGamma : offsetGamma;
            latestSensorData.compassHeading = latestSensorData.alpha;
            
            processSensorDataAndUpdate();
        } catch (error) {
            console.error('Error processing orientation event:', error);
        }
    }

    function handleMotionEvent(event) {
        if (!globallyEnabled) return;

        try {
            const { acceleration, accelerationIncludingGravity: accGravity, rotationRate } = event;

            // Handle acceleration data
            if (acceleration?.x != null) {
                latestSensorData.accelX = acceleration.x;
                latestSensorData.accelY = acceleration.y;
                latestSensorData.accelZ = acceleration.z;
            } else if (accGravity?.x != null) {
                latestSensorData.accelX = accGravity.x;
                latestSensorData.accelY = accGravity.y;
                latestSensorData.accelZ = accGravity.z;
            }

            // Handle gyroscope data
            if (rotationRate) {
                latestSensorData.gyroX = rotationRate.alpha ?? 0;
                latestSensorData.gyroY = rotationRate.beta ?? 0;
                latestSensorData.gyroZ = rotationRate.gamma ?? 0;
            }

            // Handle gravity data
            if (accGravity) {
                latestSensorData.gravityX = accGravity.x ?? 0;
                latestSensorData.gravityY = accGravity.y ?? 0;
                latestSensorData.gravityZ = accGravity.z ?? 0;
            }
            
            processSensorDataAndUpdate();
        } catch (error) {
            console.error('Error processing motion event:', error);
        }
    }

    function handleProximityEvent() {
        if (!globallyEnabled || !proximitySensorInstance) return;
        try {
            const proxSensorDetails = getSensorById('proximity');
            const maxDistance = proxSensorDetails?.typicalMax ?? DEFAULT_PROXIMITY_MAX; // Use the value from config or default

            // Normalize the proximity value to 0-100% range
            latestSensorData.proximity = proximitySensorInstance.distance === null ? 0 // Object is very close or sensor is covered
                                         : Math.min(100, (proximitySensorInstance.distance / maxDistance) * 100);
            
            processSensorDataAndUpdate();
        } catch (error) {
            console.error('Error processing proximity event:', error);
        }
    }

    function handleProximityError(event) {
        console.error('Proximity sensor error:', event.error.name, event.error.message);
        if (event.error.name === 'NotAllowedError') {
            alert('Access to the proximity sensor is not allowed. Please check your device settings.');
        } else if (event.error.name === 'NotReadableError') {
            alert('Proximity sensor is not readable. Please ensure your device has a working proximity sensor.');
        } else {
            alert('Error accessing proximity sensor: ' + event.error.message);
        }
        if (proximitySensorInstance) {
            try {
                proximitySensorInstance.removeEventListener('reading', handleProximityEvent);
                proximitySensorInstance.removeEventListener('error', handleProximityError);
                proximitySensorInstance.stop();
            } catch(e) {
                console.warn("Error stopping proximity sensor:", e);
            }
            proximitySensorInstance = null;
        }
        permissionGranted.proximity = false;
    }

    async function setupProximitySensor() {
        if (!permissionGranted.proximity) return;
        try {
            const proximityOptions = { frequency: SENSOR_UPDATE_FREQUENCY };
            proximitySensorInstance = new ProximitySensor(proximityOptions);
            proximitySensorInstance.addEventListener('reading', handleProximityEvent);
            proximitySensorInstance.addEventListener('error', handleProximityError);
            await proximitySensorInstance.start();
            console.log("Proximity sensor started successfully.");
        } catch (error) {
            console.warn('Failed to start proximity sensor:', error);
            permissionGranted.proximity = false;
            if (error.name === 'NotAllowedError') {
                alert('Permission to use proximity sensor was denied. Please check your device settings.');
            }
        }
    }

    async function setupMicrophoneSensor() { // Renamed from initializeAudio
        try {
            // Clean up any existing audio context and streams
            if (microphoneSource?.mediaStream) {
                microphoneSource.mediaStream.getTracks().forEach(track => track.stop());
                microphoneSource = null;
            }
            if (audioContext?.state === 'closed') {
                audioContext = null;
            }

            // Initialize new audio context
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Request microphone access with more permissive constraints
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1, sampleRate: 44100 } });

            // Resume audio context if needed
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Set up audio processing
            analyserNode = audioContext.createAnalyser();
            microphoneSource = audioContext.createMediaStreamSource(stream);
            microphoneSource.connect(analyserNode);
            analyserNode.smoothingTimeConstant = 0.85;
            analyserNode.fftSize = 256;
            audioDataArray = new Uint8Array(analyserNode.frequencyBinBinCount);
            isMicSetup = true;
            micRetryCount = 0;
            console.log("Microphone sensor setup complete.");

            // Start the volume monitoring loop
            if (!micVolumeUpdateId) {
                micVolumeUpdateId = requestAnimationFrame(updateMicVolumeLoop); // Correctly call itself
            }
        } catch (error) {
            console.error('Error setting up microphone sensor:', error);
            handleMicrophoneError(error);
        }
    }

    function handleMicrophoneError(error) {
        permissionGranted.microphone = false;
        isMicSetup = false;
        // Clean up any existing audio resources
        if (micVolumeUpdateId) {
            cancelAnimationFrame(micVolumeUpdateId);
            micVolumeUpdateId = null;
        }
        if (microphoneSource?.mediaStream) {
            microphoneSource.mediaStream.getTracks().forEach(track => track.stop());
            microphoneSource = null;
        }
        if (audioContext?.state === 'running') {
            audioContext.close();
            audioContext = null;
        }
        const errorMessages = {
            'NotAllowedError': 'Microphone access was denied. Please allow microphone access to use this feature.',
            'NotFoundError': 'No microphone found. Please connect a microphone and try again.',
            'AbortError': 'Microphone access was aborted.',
            'SecurityError': 'Microphone access blocked for security reasons (e.g., not over HTTPS).',
            'TypeError': 'Invalid audio constraints.',
            'OverconstrainedError': 'No microphone found matching the specified constraints.'
        };
        const errorMessage = errorMessages[error.name] || 'An unknown error occurred while accessing the microphone.';
        alert(errorMessage);

        // Attempt retry if appropriate and not too many retries
        if (error.name !== 'NotAllowedError' && micRetryCount < MAX_MIC_RETRIES) {
            micRetryCount++;
            console.log(`Retrying microphone setup... (${micRetryCount}/${MAX_MIC_RETRIES})`);
            setTimeout(setupMicrophoneSensor, 1000 * micRetryCount); // Exponential backoff for retries
        } else if (micRetryCount >= MAX_MIC_RETRIES) {
            console.error("Max microphone setup retries reached.");
        }
    }
    
    function updateMicVolumeLoop() { // Renamed from updateMicVolume to emphasize loop
        if (!isMicSetup || !analyserNode || !audioDataArray) {
            micVolumeUpdateId = null;
            return;
        }

        analyserNode.getByteFrequencyData(audioDataArray);
        let sum = 0;
        for (let i = 0; i < audioDataArray.length; i++) {
            sum += audioDataArray[i];
        }
        const average = sum / audioDataArray.length;
        // Scale to 0-100 range for display/mapping
        const volume = Math.min(100, Math.round((average / 255) * 100)); 
        
        latestSensorData.micVolume = volume;
        smoothedSensorData.micVolume = applySmoothing(smoothedSensorData.micVolume, volume);
        
        if (micVolumeValueEl) {
            micVolumeValueEl.textContent = smoothedSensorData.micVolume.toFixed(0) + '%';
        }

        onSensorUpdateCallback?.(); // Trigger mapping updates

        micVolumeUpdateId = requestAnimationFrame(updateMicVolumeLoop); // Continue the loop
    }

    async function requestSensorPermissions() {
        if (!navigator.permissions) {
            console.warn("Permissions API not supported on this browser.");
            return;
        }

        const checkAndRequest = async (name, eventListener, setupFunction) => {
            try {
                // Feature Policy check for device orientation (older browsers might not support Permissions API for it)
                if (name === 'accelerometer' && !window.DeviceMotionEvent) return;
                if (name === 'gyroscope' && !window.DeviceMotionEvent) return;
                if (name === 'magnetometer' && !window.DeviceOrientationEvent) return; // Compass relies on this
                if (name === 'microphone' && !navigator.mediaDevices?.getUserMedia) return;
                if (name === 'proximity' && !window.ProximitySensor) return;

                let permissionName = name;
                // Specific permission names for Generic Sensor API types
                if (name === 'accelerometer' || name === 'gyroscope' || name === 'magnetometer' || name === 'ambient-light-sensor') {
                    permissionName = name; // These are standard sensor names
                } else if (name === 'microphone') {
                    permissionName = 'microphone';
                } else if (name === 'proximity') {
                    // No direct standard permission name for ProximitySensor yet, it's often covered by 'camera' or 'device-info' implicitly
                    // or requires a specific prompt. For now, rely on its constructor throwing an error.
                    // We'll proceed with direct ProximitySensor instantiation for now.
                    permissionGranted.proximity = true; // Assume true and let setup fail if permission is truly denied
                    return; 
                } else if (name === 'deviceorientation' || name === 'devicemotion') {
                     // Handle specific permissions for Device Orientation/Motion
                     if (typeof DeviceMotionEvent.requestPermission === 'function') {
                        const state = await DeviceMotionEvent.requestPermission();
                        permissionGranted.motion = (state === 'granted');
                        permissionGranted.orientation = (state === 'granted'); // Often granted together
                        if (permissionGranted.motion) {
                            window.addEventListener('devicemotion', handleMotionEvent);
                        }
                        if (permissionGranted.orientation) {
                            window.addEventListener('deviceorientation', handleOrientationEvent);
                        }
                        return;
                    } else {
                        // Old browser, assume permission is granted if events exist
                        permissionGranted.motion = true;
                        permissionGranted.orientation = true;
                        window.addEventListener('devicemotion', handleMotionEvent);
                        window.addEventListener('deviceorientation', handleOrientationEvent);
                        return;
                    }
                }

                const status = await navigator.permissions.query({ name: permissionName });
                permissionGranted[name] = (status.state === 'granted');

                status.onchange = () => {
                    permissionGranted[name] = (status.state === 'granted');
                    if (globallyEnabled) { // Re-evaluate sensor state if active
                        enableSensorsInternal();
                    }
                };

                if (permissionGranted[name] && setupFunction) {
                    await setupFunction();
                }

            } catch (error) {
                console.warn(`Permission check/request for ${name} failed:`, error);
                permissionGranted[name] = false;
            }
        };
        
        await checkAndRequest('deviceorientation', handleOrientationEvent); // For alpha, beta, gamma
        await checkAndRequest('devicemotion', handleMotionEvent);       // For acceleration, gravity, gyroscope
        await checkAndRequest('microphone', setupMicrophoneSensor);    // For microphone volume
        await checkAndRequest('proximity', setupProximitySensor);      // For proximity sensor
        // No direct permission for "gravity", it comes from 'devicemotion'
        // No direct permission for "compassHeading", it comes from 'deviceorientation' (alpha)
    }

    async function enableSensorsInternal() {
        globallyEnabled = true;
        sensorToggleBtn.textContent = 'Disable Sensors';
        sensorToggleBtn.classList.add('active');
        showControls();
        updateConfigDisplay(); // Ensure display reflects current config

        // Request permissions and set up sensors based on granted status
        await requestSensorPermissions(); // This will call setup functions if granted

        // Fallback for older browsers or if permissions were pre-granted
        if (permissionGranted.orientation && !window.DeviceOrientationEvent.requestPermission) {
            window.addEventListener('deviceorientation', handleOrientationEvent);
        }
        if (permissionGranted.motion && !window.DeviceMotionEvent.requestPermission) {
            window.addEventListener('devicemotion', handleMotionEvent);
        }
        if (permissionGranted.microphone && !isMicSetup) { // Only if not already setup
            await setupMicrophoneSensor();
        }
        if (permissionGranted.proximity && !proximitySensorInstance) { // Only if not already setup
            await setupProximitySensor();
        }

        // Start processing sensor data at a fixed interval if no native events (e.g. for desktop testing)
        // or to ensure regular updates for smoothed values.
        // For now, rely on event listeners for actual sensor data, and onSensorUpdateCallback for mappings.
    }

    function disable() {
        globallyEnabled = false;
        sensorToggleBtn.textContent = 'Enable Sensors';
        sensorToggleBtn.classList.remove('active');
        hideControls();

        // Stop all sensor event listeners
        window.removeEventListener('deviceorientation', handleOrientationEvent);
        window.removeEventListener('devicemotion', handleMotionEvent);
        
        if (proximitySensorInstance) {
            try { proximitySensorInstance.stop(); } catch(e) { console.warn("Error stopping proximity sensor:", e); }
            proximitySensorInstance = null;
        }

        // Stop microphone
        if (micVolumeUpdateId) {
            cancelAnimationFrame(micVolumeUpdateId);
            micVolumeUpdateId = null;
        }
        if (microphoneSource?.mediaStream) {
            microphoneSource.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
        }
        isMicSetup = false;
        micRetryCount = 0;

        // Reset sensor data and display
        latestSensorData = createInitialSensorData();
        smoothedSensorData = { ...latestSensorData };
        updateSensorDisplay();
        if (micVolumeValueEl) micVolumeValueEl.textContent = '0%';
        
        // Ensure point cloud tilt is reset to avoid "drift" when sensors are off
        if (pointCloudModuleRef?.updateSensorTilt) {
            pointCloudModuleRef.updateSensorTilt(0, 0);
        }

        // Trigger a final update to clear any active sensor mappings
        onSensorUpdateCallback?.(); 
    }

    function enable() {
        if (!globallyEnabled) {
            enableSensorsInternal();
        }
    }

    function getSensorValue(sensorId) {
        // For circular values, return the mapped value
        if (CIRCULAR_SENSORS.includes(sensorId)) {
            return mapCircularValue(smoothedSensorData[sensorId], 0, 360);
        }
        
        // For other sensors, return the smoothed value directly
        return smoothedSensorData[sensorId];
    }
    
    function hideControls() { if (sensorSectionControls) sensorSectionControls.classList.add('hidden'); }
    function showControls() { if (sensorSectionControls) sensorSectionControls.classList.remove('hidden'); }

    // Add visibility change handler
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && audioContext) {
            // Suspend audio context when page is hidden
            if (audioContext.state === 'running') {
                audioContext.suspend();
            }
        } else if (!document.hidden && audioContext && globallyEnabled) {
            // Resume when page is visible again
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log('Resumed audio context after visibility change');
                });
            }
        }
    });

    function init(onUpdateCb, playerRef, pointCloudRef) {
        onSensorUpdateCallback = onUpdateCb;
        playerModuleRef = playerRef;
        pointCloudModuleRef = pointCloudRef;

        cacheDOMElements();
        setupEventListeners();
        updateConfigDisplay(); // Initial display update
        // Check for permission API and device motion/orientation support
        // and initialize sensor state.
        // We don't enable sensors by default on init, user has to toggle.
        // Permission requests will happen on first enable attempt.
    }

    return {
        init,
        isGloballyEnabled: () => globallyEnabled,
        getSensorValue,
        hideControls: () => sensorSectionControls?.classList.add('hidden'),
        showControls: () => sensorSectionControls?.classList.remove('hidden')
    };
})();
