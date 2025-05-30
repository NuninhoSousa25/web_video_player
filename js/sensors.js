// js/sensors.js
const Sensors = (function() {
    // Constants
    const DEFAULT_SMOOTHING_FACTOR = 0.3;
    const DEFAULT_PROXIMITY_MAX = 25;
    const CIRCULAR_SENSORS = ['alpha', 'compassHeading'];
    const SENSOR_UPDATE_FREQUENCY = 2; // Hz

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
            const maxDistance = proxSensorDetails?.typicalMax ?? DEFAULT_PROXIMITY_MAX;
            
            // Normalize the proximity value to 0-100% range
            latestSensorData.proximity = proximitySensorInstance.distance === null
                ? 0 // Object is very close or sensor is covered
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

    async function initializeAudio() {
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
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 1,
                    sampleRate: 44100
                }
            });
            
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
            audioDataArray = new Uint8Array(analyserNode.frequencyBinCount);
            
            isMicSetup = true;
            micRetryCount = 0;
            console.log("Microphone sensor setup complete.");
            
            // Start the volume monitoring loop
            if (!micVolumeUpdateId) {
                updateMicVolumeLoop();
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
            'NotReadableError': 'Could not access microphone. The device may be in use by another application.',
            'default': 'Could not access microphone. Please ensure permission is granted and try again.'
        };

        // Update UI to show error state
        if (micVolumeValueEl) {
            micVolumeValueEl.textContent = 'Error';
            micVolumeValueEl.style.color = '#ff4444';
        }

        // Retry logic for NotReadableError
        if (error.name === 'NotReadableError' && micRetryCount < MAX_MIC_RETRIES) {
            micRetryCount++;
            console.log(`Retrying microphone setup (attempt ${micRetryCount}/${MAX_MIC_RETRIES})...`);
            setTimeout(() => {
                if (globallyEnabled) {
                    setupMicrophoneSensor();
                }
            }, 1000 * micRetryCount); // Increasing delay between retries
            return;
        }

        alert(errorMessages[error.name] || errorMessages.default);
    }

    function updateMicVolumeLoop() {
        if (!isMicSetup || !analyserNode || !globallyEnabled || !audioContext || audioContext.state === 'closed') {
            micVolumeUpdateId = null;
            isMicSetup = false;
            return;
        }

        try {
            analyserNode.getByteFrequencyData(audioDataArray);
            
            // Calculate RMS (Root Mean Square) of the audio data for better volume representation
            let sum = 0;
            for (let i = 0; i < audioDataArray.length; i++) {
                sum += audioDataArray[i] * audioDataArray[i];
            }
            const rms = Math.sqrt(sum / audioDataArray.length);
            
            // Normalize to 0-100% with some amplification and smoothing
            const rawVolume = Math.min(100, (rms / 128) * 100);
            latestSensorData.micVolume = applySmoothing(latestSensorData.micVolume, rawVolume);
            
            // Update UI
            if (micVolumeValueEl) {
                micVolumeValueEl.textContent = latestSensorData.micVolume.toFixed(2);
            }
            
            processSensorDataAndUpdate();
        } catch (error) {
            console.error("Error updating microphone volume:", error);
            cleanupAudio();
            return;
        }
        
        micVolumeUpdateId = requestAnimationFrame(updateMicVolume);
    }
    
    async function requestSensorPermissions() {
        let orientationGrantedUser = false;
        let motionGrantedUser = false;
        let gyroscopeAvailable = false;
        let gravityAvailable = false;
        let microphoneGranted = false;

        if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
            try {
                const state = await DeviceOrientationEvent.requestPermission();
                if (state === 'granted') orientationGrantedUser = true;
            } catch (e) { console.warn("Orientation permission request failed:", e); }
        } else if ('DeviceOrientationEvent' in window) {
            orientationGrantedUser = true; 
        }

        if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
            try {
                const state = await DeviceMotionEvent.requestPermission();
                if (state === 'granted') {
                    motionGrantedUser = true;
                    // Check for additional sensors in motion event
                    const testEvent = new DeviceMotionEvent('test');
                    gyroscopeAvailable = 'rotationRate' in testEvent;
                    gravityAvailable = 'accelerationIncludingGravity' in testEvent;
                }
            } catch (e) { console.warn("Motion permission request failed:", e); }
        } else if ('DeviceMotionEvent' in window) {
            motionGrantedUser = true;
            gyroscopeAvailable = true;
            gravityAvailable = true;
        }

        let proximityAPIAvailable = false;
        if ('ProximitySensor' in window) {
           proximityAPIAvailable = true; 
        } else {
            console.warn("Proximity Sensor API not available in this browser/context.");
        }

        // Only check if getUserMedia exists, don't request it here!
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            microphoneGranted = true;
        }

        return { 
            orientationGrantedUser, 
            motionGrantedUser, 
            proximityAPIAvailable, 
            microphoneGranted,
            gyroscopeAvailable,
            gravityAvailable
        };
    }
    
    async function enable() {
        try {
            // Request and check permissions
            const permissions = await requestSensorPermissions();
            Object.assign(permissionGranted, {
                orientation: permissions.orientationGrantedUser,
                motion: permissions.motionGrantedUser,
                proximity: permissions.proximityAPIAvailable,
                microphone: permissions.microphoneGranted,
                gyroscope: permissions.gyroscopeAvailable,
                gravity: permissions.gravityAvailable
            });

            if (!Object.values(permissionGranted).some(Boolean)) {
                throw new Error('No sensor permissions granted or APIs available.');
            }

            // Set up event listeners
            if (permissionGranted.orientation) {
                window.addEventListener('deviceorientation', handleOrientationEvent, true);
            }
            if (permissionGranted.motion) {
                window.addEventListener('devicemotion', handleMotionEvent, true);
            }

            // Initialize sensors
            await Promise.all([
                setupProximitySensor(),
                setupMicrophoneSensor()
            ]);

            if (permissionGranted.microphone && isMicEnabled) {
                updateMicVolume();
            }

            globallyEnabled = true;
            updateUIState(true);
            console.log("Sensors enabled with permissions:", permissionGranted);
        } catch (error) {
            console.error('Failed to enable sensors:', error);
            alert(error.message);
            disable();
        }
    }

    function disable() {
        globallyEnabled = false;
        updateUIState(false);
        
        // Clean up microphone more thoroughly
        if (micVolumeUpdateId) {
            cancelAnimationFrame(micVolumeUpdateId);
            micVolumeUpdateId = null;
        }
        
        if (microphoneSource) {
            try {
                microphoneSource.disconnect();
                if (microphoneSource.mediaStream) {
                    microphoneSource.mediaStream.getTracks().forEach(track => {
                        track.stop();
                        console.log('Stopped audio track:', track.label);
                    });
                }
            } catch (e) {
                console.warn('Error cleaning up microphone source:', e);
            }
            microphoneSource = null;
        }
        
        if (analyserNode) {
            try {
                analyserNode.disconnect();
            } catch (e) {
                console.warn('Error disconnecting analyser:', e);
            }
            analyserNode = null;
        }
        
        // Close audio context after cleanup
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().then(() => {
                console.log('Audio context closed');
                audioContext = null;
            }).catch(e => {
                console.warn('Error closing audio context:', e);
            });
        }
        
        isMicSetup = false;
        audioDataArray = null;
        
        if (micVolumeValueEl) {
            micVolumeValueEl.textContent = '0.0';
            micVolumeValueEl.style.color = '';
        }

        // Remove event listeners
        window.removeEventListener('deviceorientation', handleOrientationEvent, true);
        window.removeEventListener('devicemotion', handleMotionEvent, true);
        
        // Clean up proximity sensor
        if (proximitySensorInstance) {
            try {
                proximitySensorInstance.removeEventListener('reading', handleProximityEvent);
                proximitySensorInstance.removeEventListener('error', handleProximityError);
                proximitySensorInstance.stop();
            } catch (error) {
                console.warn("Error stopping proximity sensor:", error);
            }
            proximitySensorInstance = null;
        }
        
        // Clean up microphone
        if (micVolumeUpdateId) {
            cancelAnimationFrame(micVolumeUpdateId);
            micVolumeUpdateId = null;
        }
        if (microphoneSource?.mediaStream) {
            microphoneSource.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (micVolumeValueEl) {
            micVolumeValueEl.textContent = '0.00';
            micVolumeValueEl.style.color = '';
        }

        // Reset state
        latestSensorData = createInitialSensorData();
        smoothedSensorData = { ...latestSensorData };
        
        // Update UI and effects
        updateUIState(false);
        updateSensorDisplay();
        
        if (pointCloudModuleRef?.updateSensorTilt) {
            pointCloudModuleRef.updateSensorTilt(0, 0);
        }
        onSensorUpdateCallback?.();
        
        console.log("Sensors disabled.");
    }

    function updateUIState(enabled) {
        if (sensorToggleBtn) {
            sensorToggleBtn.textContent = enabled ? 'Disable Sensors' : 'Enable Sensors';
            sensorToggleBtn.classList.toggle('active', enabled);
        }
    }

    function init(sensorUpdCb, pModuleRef, pcModuleRef) {
        try {
            onSensorUpdateCallback = sensorUpdCb;
            playerModuleRef = pModuleRef;
            pointCloudModuleRef = pcModuleRef;
            
            cacheDOMElements();
            setupEventListeners();
            
            if (smoothingSlider) {
                smoothingFactor = parseFloat(smoothingSlider.value);
            }
            
            updateConfigDisplay();
            updateSensorDisplay();
        } catch (error) {
            console.error('Error initializing sensors:', error);
        }
    }

    function getSensorValue(sensorId) {
        if (!sensorId || !smoothedSensorData.hasOwnProperty(sensorId)) {
            return null;
        }

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

    return {
        init,
        isGloballyEnabled: () => globallyEnabled,
        getSensorValue,
        hideControls: () => sensorSectionControls?.classList.add('hidden'),
        showControls: () => sensorSectionControls?.classList.remove('hidden')
    };
})();
