// js/sensors.js - Simplified version without live displays and calibration
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

    // DOM Elements - Only the toggle button now
    let sensorToggleBtn, sensorSectionControls;

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
    
    // Sensor Data
    function createInitialSensorData() {
        let proximityMax = SENSOR_CONFIG.DEFAULT_PROXIMITY_MAX;
        
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

    // Configuration - simplified, no user controls
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

    // Device capabilities
    let deviceCapabilities = {
        hasTouch: false,
        hasMotionSensors: false
    };

    // Utility Functions
    const Logger = {
        error: (message, ...args) => console.error('[Sensors]', message, ...args),
        warn: (message, ...args) => console.warn('[Sensors]', message, ...args),
        info: (message, ...args) => console.log('[Sensors]', message, ...args)
    };

    function cacheDOMElements() {
        sensorToggleBtn = document.getElementById('sensorToggleBtn');
        sensorSectionControls = document.getElementById('sensorSectionControls'); 
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

        // Update point cloud if available
        if (pointCloudModuleRef && pointCloudModuleRef.updateSensorTilt) {
            pointCloudModuleRef.updateSensorTilt(smoothedSensorData.beta, smoothedSensorData.gamma);
        }

        // Trigger mappings update
        if (onSensorUpdateCallback) {
            onSensorUpdateCallback();
        }
    }

    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        
        try {
            // Simple handling without calibration or offsets
            latestSensorData.alpha = event.alpha || 0;
            latestSensorData.beta = event.beta || 0;
            latestSensorData.gamma = event.gamma || 0;
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
        
        if (micUpdateInterval) {
            clearInterval(micUpdateInterval);
            micUpdateInterval = null;
        }

        if (currentMicStream) {
            const tracks = currentMicStream.getTracks();
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                track.stop();
            }
            currentMicStream = null;
        }

        if (microphoneSource) {
            try {
                microphoneSource.disconnect();
            } catch (e) {
                Logger.warn('Error disconnecting microphone source:', e);
            }
            microphoneSource = null;
        }

        if (analyserNode) {
            try {
                analyserNode.disconnect();
            } catch (e) {
                Logger.warn('Error disconnecting analyser:', e);
            }
            analyserNode = null;
        }

        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().then(function() {
                audioContext = null;
            }).catch(function(e) {
                Logger.warn('Error closing audio context:', e);
                audioContext = null;
            });
        } else {
            audioContext = null;
        }

        audioDataArray = null;
        latestSensorData.micVolume = 0;
        smoothedSensorData.micVolume = 0;
    }

    function setupMicrophoneSensor() {
        return new Promise(function(resolve) {
            Logger.info("Setting up microphone sensor...");
            
            try {
                cleanupMicrophone();
                
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioContextClass();
                
                const constraints = {
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                };
                
                navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
                    currentMicStream = stream;
                    
                    if (audioContext.state === 'suspended') {
                        return audioContext.resume();
                    }
                    return Promise.resolve();
                }).then(function() {
                    analyserNode = audioContext.createAnalyser();
                    analyserNode.smoothingTimeConstant = MIC_CONFIG.ANALYZER.smoothingTimeConstant;
                    analyserNode.fftSize = MIC_CONFIG.ANALYZER.fftSize;
                    
                    microphoneSource = audioContext.createMediaStreamSource(currentMicStream);
                    microphoneSource.connect(analyserNode);
                    
                    audioDataArray = new Uint8Array(analyserNode.frequencyBinCount);
                    
                    micRetryCount = 0;
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
        
        micUpdateInterval = setInterval(function() {
            if (!globallyEnabled || !analyserNode || !audioDataArray || 
                !audioContext || audioContext.state === 'closed') {
                return;
            }
            
            try {
                analyserNode.getByteFrequencyData(audioDataArray);
                
                let sum = 0;
                let max = 0;
                
                for (let i = 0; i < audioDataArray.length; i++) {
                    const value = audioDataArray[i];
                    sum += value * value;
                    max = Math.max(max, value);
                }
                
                const rms = Math.sqrt(sum / audioDataArray.length);
                const combinedVolume = (rms * 0.7 + max * 0.3);
                const volumePercent = Math.min(100, (combinedVolume / 128) * 150);
                
                latestSensorData.micVolume = volumePercent;
                processSensorDataAndUpdate();
                
            } catch (error) {
                Logger.error('Error in microphone monitoring:', error);
                cleanupMicrophone();
            }
            
        }, SENSOR_CONFIG.MIC_UPDATE_INTERVAL);
    }

    function handleMicrophoneError(error) {
        Logger.error('Microphone error:', error);
        
        permissionGranted.microphone = false;
        cleanupMicrophone();

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

        const errorMsg = ERROR_MESSAGES.MICROPHONE[error.name] || ERROR_MESSAGES.MICROPHONE.default;
        alert(errorMsg);
    }
    
    function requestSensorPermissions() {
        return new Promise(function(resolve) {
            let orientationGrantedUser = false;
            let motionGrantedUser = false;
            let proximityAPIAvailable = false;
            let microphoneGranted = false;

            const promises = [];

            if (deviceCapabilities.hasMotionSensors) {
                Logger.info("Attempting to request motion sensor permissions...");
                if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
                    promises.push(
                        DeviceOrientationEvent.requestPermission().then(state => {
                            if (state === 'granted') orientationGrantedUser = true;
                        }).catch(e => Logger.warn("Orientation permission request failed:", e))
                    );
                } else if ('DeviceOrientationEvent' in window) {
                    orientationGrantedUser = true; 
                }

                if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
                    promises.push(
                        DeviceMotionEvent.requestPermission().then(state => {
                            if (state === 'granted') motionGrantedUser = true;
                        }).catch(e => Logger.warn("Motion permission request failed:", e))
                    );
                } else if ('DeviceMotionEvent' in window) {
                    motionGrantedUser = true;
                }
            } else {
                Logger.info("Skipping motion sensor permission requests (not supported).");
            }
            
            if ('ProximitySensor' in window) {
               proximityAPIAvailable = true; 
            }

            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                promises.push(
                    navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(testStream => {
                        testStream.getTracks().forEach(track => track.stop());
                        microphoneGranted = true;
                        Logger.info("Microphone access test successful");
                    }).catch(error => {
                        Logger.warn("Microphone access test failed:", error.name);
                        microphoneGranted = false;
                    })
                );
            }

            Promise.all(promises).finally(() => {
                resolve({ 
                    orientationGrantedUser, 
                    motionGrantedUser, 
                    proximityAPIAvailable, 
                    microphoneGranted
                });
            });
        });
    }
    
    function enable() {
        Logger.info("Enabling sensors...");
        
        requestSensorPermissions().then(permissions => {
            permissionGranted.orientation = permissions.orientationGrantedUser;
            permissionGranted.motion = permissions.motionGrantedUser;
            permissionGranted.proximity = permissions.proximityAPIAvailable;
            permissionGranted.microphone = permissions.microphoneGranted;

            Logger.info("Permissions check complete:", permissionGranted);

            const hasAnyPermission = Object.values(permissionGranted).some(Boolean);

            if (!hasAnyPermission) {
                alert('No sensors could be enabled. Check browser/device permissions.');
                throw new Error(ERROR_MESSAGES.SENSORS.noPermissions);
            }

            if (permissionGranted.orientation) {
                window.addEventListener('deviceorientation', handleOrientationEvent, true);
                Logger.info("Device orientation listener added.");
            }
            if (permissionGranted.motion) {
                window.addEventListener('devicemotion', handleMotionEvent, true);
                Logger.info("Device motion listener added.");
            }

            const sensorPromises = [];
            if (permissionGranted.proximity) sensorPromises.push(setupProximitySensor());
            if (permissionGranted.microphone) sensorPromises.push(setupMicrophoneSensor());

            return Promise.all(sensorPromises);
        }).then(() => {
            globallyEnabled = true;
            updateUIState(true);
            Logger.info("Sensors enabled successfully.");
        }).catch(error => {
            Logger.error('Failed to enable sensors:', error);
            disable();
        });
    }

    function disable() {
        Logger.info("Disabling sensors...");
        
        globallyEnabled = false;
        updateUIState(false);
        
        cleanupMicrophone();

        window.removeEventListener('deviceorientation', handleOrientationEvent, true);
        window.removeEventListener('devicemotion', handleMotionEvent, true);
        
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

        latestSensorData = createInitialSensorData();
        smoothedSensorData = Object.assign({}, latestSensorData);
        
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

    function init(sensorUpdCb, pModuleRef, pcModuleRef, capabilities) {
        try {
            Logger.info("Initializing sensors module...");
            
            onSensorUpdateCallback = sensorUpdCb;
            playerModuleRef = pModuleRef;
            pointCloudModuleRef = pcModuleRef;
            deviceCapabilities = capabilities;
            
            cacheDOMElements();
            setupEventListeners();
            
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

        if (SENSOR_CONFIG.CIRCULAR_SENSORS.indexOf(sensorId) !== -1) {
            return mapCircularValue(smoothedSensorData[sensorId], 0, 360);
        }
        
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

    return {
        init: init,
        isGloballyEnabled: () => globallyEnabled,
        getSensorValue: getSensorValue,
        hideControls: hideControls,
        showControls: showControls
    };
})();
