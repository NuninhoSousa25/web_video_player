// js/sensors.js
const Sensors = (function() {
    let sensorToggleBtn, orientAlphaEl, orientBetaEl, orientGammaEl, compassNeedle,
        alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider,
        alphaSensValueEl, betaSensValueEl, gammaSensValueEl, smoothingValueEl,
        alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider,
        alphaOffsetValueEl, betaOffsetValueEl, gammaOffsetValueEl,
        calibrateBtn, invertBtn, sensorSectionControls;

    let playerModuleRef;

    let globallyEnabled = false;
    let permissionGranted = {
        orientation: false,
        motion: false,
        proximity: false, // New
        microphone: false // New
    };
    
    let latestSensorData = {
        alpha: 0, beta: 0, gamma: 0,
        accelX: 0, accelY: 0, accelZ: 0,
        proximity: getSensorById('proximity') ? getSensorById('proximity').typicalMax : 25, // Default to far/max typical
        micVolume: 0,
        compassHeading: 0 // Alias for alpha
    };

    let calibrationValues = { alpha: 0, beta: 0, gamma: 0 };
    let manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
    let controlsInverted = false;

    let onSensorUpdateCallback = () => {};

    // For Proximity
    let proximitySensorInstance = null;

    // For Microphone
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

        configSliders.forEach((slider) => {
            if (slider) {
                slider.addEventListener('input', updateConfigDisplay);
            }
        });
    }

    function updateSensorDisplay() {
        if(orientAlphaEl) orientAlphaEl.textContent = (latestSensorData.alpha != null ? latestSensorData.alpha.toFixed(2) : '0.00');
        if(orientBetaEl) orientBetaEl.textContent = (latestSensorData.beta != null ? latestSensorData.beta.toFixed(2) : '0.00');
        if(orientGammaEl) orientGammaEl.textContent = (latestSensorData.gamma != null ? latestSensorData.gamma.toFixed(2) : '0.00');
        
        if (compassNeedle) compassNeedle.style.transform = `rotate(${(latestSensorData.alpha || 0)}deg)`;
        // UI display for new sensors (proximity, micVolume) can be added here if HTML elements are created for them.
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
        latestSensorData.compassHeading = latestSensorData.alpha; // Update compass alias
        
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

    function handleProximityEvent() {
        if (!globallyEnabled || !proximitySensorInstance) return;
        
        // Proximity sensor value is distance in cm. Can be null if object is out of sensing range.
        // Default to typicalMax (far) if null, otherwise use the reported distance.
        const proxSensorDetails = getSensorById('proximity');
        if (proximitySensorInstance.distance === null) {
            latestSensorData.proximity = proxSensorDetails ? proxSensorDetails.typicalMax : 25;
        } else {
            latestSensorData.proximity = proximitySensorInstance.distance;
        }

        if (onSensorUpdateCallback) onSensorUpdateCallback();
    }

    function handleProximityError(event) {
        console.error('Proximity sensor error:', event.error.name, event.error.message);
        if (event.error.name === 'NotAllowedError') {
            alert('Access to the proximity sensor is not allowed by Feature Policy or user denial.');
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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyserNode = audioContext.createAnalyser();
            microphoneSource = audioContext.createMediaStreamSource(stream);
            
            microphoneSource.connect(analyserNode);
            analyserNode.fftSize = 256; // Lower values are less CPU intensive
            const bufferLength = analyserNode.frequencyBinCount;
            audioDataArray = new Uint8Array(bufferLength);
            
            isMicSetup = true;
            console.log("Microphone sensor setup complete.");
            updateMicVolumeLoop(); // Start the loop

        } catch (err) {
            console.error('Error setting up microphone sensor:', err);
            alert('Could not access microphone. Please ensure permission is granted.');
            permissionGranted.microphone = false; // Revoke if setup failed
        }
    }

    function updateMicVolumeLoop() {
        if (!isMicSetup || !analyserNode || !globallyEnabled || !audioContext || audioContext.state === 'closed') {
            micVolumeUpdateId = null;
            return;
        }
        
        analyserNode.getByteFrequencyData(audioDataArray); // Populate audioDataArray with frequency data.
                                                           // Or use getByteTimeDomainData for waveform.
        
        let sum = 0;
        for (let i = 0; i < audioDataArray.length; i++) {
            sum += audioDataArray[i];
        }
        let average = sum / audioDataArray.length;
        latestSensorData.micVolume = (average / 255) * 100; // Normalize to 0-100 (assuming data is 0-255)
        
        // Optional: Update a UI element for mic volume here if one exists
        if (onSensorUpdateCallback) onSensorUpdateCallback();
        
        micVolumeUpdateId = requestAnimationFrame(updateMicVolumeLoop);
    }
    
    async function requestSensorPermissions() {
        // Orientation & Motion (iOS specific request model)
        let orientationGrantedUser = false;
        let motionGrantedUser = false;
        if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
            try {
                const state = await DeviceOrientationEvent.requestPermission();
                if (state === 'granted') orientationGrantedUser = true;
            } catch (e) { console.warn("Orientation permission request failed:", e); }
        } else if ('DeviceOrientationEvent' in window) {
            orientationGrantedUser = true; // Assume granted if API exists and no requestPermission method
        }

        if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
             try {
                const state = await DeviceMotionEvent.requestPermission();
                if (state === 'granted') motionGrantedUser = true;
            } catch (e) { console.warn("Motion permission request failed:", e); }
        } else if ('DeviceMotionEvent' in window) {
            motionGrantedUser = true; // Assume granted
        }

        // Proximity (check API availability)
        let proximityAPIAvailable = false;
        if ('ProximitySensor' in window) {
           proximityAPIAvailable = true; // Actual start attempt in enable()
        } else {
            console.warn("Proximity Sensor API not available in this browser/context.");
        }
        
        // Microphone (check API availability, actual request on enable)
        let microphoneCanBeRequested = false;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            microphoneCanBeRequested = true;
        } else {
            console.warn("Microphone access (getUserMedia) not available.");
        }
        
        return { orientationGrantedUser, motionGrantedUser, proximityAPIAvailable, microphoneCanBeRequested };
    }
    
    async function enable() {
        const permissions = await requestSensorPermissions();
        permissionGranted.orientation = permissions.orientationGrantedUser;
        permissionGranted.motion = permissions.motionGrantedUser;
        permissionGranted.proximity = permissions.proximityAPIAvailable; // Tentative, confirmed on successful start
        permissionGranted.microphone = permissions.microphoneCanBeRequested; // Tentative, confirmed on successful getUserMedia

        if (!permissionGranted.orientation && !permissionGranted.motion && !permissionGranted.proximity && !permissionGranted.microphone) {
            alert('No sensor permissions granted or APIs available.');
            disable(); // Ensure clean state
            return;
        }
        
        // --- Orientation ---
        if (permissionGranted.orientation) {
            window.addEventListener('deviceorientation', handleOrientationEvent, true);
        } else {
            console.warn("Device Orientation permission not granted or API not available.");
        }
        // --- Motion ---
        if (permissionGranted.motion) {
            window.addEventListener('devicemotion', handleMotionEvent, true);
        } else {
            console.warn("Device Motion permission not granted or API not available.");
        }
        // --- Proximity ---
        if (permissionGranted.proximity) { // API available, now try to start
            try {
                // Define default options for the sensor
                const proximityOptions = { frequency: 2 }; // Read twice per second, adjust as needed
                proximitySensorInstance = new ProximitySensor(proximityOptions);
                proximitySensorInstance.addEventListener('reading', handleProximityEvent);
                proximitySensorInstance.addEventListener('error', handleProximityError);
                proximitySensorInstance.start();
                console.log("Proximity sensor started.");
            } catch (error) {
                console.warn('Proximity sensor could not be started:', error.name, error.message);
                permissionGranted.proximity = false; // Mark as failed
                if (error.name === 'NotAllowedError') { // Specifically for feature policy or permissions
                     alert('Permission to use proximity sensor was denied by a feature policy or user.');
                }
            }
        }
        // --- Microphone ---
        if (permissionGranted.microphone) { // API available, try to get stream & setup
            await setupMicrophoneSensor(); // This will internally update permissionGranted.microphone if it fails
        }
        
        globallyEnabled = true;
        if(sensorToggleBtn) {
            sensorToggleBtn.textContent = 'Disable Sensors';
            sensorToggleBtn.classList.add('active');
        }
        console.log("Sensors enabled with permissions:", permissionGranted);
    }

    function disable() {
        // Orientation & Motion
        window.removeEventListener('deviceorientation', handleOrientationEvent, true);
        window.removeEventListener('devicemotion', handleMotionEvent, true);
        
        // Proximity
        if (proximitySensorInstance) {
            try {
                proximitySensorInstance.removeEventListener('reading', handleProximityEvent);
                proximitySensorInstance.removeEventListener('error', handleProximityError);
                proximitySensorInstance.stop();
            } catch (e) { console.warn("Error stopping proximity sensor:", e); }
            proximitySensorInstance = null;
        }
        
        // Microphone
        if (micVolumeUpdateId) {
            cancelAnimationFrame(micVolumeUpdateId);
            micVolumeUpdateId = null;
        }
        if (microphoneSource) {
            microphoneSource.disconnect();
            if (microphoneSource.mediaStream) { // Check if mediaStream exists
                microphoneSource.mediaStream.getTracks().forEach(track => track.stop());
            }
            microphoneSource = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().catch(e => console.warn("Error closing audio context:", e));
            audioContext = null;
        }
        analyserNode = null;
        audioDataArray = null;
        isMicSetup = false;

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
        updateSensorDisplay();
        if (onSensorUpdateCallback) onSensorUpdateCallback();
        console.log("Sensors disabled.");
    }
    
    function init(sensorUpdCb, pModuleRef) {
        onSensorUpdateCallback = sensorUpdCb;
        playerModuleRef = pModuleRef;
        cacheDOMElements();
        setupEventListeners();
        updateConfigDisplay();
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
