// js/sensors.js
const Sensors = (function() {
    // Constants
    const SENSOR_CONFIG = {
        DEFAULT_SMOOTHING_FACTOR: 0.3,
        DEFAULT_PROXIMITY_MAX: 25,
        UPDATE_FREQUENCY: 2,
        CIRCULAR_SENSORS: ['alpha', 'compassHeading'],
        MAX_MIC_RETRIES: 3,
        MIC_UPDATE_INTERVAL: 50
    };

    const MIC_CONFIG = {
        ANALYZER: {
            smoothingTimeConstant: 0.3,
            fftSize: 512
        },
        AUDIO: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: 44100
        }
    };

    const ERROR_MESSAGES = {
        MICROPHONE: {
            'NotAllowedError': 'Microphone access was denied. Please allow microphone access to use this feature.',
            'NotFoundError': 'No microphone found. Please connect a microphone and try again.',
            'NotReadableError': 'Could not access microphone. The device may be in use by another application.',
            'default': 'Could not access microphone. Please ensure permission is granted and try again.'
        },
        SENSORS: {
            'noPermissions': 'No sensor permissions granted or APIs available.',
            'proximityNotAvailable': 'Proximity Sensor API not available in this browser/context.'
        }
    };

    // DOM Elements
    let sensorToggleBtn, orientAlphaEl, orientBetaEl, orientGammaEl, compassNeedle,
        alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, smoothingSlider,
        alphaSensValueEl, betaSensValueEl, gammaSensValueEl, smoothingValueEl,
        alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider,
        alphaOffsetValueEl, betaOffsetValueEl, gammaOffsetValueEl,
        calibrateBtn, invertBtn, sensorSectionControls, micVolumeValueEl;

    // Module References
    let playerModuleRef;
    let pointCloudModuleRef;

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
    
    // Sensor Data - Use safer initialization
    function createInitialSensorData() {
        let proximityMax = SENSOR_CONFIG.DEFAULT_PROXIMITY_MAX;
        
        // Safely get proximity sensor max value
        if (typeof getSensorById === 'function') {
            const proxSensor = getSensorById('proximity');
            if (proxSensor && proxSensor.typicalMax) {
                proximityMax = proxSensor.typicalMax;
            }
        }
        
        return {
            alpha: 0, beta: 0, gamma: 0,
            accelX: 0, accelY: 0, accelZ: 0,
            proximity: proximityMax,
            micVolume: 0,
            compassHeading: 0,
            gyroX: 0, gyroY: 0, gyroZ: 0,
            gravityX: 0, gravityY: 0, gravityZ: 0
        };
    }

    let latestSensorData = createInitialSensorData();
    let smoothedSensorData = Object.assign({}, latestSensorData);

    // Calibration and Configuration
    let calibrationValues = { alpha: 0, beta: 0, gamma: 0 };
    let manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
    let controlsInverted = false;
    let smoothingFactor = SENSOR_CONFIG.DEFAULT_SMOOTHING_FACTOR;

    // Callbacks
    let onSensorUpdateCallback = function() {};

    // Sensor Instances
    let proximitySensorInstance = null;

    // Audio handling
    let audioContext = null;
    let analyserNode = null;
    let microphoneSource = null;
    let audioDataArray = null;
    let micUpdateInterval = null;
    let currentMicStream = null;
    let micRetryCount = 0;

    // Utility Functions
    const Logger = {
        error: function(message, error) {
            console.error('[Sensors] ' + message, error);
        },
        warn: function(message) {
            console.warn('[Sensors] ' + message);
        },
        info: function(message) {
            console.log('[Sensors] ' + message);
        }
    };

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
        
        smoothingFactor = parseFloat(smoothingSlider.value);
        smoothingValueEl.textContent = smoothingFactor.toFixed(1);
        
        alphaOffsetValueEl.textContent = alphaOffsetSlider.value + '°';
        betaOffsetValueEl.textContent = betaOffsetSlider.value + '°';
        gammaOffsetValueEl.textContent = gammaOffsetSlider.value + '°';

        manualOffsets.alpha = parseFloat(alphaOffsetSlider.value);
        manualOffsets.beta = parseFloat(betaOffsetSlider.value);
        manualOffsets.gamma = parseFloat(gammaOffsetSlider.value);
    }
    
    function setupEventListeners() {
        if (sensorToggleBtn) {
            sensorToggleBtn.addEventListener('click', function() {
                if (globallyEnabled) {
                    disable();
                } else {
                    enable();
                }
            });
        }

        if (calibrateBtn) {
            calibrateBtn.addEventListener('click', function() {
                if (!globallyEnabled) { 
                    alert('Enable sensors first.'); 
                    return; 
                }
                
                calibrationValues.alpha = latestSensorData.alpha;
                calibrationValues.beta = latestSensorData.beta;
                calibrationValues.gamma = latestSensorData.gamma;
                
                manualOffsets = { alpha: 0, beta: 0, gamma: 0 };
                if(alphaOffsetSlider) alphaOffsetSlider.value = 0; 
                if(betaOffsetSlider) betaOffsetSlider.value = 0; 
                if(gammaOffsetSlider) gammaOffsetSlider.value = 0;
                updateConfigDisplay();

                alert('Sensors calibrated. Manual offsets reset.');

                if (playerModuleRef && playerModuleRef.resetFilters) {
                     playerModuleRef.resetFilters();
                }
                if (onSensorUpdateCallback) {
                    onSensorUpdateCallback();
                }
            });
        }
        
        if (invertBtn) {
            invertBtn.addEventListener('click', function() {
                controlsInverted = !controlsInverted;
                invertBtn.textContent = controlsInverted ? 'Controls Inverted' : 'Invert Controls';
                invertBtn.style.backgroundColor = controlsInverted ? '#f44336' : '#555';
                if (onSensorUpdateCallback) {
                    onSensorUpdateCallback();
                }
            });
        }

        const configSliders = [
            alphaSensitivitySlider, betaSensitivitySlider, gammaSensitivitySlider, 
            smoothingSlider, alphaOffsetSlider, betaOffsetSlider, gammaOffsetSlider
        ];

        for (let i = 0; i < configSliders.length; i++) {
            const slider = configSliders[i];
            if (slider) {
                slider.addEventListener('input', updateConfigDisplay);
            }
        }

        if (smoothingSlider) {
            smoothingSlider.addEventListener('input', function() {
                smoothingFactor = parseFloat(smoothingSlider.value);
                if (smoothingValueEl) {
                    smoothingValueEl.textContent = smoothingFactor.toFixed(1);
                }
            });
        }
    }
    
    function updateSensorDisplay() {
        function updateValue(elementId, value, decimals) {
            if (typeof decimals === 'undefined') decimals = 2;
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value != null ? value.toFixed(decimals) : '0.00';
            }
        }

        updateValue('orientAlpha', smoothedSensorData.alpha);
        updateValue('orientBeta', smoothedSensorData.beta);
        updateValue('orientGamma', smoothedSensorData.gamma);
        updateValue('proximityValue', smoothedSensorData.proximity, 1);
        updateValue('gyroXValue', smoothedSensorData.gyroX);
        updateValue('gyroYValue', smoothedSensorData.gyroY);
        updateValue('gyroZValue', smoothedSensorData.gyroZ);
        updateValue('gravityXValue', smoothedSensorData.gravityX);
        updateValue('gravityYValue', smoothedSensorData.gravityY);
        updateValue('gravityZValue', smoothedSensorData.gravityZ);
        
        if (compassNeedle) {
            compassNeedle.style.transform = 'rotate(' + (smoothedSensorData.alpha || 0) + 'deg)';
        }
    }

    function mapCircularValue(value, min, max) {
        if (value == null) return 0;
        
        const range = max - min;
        const halfRange = range / 2;
        
        let normalized = ((value - min) % range + range) % range;
        
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
        for (const key in latestSensorData) {
            if (!smoothedSensorData.hasOwnProperty(key)) continue;

            if (SENSOR_CONFIG.CIRCULAR_SENSORS.indexOf(key) !== -1) {
                const mappedValue = mapCircularValue(latestSensorData[key], 0, 360);
                const mappedSmoothed = mapCircularValue(smoothedSensorData[key], 0, 360);
                smoothedSensorData[key] = applySmoothing(mappedSmoothed, mappedValue);
            } else {
                smoothedSensorData[key] = applySmoothing(smoothedSensorData[key], latestSensorData[key]);
            }
        }

        updateSensorDisplay();

        if (pointCloudModuleRef && pointCloudModuleRef.updateSensorTilt) {
            pointCloudModuleRef.updateSensorTilt(smoothedSensorData.beta, smoothedSensorData.gamma);
        }

        if (onSensorUpdateCallback) {
            onSensorUpdateCallback();
        }
    }

    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        
        try {
            const rawAlpha = event.alpha || 0;
            const rawBeta = event.beta || 0;
            const rawGamma = event.gamma || 0;

            const calAlpha = ((rawAlpha - calibrationValues.alpha + 360) % 360);
            const calBeta = rawBeta - calibrationValues.beta;
            const calGamma = rawGamma - calibrationValues.gamma;

            const offsetAlpha = ((calAlpha - manualOffsets.alpha + 360) % 360);
            const offsetBeta = calBeta - manualOffsets.beta;
            const offsetGamma = calGamma - manualOffsets.gamma;

            latestSensorData.alpha = controlsInverted ? (360 - offsetAlpha + 360) % 360 : offsetAlpha;
            latestSensorData.beta = controlsInverted ? -offsetBeta : offsetBeta;
            latestSensorData.gamma = controlsInverted ? -offsetGamma : offsetGamma;
            latestSensorData.compassHeading = latestSensorData.alpha;
            
            processSensorDataAndUpdate();
        } catch (error) {
            Logger.error('Error processing orientation event:', error);
        }
    }

    function handleMotionEvent(event) {
        if (!globallyEnabled) return;

        try {
            const acceleration = event.acceleration;
            const accGravity = event.accelerationIncludingGravity;
            const rotationRate = event.rotationRate;

            if (acceleration && acceleration.x != null) {
                latestSensorData.accelX = acceleration.x;
                latestSensorData.accelY = acceleration.y;
                latestSensorData.accelZ = acceleration.z;
            } else if (accGravity && accGravity.x != null) {
                latestSensorData.accelX = accGravity.x;
                latestSensorData.accelY = accGravity.y;
                latestSensorData.accelZ = accGravity.z;
            }

            if (rotationRate) {
                latestSensorData.gyroX = rotationRate.alpha || 0;
                latestSensorData.gyroY = rotationRate.beta || 0;
                latestSensorData.gyroZ = rotationRate.gamma || 0;
            }

            if (accGravity) {
                latestSensorData.gravityX = accGravity.x || 0;
                latestSensorData.gravityY = accGravity.y || 0;
                latestSensorData.gravityZ = accGravity.z || 0;
            }
            
            processSensorDataAndUpdate();
        } catch (error) {
            Logger.error('Error processing motion event:', error);
        }
    }

    function handleProximityEvent() {
        if (!globallyEnabled || !proximitySensorInstance) return;
        
        try {
            let maxDistance = SENSOR_CONFIG.DEFAULT_PROXIMITY_MAX;
            
            // Safely get proximity sensor details
            if (typeof getSensorById === 'function') {
                const proxSensorDetails = getSensorById('proximity');
                if (proxSensorDetails && proxSensorDetails.typicalMax) {
                    maxDistance = proxSensorDetails.typicalMax;
                }
            }
            
            latestSensorData.proximity = proximitySensorInstance.distance === null
                ? 0
                : Math.min(100, (proximitySensorInstance.distance / maxDistance) * 100);

            processSensorDataAndUpdate();
        } catch (error) {
            Logger.error('Error processing proximity event:', error);
        }
    }

    function handleProximityError(event) {
        Logger.error('Proximity sensor error:', event.error.name, event.error.message);
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
                Logger.warn("Error stopping proximity sensor:", e);
            }
            proximitySensorInstance = null;
        }
        permissionGranted.proximity = false;
    }

    function setupProximitySensor() {
        return new Promise(function(resolve) {
            if (!permissionGranted.proximity) {
                resolve();
                return;
            }

            try {
                const proximityOptions = { frequency: SENSOR_CONFIG.UPDATE_FREQUENCY };
                proximitySensorInstance = new ProximitySensor(proximityOptions);
                proximitySensorInstance.addEventListener('reading', handleProximityEvent);
                proximitySensorInstance.addEventListener('error', handleProximityError);
                proximitySensorInstance.start().then(function() {
                    Logger.info("Proximity sensor started successfully.");
                    resolve();
                }).catch(function(error) {
                    Logger.warn('Failed to start proximity sensor:', error);
                    permissionGranted.proximity = false;
                    if (error.name === 'NotAllowedError') {
                        alert('Permission to use proximity sensor was denied. Please check your device settings.');
                    }
                    resolve();
                });
            } catch (error) {
                Logger.warn('Failed to create proximity sensor:', error);
                permissionGranted.proximity = false;
                resolve();
            }
        });
    }

    // MICROPHONE HANDLING
    function cleanupMicrophone() {
        Logger.info("Cleaning up microphone...");
        
        // Stop update interval
        if (micUpdateInterval) {
            clearInterval(micUpdateInterval);
            micUpdateInterval = null;
            Logger.info("Stopped mic update interval");
        }

        // Stop media stream tracks
        if (currentMicStream) {
            const tracks = currentMicStream.getTracks();
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                track.stop();
                Logger.info('Stopped microphone track: ' + track.label + ' (state: ' + track.readyState + ')');
            }
            currentMicStream = null;
        }

        // Disconnect audio nodes
        if (microphoneSource) {
            try {
                microphoneSource.disconnect();
                Logger.info("Disconnected microphone source");
            } catch (e) {
                Logger.warn('Error disconnecting microphone source:', e);
            }
            microphoneSource = null;
        }

        if (analyserNode) {
            try {
                analyserNode.disconnect();
                Logger.info("Disconnected analyser node");
            } catch (e) {
                Logger.warn('Error disconnecting analyser:', e);
            }
            analyserNode = null;
        }

        // Close audio context
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().then(function() {
                Logger.info('Audio context closed successfully');
                audioContext = null;
            }).catch(function(e) {
                Logger.warn('Error closing audio context:', e);
                audioContext = null;
            });
        } else {
            audioContext = null;
        }

        // Reset data array
        audioDataArray = null;
        
        // Reset mic volume display
        if (micVolumeValueEl) {
            micVolumeValueEl.textContent = '0.00';
            micVolumeValueEl.style.color = '';
        }
        
        // Reset sensor data
        latestSensorData.micVolume = 0;
        smoothedSensorData.micVolume = 0;
        
        Logger.info("Microphone cleanup complete");
    }

    function setupMicrophoneSensor() {
        return new Promise(function(resolve) {
            Logger.info("Setting up microphone sensor...");
            
            try {
                // Clean up any existing setup first
                cleanupMicrophone();
                
                // Create new audio context
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioContextClass();
                Logger.info('Audio context created, state: ' + audioContext.state);
                
                // Request microphone access with basic constraints
                const constraints = {
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                };
                
                Logger.info("Requesting microphone access...");
                navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
                    currentMicStream = stream;
                    Logger.info('Microphone access granted, got ' + currentMicStream.getTracks().length + ' tracks');
                    
                    // Resume audio context if suspended
                    if (audioContext.state === 'suspended') {
                        return audioContext.resume();
                    }
                    return Promise.resolve();
                }).then(function() {
                    Logger.info('Audio context resumed, new state: ' + audioContext.state);
                    
                    // Create audio nodes
                    analyserNode = audioContext.createAnalyser();
                    analyserNode.smoothingTimeConstant = MIC_CONFIG.ANALYZER.smoothingTimeConstant;
                    analyserNode.fftSize = MIC_CONFIG.ANALYZER.fftSize;
                    
                    microphoneSource = audioContext.createMediaStreamSource(currentMicStream);
                    
                    // Connect the nodes
                    microphoneSource.connect(analyserNode);
                    
                    // Create data array for frequency analysis
                    audioDataArray = new Uint8Array(analyserNode.frequencyBinCount);
                    
                    Logger.info('Audio setup complete - FFT size: ' + analyserNode.fftSize + ', Frequency bins: ' + analyserNode.frequencyBinCount);
                    
                    // Reset retry count on success
                    micRetryCount = 0;
                    
                    // Start the microphone monitoring
                    startMicrophoneMonitoring();
                    
                    Logger.info("Microphone sensor setup complete");
                    resolve();
                    
                }).catch(function(error) {
                    Logger.error('Error setting up microphone:', error);
                    handleMicrophoneError(error);
                    resolve();
                });
                
            } catch (error) {
                Logger.error('Error in microphone setup:', error);
                handleMicrophoneError(error);
                resolve();
            }
        });
    }

    function startMicrophoneMonitoring() {
        if (micUpdateInterval) {
            clearInterval(micUpdateInterval);
        }
        
        Logger.info("Starting microphone monitoring...");
        
        micUpdateInterval = setInterval(function() {
            if (!globallyEnabled || !analyserNode || !audioDataArray || 
                !audioContext || audioContext.state === 'closed') {
                Logger.warn("Microphone monitoring stopped - invalid state");
                return;
            }
            
            try {
                // Get frequency data
                analyserNode.getByteFrequencyData(audioDataArray);
                
                // Calculate volume using multiple methods for better accuracy
                let sum = 0;
                let max = 0;
                
                for (let i = 0; i < audioDataArray.length; i++) {
                    const value = audioDataArray[i];
                    sum += value * value; // For RMS
                    max = Math.max(max, value); // Peak value
                }
                
                // Calculate RMS (Root Mean Square) for average volume
                const rms = Math.sqrt(sum / audioDataArray.length);
                
                // Use RMS primarily, but boost with peak for responsiveness
                const combinedVolume = (rms * 0.7 + max * 0.3);
                
                // Convert to 0-100% with some amplification
                const volumePercent = Math.min(100, (combinedVolume / 128) * 150); // 150% amplification
                
                // Update sensor data
                latestSensorData.micVolume = volumePercent;
                
                // Apply smoothing and update
                processSensorDataAndUpdate();
                
            } catch (error) {
                Logger.error('Error in microphone monitoring:', error);
                cleanupMicrophone();
            }
            
        }, SENSOR_CONFIG.MIC_UPDATE_INTERVAL);
        
        Logger.info('Microphone monitoring started with ' + SENSOR_CONFIG.MIC_UPDATE_INTERVAL + 'ms interval');
    }

    function handleMicrophoneError(error) {
        Logger.error('Microphone error:', error);
        
        permissionGranted.microphone = false;
        cleanupMicrophone();

        // Update UI to show error
        if (micVolumeValueEl) {
            micVolumeValueEl.textContent = 'Error';
            micVolumeValueEl.style.color = '#ff4444';
        }

        // Retry logic for certain errors
        if ((error.name === 'NotReadableError' || error.name === 'AbortError') && 
            micRetryCount < SENSOR_CONFIG.MAX_MIC_RETRIES) {
            micRetryCount++;
            Logger.info('Retrying microphone setup (attempt ' + micRetryCount + '/' + SENSOR_CONFIG.MAX_MIC_RETRIES + ')');
            
            setTimeout(function() {
                if (globallyEnabled) {
                    setupMicrophoneSensor();
                }
            }, 1000 * micRetryCount);
            return;
        }

        // Show user-friendly error message
        const errorMsg = ERROR_MESSAGES.MICROPHONE[error.name] || ERROR_MESSAGES.MICROPHONE.default;
        alert(errorMsg);
    }
    
    function requestSensorPermissions() {
        return new Promise(function(resolve) {
            let orientationGrantedUser = false;
            let motionGrantedUser = false;
            let gyroscopeAvailable = false;
            let gravityAvailable = false;
            let microphoneGranted = false;

            const promises = [];

            if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
                promises.push(
                    DeviceOrientationEvent.requestPermission().then(function(state) {
                        if (state === 'granted') orientationGrantedUser = true;
                    }).catch(function(e) { 
                        Logger.warn("Orientation permission request failed:", e); 
                    })
                );
            } else if ('DeviceOrientationEvent' in window) {
                orientationGrantedUser = true; 
            }

            if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
                promises.push(
                    DeviceMotionEvent.requestPermission().then(function(state) {
                        if (state === 'granted') {
                            motionGrantedUser = true;
                            gyroscopeAvailable = true;
                            gravityAvailable = true;
                        }
                    }).catch(function(e) { 
                        Logger.warn("Motion permission request failed:", e); 
                    })
                );
            } else if ('DeviceMotionEvent' in window) {
                motionGrantedUser = true;
                gyroscopeAvailable = true;
                gravityAvailable = true;
            }

            let proximityAPIAvailable = false;
            if ('ProximitySensor' in window) {
               proximityAPIAvailable = true; 
            } else {
                Logger.warn(ERROR_MESSAGES.SENSORS.proximityNotAvailable);
            }

            // Check microphone availability
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                promises.push(
                    navigator.mediaDevices.getUserMedia({ 
                        audio: { echoCancellation: false } 
                    }).then(function(testStream) {
                        const tracks = testStream.getTracks();
                        for (let i = 0; i < tracks.length; i++) {
                            tracks[i].stop();
                        }
                        microphoneGranted = true;
                        Logger.info("Microphone access test successful");
                    }).catch(function(error) {
                        Logger.warn("Microphone access test failed:", error);
                        microphoneGranted = false;
                    })
                );
            }

            Promise.all(promises).finally(function() {
                resolve({ 
                    orientationGrantedUser: orientationGrantedUser, 
                    motionGrantedUser: motionGrantedUser, 
                    proximityAPIAvailable: proximityAPIAvailable, 
                    microphoneGranted: microphoneGranted,
                    gyroscopeAvailable: gyroscopeAvailable,
                    gravityAvailable: gravityAvailable
                });
            });
        });
    }
    
    function enable() {
        Logger.info("Enabling sensors...");
        
        // Request and check permissions
        requestSensorPermissions().then(function(permissions) {
            permissionGranted.orientation = permissions.orientationGrantedUser;
            permissionGranted.motion = permissions.motionGrantedUser;
            permissionGranted.proximity = permissions.proximityAPIAvailable;
            permissionGranted.microphone = permissions.microphoneGranted;
            permissionGranted.gyroscope = permissions.gyroscopeAvailable;
            permissionGranted.gravity = permissions.gravityAvailable;

            Logger.info("Permissions granted:", permissionGranted);

            const hasAnyPermission = permissionGranted.orientation || permissionGranted.motion || 
                                   permissionGranted.proximity || permissionGranted.microphone;

            if (!hasAnyPermission) {
                throw new Error(ERROR_MESSAGES.SENSORS.noPermissions);
            }

            // Set up event listeners
            if (permissionGranted.orientation) {
                window.addEventListener('deviceorientation', handleOrientationEvent, true);
                Logger.info("Device orientation listener added");
            }
            if (permissionGranted.motion) {
                window.addEventListener('devicemotion', handleMotionEvent, true);
                Logger.info("Device motion listener added");
            }

            // Initialize sensors
            const sensorPromises = [];
            
            if (permissionGranted.proximity) {
                sensorPromises.push(setupProximitySensor());
            }
            
            if (permissionGranted.microphone) {
                sensorPromises.push(setupMicrophoneSensor());
            }

            return Promise.all(sensorPromises);
        }).then(function() {
            globallyEnabled = true;
            updateUIState(true);
            Logger.info("Sensors enabled successfully");
        }).catch(function(error) {
            Logger.error('Failed to enable sensors:', error);
            alert(error.message || 'Failed to enable sensors');
            disable();
        });
    }

    function disable() {
        Logger.info("Disabling sensors...");
        
        globallyEnabled = false;
        updateUIState(false);
        
        // Clean up microphone
        cleanupMicrophone();

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
                Logger.warn("Error stopping proximity sensor:", error);
            }
            proximitySensorInstance = null;
        }

        // Reset state
        latestSensorData = createInitialSensorData();
        smoothedSensorData = Object.assign({}, latestSensorData);
        
        // Update UI and effects
        updateSensorDisplay();
        
        if (pointCloudModuleRef && pointCloudModuleRef.updateSensorTilt) {
            pointCloudModuleRef.updateSensorTilt(0, 0);
        }
        if (onSensorUpdateCallback) {
            onSensorUpdateCallback();
        }
        
        Logger.info("Sensors disabled successfully");
    }

    function updateUIState(enabled) {
        if (sensorToggleBtn) {
            sensorToggleBtn.textContent = enabled ? 'Disable Sensors' : 'Enable Sensors';
            sensorToggleBtn.classList.toggle('active', enabled);
        }
    }

    function init(sensorUpdCb, pModuleRef, pcModuleRef) {
        try {
            Logger.info("Initializing sensors module...");
            
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
            
            // Add visibility change handler for audio context management
            document.addEventListener('visibilitychange', function() {
                if (document.hidden && audioContext && audioContext.state === 'running') {
                    audioContext.suspend().then(function() {
                        Logger.info('Audio context suspended due to page visibility change');
                    }).catch(function(e) {
                        Logger.warn('Error suspending audio context:', e);
                    });
                } else if (!document.hidden && audioContext && audioContext.state === 'suspended' && globallyEnabled) {
                    audioContext.resume().then(function() {
                        Logger.info('Audio context resumed after page became visible');
                    }).catch(function(e) {
                        Logger.warn('Error resuming audio context:', e);
                    });
                }
            });
            
            Logger.info("Sensors module initialized successfully");
            
        } catch (error) {
            Logger.error('Error initializing sensors:', error);
        }
    }

    function getSensorValue(sensorId) {
        if (!sensorId || !smoothedSensorData.hasOwnProperty(sensorId)) {
            return null;
        }

        // For circular values, return the mapped value
        if (SENSOR_CONFIG.CIRCULAR_SENSORS.indexOf(sensorId) !== -1) {
            return mapCircularValue(smoothedSensorData[sensorId], 0, 360);
        }
        
        // For other sensors, return the smoothed value directly
        return smoothedSensorData[sensorId];
    }
    
    function hideControls() { 
        if (sensorSectionControls) {
            sensorSectionControls.classList.add('hidden'); 
        }
    }
    
    function showControls() { 
        if (sensorSectionControls) {
            sensorSectionControls.classList.remove('hidden'); 
        }
    }

    // Public API
    return {
        init: init,
        isGloballyEnabled: function() { return globallyEnabled; },
        getSensorValue: getSensorValue,
        hideControls: hideControls,
        showControls: showControls
    };
})();
