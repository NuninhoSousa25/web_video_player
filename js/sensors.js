// js/sensors.js - Point cloud references removed
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
