// js/sensors.js - Corrected version with battery and time sensors

// Add at the top (after constants):
let sensorUpdateTimeout = null;
function startSensorUpdateLoop() {
    if (sensorUpdateLoop) return;
    // js/sensors.js - Corrected version with battery and time sensors
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

    // Battery and time variables
    let batteryManager = null;
    let timeUpdateInterval = null;

    // Helper functions for initial values
    function getBatteryLevelSync() {
        if (typeof navigator.getBattery === 'function') {
            return 75; // Reasonable default until we get real value
        }
        return 50; // Fallback if no battery API
    }

    function getTimeOfDaySync() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        return (hours + minutes / 60) / 24; // Convert to 0-1 immediately
    }

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
            gravityX: 0, gravityY: 0, gravityZ: 0,
            
            // NEW: Battery and time sensors
            batteryLevel: getBatteryLevelSync(),
            timeOfDay: getTimeOfDaySync()
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

    // BATTERY API SETUP
    async function setupBatteryAPI() {
        Logger.info("Setting up Battery API...");
        try {
            if ('getBattery' in navigator) {
                batteryManager = await navigator.getBattery();
                
                const updateBatteryData = () => {
                    const newLevel = batteryManager.level * 100;
                    
                    // Only update if significantly changed
                    if (Math.abs(latestSensorData.batteryLevel - newLevel) > 1) {
                        latestSensorData.batteryLevel = newLevel;
                        Logger.info(`Battery level updated: ${newLevel.toFixed(1)}%`);
                        processSensorDataAndUpdate();
                    }
                };
                
                // Initial update
                updateBatteryData();
                
                // Listen for battery changes
                batteryManager.addEventListener('levelchange', updateBatteryData);
                batteryManager.addEventListener('chargingchange', updateBatteryData);
                
                Logger.info(`Battery API initialized successfully. Current level: ${(batteryManager.level * 100).toFixed(1)}%`);
                return true;
            } else {
                Logger.warn('Battery API not supported in this browser');
                return false;
            }
        } catch (error) {
            Logger.warn('Failed to initialize Battery API:', error);
            return false;
        }
    }

    // TIME OF DAY UPDATES
    function updateTimeOfDay() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // More precise calculation including seconds
        const newTimeOfDay = (hours + minutes / 60 + seconds / 3600) / 24;
        
        // Only update if it's a meaningful change (more than 1 minute)
        if (Math.abs(latestSensorData.timeOfDay - newTimeOfDay) > (1 / (24 * 60))) {
            latestSensorData.timeOfDay = newTimeOfDay;
            
            // Log time updates less frequently
            if (seconds === 0) { // Only log on the minute
                Logger.info(`Time of day updated: ${hours}:${minutes.toString().padStart(2, '0')} (${(newTimeOfDay * 100).toFixed(1)}%)`);
            }
            
            processSensorDataAndUpdate();
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

    // PERMISSION HANDLING
    async function requestPermissions() {
        Logger.info("Requesting sensor permissions...");
        
        // Device Orientation (includes compass/alpha)
        if (typeof DeviceOrientationEvent !== 'undefined') {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    permissionGranted.orientation = permission === 'granted';
                    Logger.info('Device orientation permission:', permission);
                } catch (error) {
                    Logger.warn('Error requesting device orientation permission:', error);
                    permissionGranted.orientation = false;
                }
            } else {
                permissionGranted.orientation = true;
                Logger.info('Device orientation permission granted (no explicit request needed)');
            }
        }

        // Device Motion (includes accelerometer and gyroscope)
        if (typeof DeviceMotionEvent !== 'undefined') {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    permissionGranted.motion = permission === 'granted';
                    Logger.info('Device motion permission:', permission);
                } catch (error) {
                    Logger.warn('Error requesting device motion permission:', error);
                    permissionGranted.motion = false;
                }
            } else {
                permissionGranted.motion = true;
                Logger.info('Device motion permission granted (no explicit request needed)');
            }
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

        if (permissionGranted.proximity) {
            setupProximitySensor();
        }

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

    // DEBUGGING HELPER
    function debugSensorValues() {
        if (!globallyEnabled) {
            console.log("Sensors not enabled");
            return;
        }
        
        console.log("=== CURRENT SENSOR VALUES ===");
        console.log(`Battery Level: ${latestSensorData.batteryLevel.toFixed(1)}%`);
        console.log(`Time of Day: ${(latestSensorData.timeOfDay * 100).toFixed(1)}% (${new Date().toLocaleTimeString()})`);
        console.log(`Microphone: ${latestSensorData.micVolume.toFixed(1)}%`);
        console.log("==============================");
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
            
            // Setup battery API
            const batterySuccess = await setupBatteryAPI();
            
            // Setup time updates (every 10 seconds)
            timeUpdateInterval = setInterval(updateTimeOfDay, 10000);
            updateTimeOfDay(); // Initial update
            
            // Log initial sensor values
            Logger.info(`Initial battery level: ${latestSensorData.batteryLevel.toFixed(1)}%`);
            Logger.info(`Initial time of day: ${(latestSensorData.timeOfDay * 100).toFixed(1)}%`);
            
            // Check if any permissions were granted OR we have battery/time
            const hasAnyPermission = Object.values(permissionGranted).some(granted => granted) || batterySuccess;
            
            if (!hasAnyPermission) {
                Logger.warn('No sensor permissions granted');
                updateUI();
                return;
            }

            globallyEnabled = true;
            setupSensorListeners();
            updateUI();
            
            Logger.info('Sensors enabled successfully with battery and time sensors');
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
        
        // Clean up time interval
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval);
            timeUpdateInterval = null;
        }
        
        // Clean up battery listeners
        if (batteryManager) {
            try {
                batteryManager.removeEventListener('levelchange', () => {});
                batteryManager.removeEventListener('chargingchange', () => {});
            } catch (e) {
                Logger.warn('Error removing battery listeners:', e);
            }
            batteryManager = null;
        }
        
        // Reset sensor data
        latestSensorData = createInitialSensorData();
        smoothedSensorData = Object.assign({}, latestSensorData);
        
        updateUI();
        
        Logger.info('Sensors disabled');
    }

    function getSensorValue(sensorId) {
        if (!globallyEnabled) return null;
        
        if (smoothedSensorData.hasOwnProperty(sensorId)) {
            return smoothedSensorData[sensorId];
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

    function init(updateCallback, player, capabilities) {
        Logger.info("Initializing sensors module...");
        
        onSensorUpdateCallback = updateCallback;
        playerModuleRef = player;
        deviceCapabilities = capabilities || deviceCapabilities;
        
        cacheDOMElements();
        setupEventListeners();
        updateUI();
        
        // Add debug function to window
        window.debugSensors = debugSensorValues;
        
        Logger.info('Sensors module initialized');
    }

    return {
        init,
        enable,
        disable,
        getSensorValue,
        getAllSensorValues,
        isGloballyEnabled,
        getPermissions
    };
})();

    sensorUpdateLoop = setInterval(() => {
        if (globallyEnabled && onSensorUpdateCallback) {
            onSensorUpdateCallback();
        }
    }, 33); // 30fps
}

