// js/sensors.js - Fixed version with mobile sensor improvements
const Sensors = (function() {
    // Constants - Updated for mobile optimization
    const SENSOR_CONFIG = {
        DEFAULT_SMOOTHING_FACTOR: 0.3,
        DEFAULT_PROXIMITY_MAX: 25,
        UPDATE_FREQUENCY: 2,
        CIRCULAR_SENSORS: ['alpha', 'compassHeading'],
        MAX_MIC_RETRIES: 3,
        MIC_UPDATE_INTERVAL: 50,
        // NEW: Throttling for mobile performance
        SENSOR_THROTTLE_MS: 16, // ~60fps
        DEBUG_MODE: false
    };

    // NEW: More accurate mobile sensor ranges
    const MOBILE_SENSOR_RANGES = {
        alpha: { min: 0, max: 360 },
        beta: { min: -180, max: 180 }, // Full range for Android
        gamma: { min: -90, max: 90 },
        accelX: { min: -20, max: 20 }, // Increased range for mobile
        accelY: { min: -20, max: 20 },
        accelZ: { min: -20, max: 20 },
        gyroX: { min: -20, max: 20 },
        gyroY: { min: -20, max: 20 },
        gyroZ: { min: -20, max: 20 }
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
            'proximityNotAvailable': 'Proximity Sensor API not available in this browser/context.',
            'orientationBlocked': 'Device orientation blocked. Please enable motion sensors in browser settings.',
            'motionBlocked': 'Device motion blocked. Please enable motion sensors in browser settings.'
        }
    };

    // DOM Elements
    let sensorToggleBtn, sensorSectionControls;

    // Module References
    let playerModuleRef;

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
    
    // NEW: Throttling system
    let lastSensorUpdate = 0;
    let pendingUpdate = false;
    
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

    // Configuration
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
        info: (message, ...args) => console.log('[Sensors]', message, ...args),
        debug: (message, ...args) => SENSOR_CONFIG.DEBUG_MODE && console.log('[Sensors DEBUG]', message, ...args)
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

    // NEW: Improved circular value mapping
    function mapCircularValue(value, min, max) {
        if (value == null || isNaN(value)) return 0;
        
        const range = max - min;
        if (range === 0) return min;
        
        // Normalize to 0-1 range
        let normalized = ((value - min) % range + range) % range;
        return normalized + min;
    }

    function applySmoothing(currentSmoothed, rawNewValue) {
        if (smoothingFactor === 0) return rawNewValue;
        if (rawNewValue == null || isNaN(rawNewValue)) return currentSmoothed;
        
        const current = Number(currentSmoothed) || 0;
        const raw = Number(rawNewValue) || 0;
        return current * smoothingFactor + raw * (1 - smoothingFactor);
    }

    // NEW: Throttled sensor processing
    function processSensorDataAndUpdate() {
        const now = Date.now();
        
        // Throttle updates for mobile performance
        if (now - lastSensorUpdate < SENSOR_CONFIG.SENSOR_THROTTLE_MS) {
            if (!pendingUpdate) {
                pendingUpdate = true;
                setTimeout(() => {
                    pendingUpdate = false;
                    processSensorDataAndUpdate();
                }, SENSOR_CONFIG.SENSOR_THROTTLE_MS);
            }
            return;
        }
        
        lastSensorUpdate = now;
        
        // Process all sensor data
        let hasChanges = false;
        
        for (const key in latestSensorData) {
            if (!smoothedSensorData.hasOwnProperty(key)) continue;

            const oldValue = smoothedSensorData[key];
            
            if (SENSOR_CONFIG.CIRCULAR_SENSORS.indexOf(key) !== -1) {
                const mappedValue = mapCircularValue(latestSensorData[key], 0, 360);
                const mappedSmoothed = mapCircularValue(smoothedSensorData[key], 0, 360);
                smoothedSensorData[key] = applySmoothing(mappedSmoothed, mappedValue);
            } else {
                smoothedSensorData[key] = applySmoothing(smoothedSensorData[key], latestSensorData[key]);
            }
            
            // Check if value changed significantly
            if (Math.abs(smoothedSensorData[key] - oldValue) > 0.1) {
                hasChanges = true;
            }
        }

        // Only trigger callback if there are significant changes
        if (hasChanges && onSensorUpdateCallback) {
            Logger.debug('Triggering sensor update callback', smoothedSensorData);
            onSensorUpdateCallback();
        }
    }

    // NEW: Improved orientation event handling
    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        
        try {
            // More robust value extraction
            const alpha = event.alpha !== null ? event.alpha : latestSensorData.alpha;
            const beta = event.beta !== null ? event.beta : latestSensorData.beta;
            const gamma = event.gamma !== null ? event.gamma : latestSensorData.gamma;
            
            // Validate values are within expected ranges
            if (alpha >= 0 && alpha <= 360) {
                latestSensorData.alpha = alpha;
                latestSensorData.compassHeading = alpha;
            }
            
            if (beta >= -180 && beta <= 180) {
                latestSensorData.beta = beta;
            }
            
            if (gamma >= -90 && gamma <= 90) {
                latestSensorData.gamma = gamma;
            }
            
            Logger.debug('Orientation event:', { alpha, beta, gamma });
            processSensorDataAndUpdate();
            
        } catch (error) {
            Logger.error('Error processing orientation event:', error);
        }
    }

    // NEW: Improved motion event handling  
    function handleMotionEvent(event) {
        if (!globallyEnabled) return;

        try {
            const acceleration = event.acceleration;
            const accGravity = event.accelerationIncludingGravity;
            const rotationRate = event.rotationRate;

            Logger.debug('Motion event:', { acceleration, accGravity, rotationRate });

            // Handle acceleration data
            if (acceleration && acceleration.x !== null) {
                latestSensorData.accelX = Math.max(-20, Math.min(20, acceleration.x));
                latestSensorData.accelY = Math.max(-20, Math.min(20, acceleration.y));
                latestSensorData.accelZ = Math.max(-20, Math.min(20, acceleration.z));
            } else if (accGravity && accGravity.x !== null) {
                // Fallback to gravity-included acceleration
                latestSensorData.accelX = Math.max(-20, Math.min(20, accGravity.x));
                latestSensorData.accelY = Math.max(-20, Math.min(20, accGravity.y));
                latestSensorData.accelZ = Math.max(-20, Math.min(20, accGravity.z));
            }

            // Handle rotation rate (gyroscope)
            if (rotationRate) {
                if (rotationRate.alpha !== null) {
                    latestSensorData.gyroX = Math.max(-20, Math.min(20, rotationRate.alpha));
                }
                if (rotationRate.beta !== null) {
                    latestSensorData.gyroY = Math.max(-20, Math.min(20, rotationRate.beta));
                }
                if (rotationRate.gamma !== null) {
                    latestSensorData.gyroZ = Math.max(-20, Math.min(20, rotationRate.gamma));
                }
            }

            // Handle gravity data
            if (accGravity) {
                latestSensorData.gravityX = Math.max(-20, Math.min(20, accGravity.x || 0));
                latestSensorData.gravityY = Math.max(-20, Math.min(20, accGravity.y || 0));
                latestSensorData.gravityZ = Math.max(-20, Math.min(20, accGravity.z || 0));
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

    // MICROPHONE HANDLING - Same as before
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
                        echoCancellation: MIC_CONFIG.AUDIO.echoCancellation,
                        noiseSuppression: MIC_CONFIG.AUDIO.noiseSuppression,
                        autoGainControl: MIC_CONFIG.AUDIO.autoGainControl,
                        channelCount: MIC_CONFIG.AUDIO.channelCount,
                        sampleRate: MIC_CONFIG.AUDIO.sampleRate
                    }
                };
                
                navigator.mediaDevices.getUserMedia(constraints)
                    .then(function(stream) {
                        currentMicStream = stream;
                        microphoneSource = audioContext.createMediaStreamSource(stream);
                        analyserNode = audioContext.createAnalyser();
                        
                        analyserNode.smoothingTimeConstant = MIC_CONFIG.ANALYZER.smoothingTimeConstant;
                        analyserNode.fftSize = MIC_CONFIG.ANALYZER.fftSize;
                        
                        microphoneSource.connect(analyserNode);
                        
                        audioDataArray = new Uint8Array(analyserNode.frequencyBinCount);
                        
                        micUpdateInterval = setInterval(function() {
                            if (!globallyEnabled || !analyserNode || !audioDataArray) return;
                            
                            analyserNode.getByteFrequencyData(audioDataArray);
                            
                            let sum = 0;
                            for (let i = 0; i < audioDataArray.length; i++) {
                                sum += audioDataArray[i];
                            }
                            
                            const average = sum / audioDataArray.length;
                            latestSensorData.micVolume = Math.min(100, (average / 128) * 100);
                            
                            processSensorDataAndUpdate();
                        }, SENSOR_CONFIG.MIC_UPDATE_INTERVAL);
                        
                        permissionGranted.microphone = true;
                        micRetryCount = 0;
                        Logger.info("Microphone sensor setup successfully.");
                        resolve();
                    })
                    .catch(function(error) {
                        Logger.error('Microphone access error:', error);
                        permissionGranted.microphone = false;
                        
                        const errorMessage = ERROR_MESSAGES.MICROPHONE[error.name] || ERROR_MESSAGES.MICROPHONE.default;
                        
                        if (micRetryCount < SENSOR_CONFIG.MAX_MIC_RETRIES) {
                            micRetryCount++;
                            Logger.info(`Retrying microphone setup (${micRetryCount}/${SENSOR_CONFIG.MAX_MIC_RETRIES})...`);
                            setTimeout(function() {
                                setupMicrophoneSensor().then(resolve);
                            }, 1000);
                        } else {
                            Logger.error('Max microphone retries reached:', errorMessage);
                            resolve();
                        }
                    });
            } catch (error) {
                Logger.error('Error setting up microphone:', error);
                permissionGranted.microphone = false;
                resolve();
            }
        });
    }

    // NEW: Improved permission handling for iOS 13+
    async function requestPermissions() {
        Logger.info("Requesting sensor permissions...");
        
        // Device Orientation (includes compass/alpha)
        if (typeof DeviceOrientationEvent !== 'undefined') {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // iOS 13+ requires explicit permission
                try {
                    Logger.info('Requesting iOS device orientation permission...');
                    const permission = await DeviceOrientationEvent.requestPermission();
                    permissionGranted.orientation = permission === 'granted';
                    Logger.info('Device orientation permission:', permission);
                    
                    if (permission === 'denied') {
                        Logger.error('Device orientation permission denied by user');
                    }
                } catch (error) {
                    Logger.error('Error requesting device orientation permission:', error);
                    permissionGranted.orientation = false;
                }
            } else {
                // Android and older iOS versions
                permissionGranted.orientation = true;
                Logger.info('Device orientation permission granted (no explicit request needed)');
            }
        } else {
            Logger.warn('DeviceOrientationEvent not supported');
            permissionGranted.orientation = false;
        }

        // Device Motion (includes accelerometer and gyroscope)
        if (typeof DeviceMotionEvent !== 'undefined') {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                // iOS 13+ requires explicit permission
                try {
                    Logger.info('Requesting iOS device motion permission...');
                    const permission = await DeviceMotionEvent.requestPermission();
                    permissionGranted.motion = permission === 'granted';
                    Logger.info('Device motion permission:', permission);
                    
                    if (permission === 'denied') {
                        Logger.error('Device motion permission denied by user');
                    }
                } catch (error) {
                    Logger.error('Error requesting device motion permission:', error);
                    permissionGranted.motion = false;
                }
            } else {
                // Android and older iOS versions
                permissionGranted.motion = true;
                Logger.info('Device motion permission granted (no explicit request needed)');
            }
        } else {
            Logger.warn('DeviceMotionEvent not supported');
            permissionGranted.motion = false;
        }

        // Proximity Sensor (Experimental API)
        if ('ProximitySensor' in window) {
            try {
                await navigator.permissions.query({ name: 'proximity' });
                permissionGranted.proximity = true;
                Logger.info('Proximity sensor permission granted');
            } catch (error) {
                Logger.warn('Proximity sensor not available:', error);
                permissionGranted.proximity = false;
            }
        } else {
            Logger.info('Proximity sensor API not available');
            permissionGranted.proximity = false;
        }

        // Check for microphone permission
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            permissionGranted.microphone = true;
        } else {
            Logger.warn('Microphone API not available');
            permissionGranted.microphone = false;
        }

        Logger.info('Final permissions:', permissionGranted);
        return permissionGranted;
    }

    function setupSensorListeners() {
        Logger.info("Setting up sensor event listeners...");
        
        if (permissionGranted.orientation) {
            window.addEventListener('deviceorientation', handleOrientationEvent);
            Logger.info('Device orientation listener added');
        }

        if (permissionGranted.motion) {
            window.addEventListener('devicemotion', handleMotionEvent);
            Logger.info('Device motion listener added');
        }

        // Set up proximity sensor
        if (permissionGranted.proximity) {
            setupProximitySensor();
        }

        // Set up microphone sensor
        if (permissionGranted.microphone) {
            setupMicrophoneSensor();
        }
    }

    function removeSensorListeners() {
        Logger.info("Removing sensor event listeners...");
        
        window.removeEventListener('deviceorientation', handleOrientationEvent);
        window.removeEventListener('devicemotion', handleMotionEvent);
        
        if (proximitySensorInstance) {
            try {
                proximitySensorInstance.removeEventListener('reading', handleProximityEvent);
                proximitySensorInstance.removeEventListener('error', handleProximityError);
                proximitySensorInstance.stop();
                proximitySensorInstance = null;
            } catch (error) {
                Logger.warn('Error stopping proximity sensor:', error);
            }
        }

        cleanupMicrophone();
    }

    function updateUI() {
        if (sensorToggleBtn) {
            sensorToggleBtn.textContent = globallyEnabled ? 'Disable Sensors' : 'Enable Sensors';
            sensorToggleBtn.classList.toggle('active', globallyEnabled);
        }
    }

    // NEW: Test function to verify sensor data flow
    function testSensorDataFlow() {
        Logger.info('Testing sensor data flow...');
        Logger.info('Current sensor data:', smoothedSensorData);
        Logger.info('Permissions:', permissionGranted);
        Logger.info('Globally enabled:', globallyEnabled);
        
        // Test callback
        if (onSensorUpdateCallback) {
            Logger.info('Callback function exists');
            onSensorUpdateCallback();
        } else {
            Logger.warn('No callback function set');
        }
    }

    // PUBLIC API
    async function enable() {
        if (globallyEnabled) {
            Logger.info("Sensors already enabled");
            return;
        }

        Logger.info("Enabling sensors...");
        
        try {
            await requestPermissions();
            
            // Check if any permissions were granted
            const hasAnyPermission = Object.values(permissionGranted).some(granted => granted);
            
            if (!hasAnyPermission) {
                Logger.error('No sensor permissions granted');
                updateUI();
                return;
            }

            globallyEnabled = true;
            setupSensorListeners();
            updateUI();
            
            Logger.info('Sensors enabled successfully');
            
            // NEW: Test data flow after enabling
            setTimeout(testSensorDataFlow, 2000);
            
        } catch (error) {
            Logger.error('Error enabling sensors:', error);
            globallyEnabled = false;
            updateUI();
        }
    }

    function disable() {
        if (!globallyEnabled) {
            Logger.info("Sensors already disabled");
            return;
        }

        Logger.info("Disabling sensors...");
        
        globallyEnabled = false;
        removeSensorListeners();
        
        // Reset sensor data
        latestSensorData = createInitialSensorData();
        smoothedSensorData = Object.assign({}, latestSensorData);
        
        updateUI();
        
        Logger.info('Sensors disabled');
    }

    function getSensorValue(sensorId) {
        if (!globallyEnabled) {
            Logger.debug(`getSensorValue(${sensorId}) called but sensors disabled`);
            return null;
        }
        
        if (smoothedSensorData.hasOwnProperty(sensorId)) {
            const value = smoothedSensorData[sensorId];
            Logger.debug(`getSensorValue(${sensorId}) = ${value}`);
            return value;
        }
        
        Logger.warn(`Unknown sensor ID: ${sensorId}`);
        return null;
    }

    function getAllSensorValues() {
        return globallyEnabled ? { ...smoothedSensorData } : null;
    }

    function isGloballyEnabled() {
        return globallyEnabled;
    }

    function getPermissions() {
        return { ...permissionGranted };
    }

    // NEW: Enable debug mode
    function enableDebugMode() {
        SENSOR_CONFIG.DEBUG_MODE = true;
        Logger.info('Debug mode enabled');
    }

    function init(updateCallback, player, capabilities) {
        Logger.info("Initializing sensors module...");
        
        onSensorUpdateCallback = updateCallback;
        playerModuleRef = player;
        deviceCapabilities = capabilities || deviceCapabilities;
        
        Logger.info('Update callback set:', typeof updateCallback);
        Logger.info('Device capabilities:', deviceCapabilities);
        
        cacheDOMElements();
        setupEventListeners();
        updateUI();
        
        Logger.info('Sensors module initialized');
    }

    return {
        init,
        enable,
        disable,
        getSensorValue,
        getAllSensorValues,
        isGloballyEnabled,
        getPermissions,
        enableDebugMode, // NEW: For debugging
        testSensorDataFlow // NEW: For testing
    };
})();
