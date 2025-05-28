// js/sensors.js
const Sensors = (function() {
    let sensorToggleBtn, orientAlphaEl, orientBetaEl, orientGammaEl, compassNeedle,
        // micVolumeDisplayEl, // Example if you add mic volume display
        alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider,
        alphaSensValueEl, betaSensValueEl, gammaSensValueEl, smoothingValueEl,
        alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider,
        alphaOffsetValueEl, betaOffsetValueEl, gammaOffsetValueEl,
        calibrateBtn, invertBtn, sensorSectionControls;

    let playerModuleRef;
    let pointCloudModuleRef; // Added reference for PointCloud parallax

    let globallyEnabled = false;
    let permissionGranted = {
        orientation: false,
        motion: false,
        proximity: false, 
        microphone: false 
    };
    
    let latestSensorData = {
        alpha: 0, beta: 0, gamma: 0,
        accelX: 0, accelY: 0, accelZ: 0,
        proximity: getSensorById('proximity') ? getSensorById('proximity').typicalMax : 25, 
        micVolume: 0,
        compassHeading: 0 
    };

    let smoothedSensorData = { ...latestSensorData }; // For applying smoothing

    let calibrationValues = { alpha: 0, beta: 0, gamma: 0 };
    let manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
    let controlsInverted = false;
    let smoothingFactor = 0.3; // Default smoothing factor

    let onSensorUpdateCallback = () => {}; // This calls Mappings.applyAllActiveMappings

    let proximitySensorInstance = null;

    let audioContext = null;
    let analyserNode = null;
    let microphoneSource = null;
    let audioDataArray = null;
    let micVolumeUpdateId = null;
    let isMicSetup = false;


    function cacheDOMElements() {
        sensorToggleBtn = document.getElementById('sensorToggleBtn');
        orientAlphaEl = document.getElementById('orientAlpha');
        orientBetaEl = document.getElementById('orientBeta');
        orientGammaEl = document.getElementById('orientGamma');
        compassNeedle = document.getElementById('compassNeedle');
        // micVolumeDisplayEl = document.getElementById('micVolumeDisplay'); // Example
        
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
    
    function applySmoothing(currentSmoothed, rawNewValue) {
        if (smoothingFactor === 0) return rawNewValue; // No smoothing
        // Ensure values are numbers before calculation
        const current = Number(currentSmoothed) || 0;
        const raw = Number(rawNewValue) || 0;
        return current * smoothingFactor + raw * (1 - smoothingFactor);
    }


    function updateSensorDisplay() {
        if(orientAlphaEl) orientAlphaEl.textContent = (smoothedSensorData.alpha != null ? smoothedSensorData.alpha.toFixed(2) : '0.00');
        if(orientBetaEl) orientBetaEl.textContent = (smoothedSensorData.beta != null ? smoothedSensorData.beta.toFixed(2) : '0.00');
        if(orientGammaEl) orientGammaEl.textContent = (smoothedSensorData.gamma != null ? smoothedSensorData.gamma.toFixed(2) : '0.00');
        
        const proximityValueEl = document.getElementById('proximityValue');
        if(proximityValueEl) proximityValueEl.textContent = (smoothedSensorData.proximity != null ? smoothedSensorData.proximity.toFixed(1) : '0.00');
        
        if (compassNeedle) compassNeedle.style.transform = `rotate(${(smoothedSensorData.alpha || 0)}deg)`;
        // if (micVolumeDisplayEl) micVolumeDisplayEl.textContent = Math.round(smoothedSensorData.micVolume);
    }

    function mapCircularValue(value, min, max) {
        // For circular values (like angles), map them to a continuous range
        // This prevents sharp transitions at 0/360 boundary
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

    function processSensorDataAndUpdate() {
        // Apply smoothing to all relevant sensor data
        for (const key in latestSensorData) {
            if (smoothedSensorData.hasOwnProperty(key)) {
                // Handle circular values (alpha and compassHeading) differently
                if (key === 'alpha' || key === 'compassHeading') {
                    // Map to continuous range first
                    const mappedValue = mapCircularValue(latestSensorData[key], 0, 360);
                    const mappedSmoothed = mapCircularValue(smoothedSensorData[key], 0, 360);
                    
                    // Apply smoothing to mapped values
                    smoothedSensorData[key] = applySmoothing(mappedSmoothed, mappedValue);
                } else {
                    smoothedSensorData[key] = applySmoothing(smoothedSensorData[key], latestSensorData[key]);
                }
            }
        }

        updateSensorDisplay();

        // Update PointCloud with smoothed beta and gamma for parallax
        if (pointCloudModuleRef && typeof pointCloudModuleRef.updateSensorTilt === 'function') {
            pointCloudModuleRef.updateSensorTilt(smoothedSensorData.beta, smoothedSensorData.gamma);
        }

        if (onSensorUpdateCallback) {
            onSensorUpdateCallback(); // This will use smoothedSensorData via getSensorValue
        }
    }


    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        
        let rawAlpha = event.alpha || 0;
        let rawBeta = event.beta || 0;
        let rawGamma = event.gamma || 0;

        // Apply calibration FIRST to raw values
        let calAlpha = ((rawAlpha - calibrationValues.alpha + 360) % 360);
        let calBeta = rawBeta - calibrationValues.beta;
        let calGamma = rawGamma - calibrationValues.gamma;

        // Then apply manual offsets
        let offsetAlpha = ((calAlpha - manualOffsets.alpha + 360) % 360);
        let offsetBeta = calBeta - manualOffsets.beta;
        let offsetGamma = calGamma - manualOffsets.gamma;


        if (controlsInverted) {
            latestSensorData.alpha = (360 - offsetAlpha + 360) % 360;
            latestSensorData.beta = -offsetBeta;
            latestSensorData.gamma = -offsetGamma;
        } else {
            latestSensorData.alpha = offsetAlpha;
            latestSensorData.beta = offsetBeta;
            latestSensorData.gamma = offsetGamma;
        }
        latestSensorData.compassHeading = latestSensorData.alpha; 
        
        processSensorDataAndUpdate();
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
            // Fallback, less ideal for some applications
            latestSensorData.accelX = acc.x;
            latestSensorData.accelY = acc.y;
            latestSensorData.accelZ = acc.z;
        }
        
        processSensorDataAndUpdate();
    }

    function handleProximityEvent() {
        if (!globallyEnabled || !proximitySensorInstance) return;
        
        const proxSensorDetails = getSensorById('proximity');
        const maxDistance = proxSensorDetails ? proxSensorDetails.typicalMax : 25;
        
        // Normalize the proximity value to 0-100% range
        if (proximitySensorInstance.distance === null) {
            latestSensorData.proximity = 0; // Object is very close or sensor is covered
        } else {
            // Convert distance to a percentage (0% = closest, 100% = furthest)
            const normalizedDistance = Math.min(100, (proximitySensorInstance.distance / maxDistance) * 100);
            latestSensorData.proximity = normalizedDistance;
        }
        processSensorDataAndUpdate();
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

    async function setupMicrophoneSensor() {
        if (isMicSetup || !permissionGranted.microphone) return;

        try {
            // First request microphone permission explicitly
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            
            // Then set up audio context
            if (audioContext && audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            if (!audioContext || audioContext.state === 'closed') {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            analyserNode = audioContext.createAnalyser();
            microphoneSource = audioContext.createMediaStreamSource(stream);
            
            microphoneSource.connect(analyserNode);
            analyserNode.smoothingTimeConstant = 0.85;
            analyserNode.fftSize = 32;
            const bufferLength = analyserNode.frequencyBinCount;
            audioDataArray = new Uint8Array(bufferLength);
            
            isMicSetup = true;
            console.log("Microphone sensor setup complete.");
            updateMicVolumeLoop();

        } catch (err) {
            console.error('Error setting up microphone sensor:', err);
            if (err.name === 'NotAllowedError') {
                alert('Microphone access was denied. Please allow microphone access to use this feature.');
            } else if (err.name === 'NotFoundError') {
                alert('No microphone found. Please connect a microphone and try again.');
            } else {
                alert('Could not access microphone. Please ensure permission is granted and try again.');
            }
            permissionGranted.microphone = false;
            isMicSetup = false;
        }
    }

    function updateMicVolumeLoop() {
        if (!isMicSetup || !analyserNode || !globallyEnabled || !audioContext || audioContext.state === 'closed') {
            micVolumeUpdateId = null;
            return;
        }
        
        analyserNode.getByteFrequencyData(audioDataArray);
        
        // Calculate RMS (Root Mean Square) of the audio data for better volume representation
        let sum = 0;
        for (let i = 0; i < audioDataArray.length; i++) {
            sum += audioDataArray[i] * audioDataArray[i];
        }
        const rms = Math.sqrt(sum / audioDataArray.length);
        
        // Normalize to 0-100% with some amplification
        latestSensorData.micVolume = Math.min(100, (rms / 128) * 100);
        
        processSensorDataAndUpdate();
        
        micVolumeUpdateId = requestAnimationFrame(updateMicVolumeLoop);
    }
    
    async function requestSensorPermissions() {
        let orientationGrantedUser = false;
        let motionGrantedUser = false;
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
                if (state === 'granted') motionGrantedUser = true;
            } catch (e) { console.warn("Motion permission request failed:", e); }
        } else if ('DeviceMotionEvent' in window) {
            motionGrantedUser = true; 
        }

        let proximityAPIAvailable = false;
        if ('ProximitySensor' in window) {
           proximityAPIAvailable = true; 
        } else {
            console.warn("Proximity Sensor API not available in this browser/context.");
        }
        
        let microphoneCanBeRequested = false;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            microphoneCanBeRequested = true;
             // Initialize AudioContext here if not already, to handle user gesture requirement
            if (!audioContext) {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (audioContext.state === 'suspended') { // Attempt to resume if suspended
                        // This might need to be tied to a user interaction like the enable button itself
                        // For now, we just note it. User interaction on "Enable Sensors" should allow it.
                    }
                } catch (e) {
                    console.error("Could not create AudioContext:", e);
                    microphoneCanBeRequested = false;
                }
            }
        } else {
            console.warn("Microphone access (getUserMedia) not available.");
        }
        
        return { orientationGrantedUser, motionGrantedUser, proximityAPIAvailable, microphoneCanBeRequested };
    }
    
    async function enable() {
        // Ensure AudioContext is resumed if it was suspended, typically needs a user gesture.
        if (audioContext && audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch (e) {
                console.warn("Could not resume audio context on enable:", e);
            }
        }

        const permissions = await requestSensorPermissions();
        permissionGranted.orientation = permissions.orientationGrantedUser;
        permissionGranted.motion = permissions.motionGrantedUser;
        permissionGranted.proximity = permissions.proximityAPIAvailable;
        permissionGranted.microphone = permissions.microphoneCanBeRequested;

        if (!permissionGranted.orientation && !permissionGranted.motion && !permissionGranted.proximity && !permissionGranted.microphone) {
            alert('No sensor permissions granted or APIs available.');
            disable();
            return;
        }

        // Set up event listeners for orientation and motion
        if (permissionGranted.orientation) {
            window.addEventListener('deviceorientation', handleOrientationEvent, true);
        }
        if (permissionGranted.motion) {
            window.addEventListener('devicemotion', handleMotionEvent, true);
        }

        // Set up proximity sensor if available
        if (permissionGranted.proximity) {
            try {
                const proximityOptions = { frequency: 2 };
                proximitySensorInstance = new ProximitySensor(proximityOptions);
                proximitySensorInstance.addEventListener('reading', handleProximityEvent);
                proximitySensorInstance.addEventListener('error', handleProximityError);
                proximitySensorInstance.start();
                console.log("Proximity sensor started.");
            } catch (error) {
                console.warn('Proximity sensor could not be started:', error.name, error.message);
                permissionGranted.proximity = false;
                if (error.name === 'NotAllowedError') {
                    alert('Permission to use proximity sensor was denied by a feature policy or user.');
                }
            }
        }

        // Set up microphone if available
        if (permissionGranted.microphone) {
            try {
                if (!isMicSetup) {
                    await setupMicrophoneSensor();
                } else if (micVolumeUpdateId === null) {
                    updateMicVolumeLoop();
                }
            } catch (error) {
                console.error('Error setting up microphone:', error);
                permissionGranted.microphone = false;
            }
        }

        globallyEnabled = true;
        if (sensorToggleBtn) {
            sensorToggleBtn.textContent = 'Disable Sensors';
            sensorToggleBtn.classList.add('active');
        }
        console.log("Sensors enabled with permissions:", permissionGranted);
    }

    function disable() {
        window.removeEventListener('deviceorientation', handleOrientationEvent, true);
        window.removeEventListener('devicemotion', handleMotionEvent, true);
        
        if (proximitySensorInstance) {
            try {
                proximitySensorInstance.removeEventListener('reading', handleProximityEvent);
                proximitySensorInstance.removeEventListener('error', handleProximityError);
                proximitySensorInstance.stop();
            } catch (e) { console.warn("Error stopping proximity sensor:", e); }
            proximitySensorInstance = null;
        }
        
        if (micVolumeUpdateId) {
            cancelAnimationFrame(micVolumeUpdateId);
            micVolumeUpdateId = null;
        }
        // Don't destroy microphoneSource or audioContext on disable, just stop tracks if needed
        // and stop the update loop. This allows quicker re-enable.
        // However, if you want to fully release mic:
        if (microphoneSource && microphoneSource.mediaStream) {
             microphoneSource.mediaStream.getTracks().forEach(track => track.stop()); // Stop tracks to release mic
             // microphoneSource.disconnect(); // Disconnect if you plan to recreate source on enable
             // microphoneSource = null; // If recreating
        }
        // if (audioContext && audioContext.state !== 'closed') {
        //     audioContext.suspend(); // Suspend instead of close for faster resume
        // }
        // isMicSetup can remain true if we only suspend/stop tracks

        globallyEnabled = false;
        if (sensorToggleBtn) {
            sensorToggleBtn.textContent = 'Enable Sensors';
            sensorToggleBtn.classList.remove('active');
        }
        
        const defaultProximity = getSensorById('proximity') ? getSensorById('proximity').typicalMax : 25;
        latestSensorData = { 
            alpha: 0, beta: 0, gamma: 0, 
            accelX: 0, accelY: 0, accelZ: 0, 
            proximity: defaultProximity, micVolume: 0, compassHeading: 0 
        };
        // Reset smoothed data too
        smoothedSensorData = { ...latestSensorData };
        updateSensorDisplay(); // Show reset values
        
        // Update PointCloud with zeroed tilt if sensors are disabled
        if (pointCloudModuleRef && typeof pointCloudModuleRef.updateSensorTilt === 'function') {
            pointCloudModuleRef.updateSensorTilt(0, 0);
        }
        if (onSensorUpdateCallback) onSensorUpdateCallback(); // To reset mappings to defaults if sensors are off
        console.log("Sensors disabled.");
    }
    
    function init(sensorUpdCb, pModuleRef, pcModuleRef) { // Added pcModuleRef
        onSensorUpdateCallback = sensorUpdCb;
        playerModuleRef = pModuleRef;
        pointCloudModuleRef = pcModuleRef; // Store PointCloud module reference
        cacheDOMElements();
        if (smoothingSlider) smoothingFactor = parseFloat(smoothingSlider.value); // Init smoothingFactor
        setupEventListeners();
        updateConfigDisplay();
        updateSensorDisplay(); 
    }

    function getSensorValue(sensorId) {
        // For circular values, return the mapped value
        if (sensorId === 'alpha' || sensorId === 'compassHeading') {
            return mapCircularValue(smoothedSensorData[sensorId], 0, 360);
        }
        // For other sensors, return the smoothed value directly
        return smoothedSensorData[sensorId];
    }
    
    function hideControls() { if (sensorSectionControls) sensorSectionControls.classList.add('hidden'); }
    function showControls() { if (sensorSectionControls) sensorSectionControls.classList.remove('hidden'); }

    return {
        init,
        isGloballyEnabled: () => globallyEnabled,
        getSensorValue, // This now returns smoothed data
        hideControls, 
        showControls,
    };
})();