function stopSensorUpdateLoop() {
    if (sensorUpdateLoop) {
        clearInterval(sensorUpdateLoop);
        sensorUpdateLoop = null;
    }
}
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

    // Battery and time variables
    let batteryManager = null;
    let timeUpdateInterval = null;

    // Helper functions for initial values
    function getBatteryLevelSync() {
        if (typeof navigator.getBattery === 'function') {
            return 75; // Reasonable default until we get real value
        }
        return 50; // Fallback if no battery API
    }

    function getTimeOfDaySync() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        return (hours + minutes / 60) / 24; // Convert to 0-1 immediately
    }

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
            gravityX: 0, gravityY: 0, gravityZ: 0,
            
            // NEW: Battery and time sensors
            batteryLevel: getBatteryLevelSync(),
            timeOfDay: getTimeOfDaySync()
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

    // BATTERY API SETUP
    async function setupBatteryAPI() {
        Logger.info("Setting up Battery API...");
        try {
            if ('getBattery' in navigator) {
                batteryManager = await navigator.getBattery();
                
                const updateBatteryData = () => {
                    const newLevel = batteryManager.level * 100;
                    
                    // Only update if significantly changed
                    if (Math.abs(latestSensorData.batteryLevel - newLevel) > 1) {
                        latestSensorData.batteryLevel = newLevel;
                        Logger.info(`Battery level updated: ${newLevel.toFixed(1)}%`);
                        processSensorDataAndUpdate();
                    }
                };
                
                // Initial update
                updateBatteryData();
                
                // Listen for battery changes
                batteryManager.addEventListener('levelchange', updateBatteryData);
                batteryManager.addEventListener('chargingchange', updateBatteryData);
                
                Logger.info(`Battery API initialized successfully. Current level: ${(batteryManager.level * 100).toFixed(1)}%`);
                return true;
            } else {
                Logger.warn('Battery API not supported in this browser');
                return false;
            }
        } catch (error) {
            Logger.warn('Failed to initialize Battery API:', error);
            return false;
        }
    }

    // TIME OF DAY UPDATES
    function updateTimeOfDay() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // More precise calculation including seconds
        const newTimeOfDay = (hours + minutes / 60 + seconds / 3600) / 24;
        
        // Only update if it's a meaningful change (more than 1 minute)
        if (Math.abs(latestSensorData.timeOfDay - newTimeOfDay) > (1 / (24 * 60))) {
            latestSensorData.timeOfDay = newTimeOfDay;
            
            // Log time updates less frequently
            if (seconds === 0) { // Only log on the minute
                Logger.info(`Time of day updated: ${hours}:${minutes.toString().padStart(2, '0')} (${(newTimeOfDay * 100).toFixed(1)}%)`);
            }
            
            processSensorDataAndUpdate();
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
    // Cancel any pending update to avoid stacking
    if (sensorUpdateTimeout) {
        clearTimeout(sensorUpdateTimeout);
    }
    
    // Throttle updates to 30fps maximum
    sensorUpdateTimeout = setTimeout(() => {
        // Do the actual sensor data processing
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
        
        // Clear the timeout reference
        sensorUpdateTimeout = null;
    }, SENSOR_UPDATE_THROTTLE);
}

    function handleOrientationEvent(event) {
        if (!globallyEnabled) return;
        
        try {
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

    // PERMISSION HANDLING
    async function requestPermissions() {
        Logger.info("Requesting sensor permissions...");
        
        // Device Orientation (includes compass/alpha)
        if (typeof DeviceOrientationEvent !== 'undefined') {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    permissionGranted.orientation = permission === 'granted';
                    Logger.info('Device orientation permission:', permission);
                } catch (error) {
                    Logger.warn('Error requesting device orientation permission:', error);
                    permissionGranted.orientation = false;
                }
            } else {
                permissionGranted.orientation = true;
                Logger.info('Device orientation permission granted (no explicit request needed)');
            }
        }

        // Device Motion (includes accelerometer and gyroscope)
        if (typeof DeviceMotionEvent !== 'undefined') {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    permissionGranted.motion = permission === 'granted';
                    Logger.info('Device motion permission:', permission);
                } catch (error) {
                    Logger.warn('Error requesting device motion permission:', error);
                    permissionGranted.motion = false;
                }
            } else {
                permissionGranted.motion = true;
                Logger.info('Device motion permission granted (no explicit request needed)');
            }
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

        if (permissionGranted.proximity) {
            setupProximitySensor();
        }

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

    // DEBUGGING HELPER
    function debugSensorValues() {
        if (!globallyEnabled) {
            console.log("Sensors not enabled");
            return;
        }
        
        console.log("=== CURRENT SENSOR VALUES ===");
        console.log(`Battery Level: ${latestSensorData.batteryLevel.toFixed(1)}%`);
        console.log(`Time of Day: ${(latestSensorData.timeOfDay * 100).toFixed(1)}% (${new Date().toLocaleTimeString()})`);
        console.log(`Microphone: ${latestSensorData.micVolume.toFixed(1)}%`);
        console.log("==============================");
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
            
            // Setup battery API
            const batterySuccess = await setupBatteryAPI();
            
            // Setup time updates (every 10 seconds)
            timeUpdateInterval = setInterval(updateTimeOfDay, 10000);
            updateTimeOfDay(); // Initial update
            
            // Log initial sensor values
            Logger.info(`Initial battery level: ${latestSensorData.batteryLevel.toFixed(1)}%`);
            Logger.info(`Initial time of day: ${(latestSensorData.timeOfDay * 100).toFixed(1)}%`);
            
            // Check if any permissions were granted OR we have battery/time
            const hasAnyPermission = Object.values(permissionGranted).some(granted => granted) || batterySuccess;
            
            if (!hasAnyPermission) {
                Logger.warn('No sensor permissions granted');
                updateUI();
                return;
            }

            globallyEnabled = true;
            setupSensorListeners();
            updateUI();
            
            Logger.info('Sensors enabled successfully with battery and time sensors');
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

         // NEW: Clear any pending sensor updates to prevent memory leaks
    if (sensorUpdateTimeout) {
        clearTimeout(sensorUpdateTimeout);
        sensorUpdateTimeout = null;
    }
    
    // Clean up time interval
    if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
    }
        
        // Clean up time interval
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval);
            timeUpdateInterval = null;
        }
        
        // Clean up battery listeners
        if (batteryManager) {
            try {
                batteryManager.removeEventListener('levelchange', () => {});
                batteryManager.removeEventListener('chargingchange', () => {});
            } catch (e) {
                Logger.warn('Error removing battery listeners:', e);
            }
            batteryManager = null;
        }
        
        // Reset sensor data
        latestSensorData = createInitialSensorData();
        smoothedSensorData = Object.assign({}, latestSensorData);
        
        updateUI();
        
        Logger.info('Sensors disabled');
    }

    function getSensorValue(sensorId) {
        if (!globallyEnabled) return null;
        
        if (smoothedSensorData.hasOwnProperty(sensorId)) {
            return smoothedSensorData[sensorId];
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

    function init(updateCallback, player, capabilities) {
        Logger.info("Initializing sensors module...");
        
        onSensorUpdateCallback = updateCallback;
        playerModuleRef = player;
        deviceCapabilities = capabilities || deviceCapabilities;
        
        cacheDOMElements();
        setupEventListeners();
        updateUI();
        
        // Add debug function to window
        window.debugSensors = debugSensorValues;
        
        Logger.info('Sensors module initialized');
    }

    return {
        init,
        enable,
        disable,
        getSensorValue,
        getAllSensorValues,
        isGloballyEnabled,
        getPermissions
    };
})();
