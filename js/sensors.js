// js/sensors.js - Performance optimized version
const Sensors = (function() {
    // Constants
    const SENSOR_CONFIG = {
        DEFAULT_SMOOTHING_FACTOR: 0.3,
        DEFAULT_PROXIMITY_MAX: 25,
        UPDATE_FREQUENCY: 2,
        CIRCULAR_SENSORS: ['alpha', 'compassHeading'],
        MAX_MIC_RETRIES: 3,
        MIC_UPDATE_INTERVAL: 50, // Reduced from 50ms to 100ms for performance
        BATTERY_UPDATE_INTERVAL: 30000, // 30 seconds instead of on every change
        TIME_UPDATE_INTERVAL: 60000 // 1 minute instead of 10 seconds
    };

    const MIC_CONFIG = {
        ANALYZER: {
            smoothingTimeConstant: 0.8, // Increased smoothing for less jitter
            fftSize: 256 // Reduced from 512 for better performance
        },
        AUDIO: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: 22050 // Reduced sample rate for performance
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

    // Performance optimization: reduce logging
    const DEBUG_MODE = false;

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
    let batteryUpdateInterval = null;

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
            
            // Battery and time sensors
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

    // **PERFORMANCE: Throttle sensor updates**
    let lastSensorUpdateTime = 0;
    const SENSOR_UPDATE_THROTTLE = 16; // ~60fps max

    // Device capabilities
    let deviceCapabilities = {
        hasTouch: false,
        hasMotionSensors: false
    };

    // Utility Functions
    const Logger = {
        error: (message, ...args) => {
            if (DEBUG_MODE) console.error('[Sensors]', message, ...args);
        },
        warn: (message, ...args) => {
            if (DEBUG_MODE) console.warn('[Sensors]', message, ...args);
        },
        info: (message, ...args) => {
            if (DEBUG_MODE) console.log('[Sensors]', message, ...args);
        }
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

    // **PERFORMANCE: Optimized battery API with less frequent updates**
    async function setupBatteryAPI() {
        Logger.info("Setting up Battery API...");
        try {
            if ('getBattery' in navigator) {
                batteryManager = await navigator.getBattery();
                
                const updateBatteryData = () => {
                    const newLevel = batteryManager.level * 100;
                    
                    // Only update if significantly changed (2% threshold)
                    if (Math.abs(latestSensorData.batteryLevel - newLevel) > 2) {
                        latestSensorData.batteryLevel = newLevel;
                        Logger.info(`Battery level updated: ${newLevel.toFixed(1)}%`);
                        processSensorDataAndUpdate();
                    }
                };
                
                // Initial update
                updateBatteryData();
                
                // **PERFORMANCE: Periodic updates instead of event-based**
                batteryUpdateInterval = setInterval(updateBatteryData, SENSOR_CONFIG.BATTERY_UPDATE_INTERVAL);
                
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

    // **PERFORMANCE: Less frequent time updates**
    function updateTimeOfDay() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // Simplified calculation - don't include seconds for better performance
        const newTimeOfDay = (hours + minutes / 60) / 24;
        
        // Only update if it's a meaningful change (more than 5 minutes)
        if (Math.abs(latestSensorData.timeOfDay - newTimeOfDay) > (5 / (24 * 60))) {
            latestSensorData.timeOfDay = newTimeOfDay;
            
            Logger.info(`Time of day updated: ${hours}:${minutes.toString().padStart(2, '0')} (${(newTimeOfDay * 100).toFixed(1)}%)`);
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

    // **PERFORMANCE: Throttled sensor processing**
    function processSensorDataAndUpdate() {
        const now = performance.now();
        
        if (now - lastSensorUpdateTime < SENSOR_UPDATE_THROTTLE) {
            return; // Skip if too frequent
        }
        lastSensorUpdateTime = now;

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
                latestSensor
