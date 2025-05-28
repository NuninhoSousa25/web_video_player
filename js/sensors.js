
// js/sensors.js
const Sensors = (function() {
    let sensorToggleBtn; // Only this element remains
    // Removed: orientAlphaEl, orientBetaEl, orientGammaEl, compassNeedle, micVolumeDisplayEl,
    // alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider,
    // alphaSensValueEl, betaSensValueEl, gammaSensValueEl, smoothingValueEl,
    // alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider,
    // alphaOffsetValueEl, betaOffsetValueEl, gammaOffsetValueEl,
    // calibrateBtn, invertBtn, sensorSectionControls;

    let playerModuleRef;
    let pointCloudModuleRef; 

    let globallyEnabled = false;
    let permissionGranted = {
        orientation: false,
        motion: false,
        proximity: false, 
        microphone: false 
    };
    
    // Internal sensor data storage (no longer directly displayed)
    let latestSensorData = {
        alpha: 0, beta: 0, gamma: 0,
        accelX: 0, accelY: 0, accelZ: 0,
        proximity: getSensorById('proximity') ? getSensorById('proximity').typicalMax : 25, 
        micVolume: 0,
        compassHeading: 0 
    };

    let smoothedSensorData = { ...latestSensorData }; 

    // Default internal configuration values (no longer tied to UI sliders)
    let calibrationValues = { alpha: 0, beta: 0, gamma: 0 };
    let manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
    let controlsInverted = false;
    let smoothingFactor = 0.3; 

    let onSensorUpdateCallback = () => {}; 

    let proximitySensorInstance = null;

    let audioContext = null;
    let analyserNode = null;
    let microphoneSource = null;
    let audioDataArray = null;
    let micVolumeUpdateId = null;
    let isMicSetup = false;


    function cacheDOMElements() {
        sensorToggleBtn = document.getElementById('sensorToggleBtn');
        // All other sensor-related UI elements are removed from HTML and thus from cache
    }

    // `updateConfigDisplay` function is removed as there are no longer config sliders to update.
    
    function setupEventListeners() {
        if (sensorToggleBtn) sensorToggleBtn.addEventListener('click', () => globallyEnabled ? disable() : enable());

        // Removed all other event listeners for calibrate, invert, and config sliders.
    }
    
    function applySmoothing(currentSmoothed, rawNewValue) {
        if (smoothingFactor === 0) return rawNewValue; 
        const current = Number(currentSmoothed) || 0;
        const raw = Number(rawNewValue) || 0;
        return current * smoothingFactor + raw * (1 - smoothingFactor);
    }

    // `updateSensorDisplay` function is removed as there are no longer elements to display sensor values.

    function processSensorDataAndUpdate() {
        // Apply smoothing to all relevant sensor data
        for (const key in latestSensorData) {
            if (smoothedSensorData.hasOwnProperty(key)) {
                if (key === 'alpha' || key === 'compassHeading') {
                    // Smoothing for alpha with wrap-around consideration
                    let diff = latestSensorData[key] - smoothedSensorData[key];
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    smoothedSensorData[key] = (smoothedSensorData[key] + diff * (1 - smoothingFactor) + 360) % 360;
                } else {
                    smoothedSensorData[key] = applySmoothing(smoothedSensorData[key], latestSensorData[key]);
                }
            }
        }

        // Removed updateSensorDisplay() call

        // Update PointCloud with smoothed beta and gamma for parallax
        if (pointCloudModuleRef && typeof pointCloudModuleRef.updateSensorTilt === 'function') {
            pointCloudModuleRef.updateSensorTilt(smoothedSensorData.beta, smoothedSensorData.gamma);
        }

        if (onSensorUpdateCallback) {
            onSensorUpdateCallback(); 
        }
    }


    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        
        let rawAlpha = event.alpha || 0;
        let rawBeta = event.beta || 0;
        let rawGamma = event.gamma || 0;

        // Apply calibration and manual offsets internally
        let processedAlpha = ((rawAlpha - calibrationValues.alpha + 360) % 360);
        let processedBeta = rawBeta - calibrationValues.beta;
        let processedGamma = rawGamma - calibrationValues.gamma;

        processedAlpha = ((processedAlpha - manualOffsets.alpha + 360) % 360);
        processedBeta -= manualOffsets.beta;
        processedGamma -= manualOffsets.gamma;

        if (controlsInverted) {
            latestSensorData.alpha = (360 - processedAlpha + 360) % 360;
            latestSensorData.beta = -processedBeta;
            latestSensorData.gamma = -processedGamma;
        } else {
            latestSensorData.alpha = processedAlpha;
            latestSensorData.beta = processedBeta;
            latestSensorData.gamma = processedGamma;
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
            latestSensorData.accelX = acc.x;
            latestSensorData.accelY = acc.y;
            latestSensorData.accelZ = acc.z;
        }
        
        processSensorDataAndUpdate();
    }

    function handleProximityEvent() {
        if (!globallyEnabled || !proximitySensorInstance) return;
        
        const proxSensorDetails = getSensorById('proximity');
        if (proximitySensorInstance.distance === null) {
            latestSensorData.proximity = proxSensorDetails ? proxSensorDetails.typicalMax : 25;
        } else {
            latestSensorData.proximity = proximitySensorInstance.distance;
        }
        processSensorDataAndUpdate();
    }

    function handleProximityError(event) {
        console.error('Proximity sensor error:', event.error.name, event.error.message);
        if (event.error.name === 'NotAllowedError') {
            // alert('Access to the proximity sensor is not allowed by Feature Policy or user denial.'); // Removed alert
        }
        if (proximitySensorInstance) {
            try { proximitySensorInstance.stop(); } catch(e){}
            proximitySensorInstance = null;
        }
        permissionGranted.proximity = false;
    }

    async function setupMicrophoneSensor() {
        if (isMicSetup || !permissionGranted.microphone) return;

        try {
            if (audioContext && audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            if (!audioContext || audioContext.state === 'closed') { 
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
        
        let maxVal = 0;
        for (let i = 0; i < audioDataArray.length; i++) {
            if (audioDataArray[i] > maxVal) {
                maxVal = audioDataArray[i];
            }
        }
        latestSensorData.micVolume = (maxVal / 255) * 100; 
        
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
            if (!audioContext) {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume().catch(e => console.warn("Could not resume audio context on enable:", e));
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
        
        if (permissionGranted.orientation) {
            window.addEventListener('deviceorientation', handleOrientationEvent, true);
        } else {
            console.warn("Device Orientation permission not granted or API not available.");
        }
        if (permissionGranted.motion) {
            window.addEventListener('devicotion', handleMotionEvent, true); // Typo corrected: devicemotion
        } else {
            console.warn("Device Motion permission not granted or API not available.");
        }
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
                     // alert('Permission to use proximity sensor was denied by a feature policy or user.'); // Removed alert
                }
            }
        }
        if (permissionGranted.microphone) { 
            if (!isMicSetup) { 
                await setupMicrophoneSensor(); 
            } else if (micVolumeUpdateId === null) { 
                 updateMicVolumeLoop(); 
            }
        }
        
        globallyEnabled = true;
        if(sensorToggleBtn) {
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
        if (microphoneSource && microphoneSource.mediaStream) {
             microphoneSource.mediaStream.getTracks().forEach(track => track.stop()); 
        }

        globallyEnabled = false;
        if (sensorToggleBtn) {
            sensorToggleBtn.textContent = 'Enable Sensors';
            sensorToggleBtn.classList.remove('active');
        }
        
        // Reset internal sensor data to defaults when disabled
        const defaultProximity = getSensorById('proximity') ? getSensorById('proximity').typicalMax : 25;
        latestSensorData = { 
            alpha: 0, beta: 0, gamma: 0, 
            accelX: 0, accelY: 0, accelZ: 0, 
            proximity: defaultProximity, micVolume: 0, compassHeading: 0 
        };
        smoothedSensorData = { ...latestSensorData };
        
        // Update PointCloud with zeroed tilt if sensors are disabled
        if (pointCloudModuleRef && typeof pointCloudModuleRef.updateSensorTilt === 'function') {
            pointCloudModuleRef.updateSensorTilt(0, 0);
        }
        if (onSensorUpdateCallback) onSensorUpdateCallback(); 
        console.log("Sensors disabled.");
    }
    
    function init(sensorUpdCb, pModuleRef, pcModuleRef) { 
        onSensorUpdateCallback = sensorUpdCb;
        playerModuleRef = pModuleRef;
        pointCloudModuleRef = pcModuleRef; 
        cacheDOMElements();
        // Removed updateConfigDisplay() and updateSensorDisplay() calls
        setupEventListeners();
    }

    function getSensorValue(sensorId) {
        return smoothedSensorData[sensorId];
    }
    
    // `hideControls` and `showControls` are removed as the entire section below toggle is removed.

    return {
        init,
        isGloballyEnabled: () => globallyEnabled,
        getSensorValue, 
    };
})();
