// js/main.js - Updated with Android TV compatibility
const App = (function() {
    let currentMode = 'videoPlayer'; 
    let deviceInfo = {};

    let showVideoPlayerModeBtn, showPointCloudModeBtn,
        videoPlayerModeContent, pointCloudModeContent,
        sensorMappingInfo;
    
    let player, pointcloud, sensors, mappings, ui, utils, mappingPanel, androidTV;

    function cacheGlobalDOMElements() {
        showVideoPlayerModeBtn = document.getElementById('showVideoPlayerModeBtn');
        showPointCloudModeBtn = document.getElementById('showPointCloudModeBtn');
        videoPlayerModeContent = document.getElementById('videoPlayerModeContent');
        pointCloudModeContent = document.getElementById('pointCloudModeContent');
        sensorMappingInfo = document.getElementById('sensorMappingInfo');
    }

    function updateModeUI() {
        showVideoPlayerModeBtn.classList.toggle('active', currentMode === 'videoPlayer');
        showPointCloudModeBtn.classList.toggle('active', currentMode === 'pointCloud');

        videoPlayerModeContent.classList.toggle('hidden', currentMode !== 'videoPlayer');
        pointCloudModeContent.classList.toggle('hidden', currentMode !== 'pointCloud');
        
        const videoElement = player.getVideoElement();
        const playerDOM = player.getDOM();

        playerDOM.videoPlaceholder.classList.toggle('hidden', !!videoElement.src);
        playerDOM.videoPlayerControls.classList.toggle('hidden', !videoElement.src || currentMode !== 'videoPlayer');
        playerDOM.videoFilterControls.classList.toggle('hidden', !videoElement.src || currentMode !== 'videoPlayer');

        UI.updateSensorMappingInfoText(sensorMappingInfo, currentMode);
        UI.updateActiveMappingIndicators();
    }

    function switchMode(newMode) {
        if (newMode === currentMode) return;

        currentMode = newMode;
        updateModeUI();
        const videoElement = player.getVideoElement();

        if (currentMode === 'pointCloud') {
            pointcloud.stopRendering(); 
            if (!videoElement.src || videoElement.readyState < videoElement.HAVE_METADATA) {
                const alertMessage = deviceInfo.isAndroidTV ? 
                    "Please load and play a video first to use Point Cloud mode. Use the D-pad to navigate and OK to select." :
                    "Please load and play a video first to use Point Cloud mode.";
                alert(alertMessage);
                currentMode = 'videoPlayer'; 
                updateModeUI();
                return;
            }
            pointcloud.setupCanvasDimensions();
            if (videoElement.paused) videoElement.play().catch(Utils.handlePlayError); 
            else pointcloud.startRendering(); 
        } else { 
            pointcloud.stopRendering();
        }
    }
    
    function exitFullscreenOnEscape(e) {
        if (e.key === 'Escape' || e.code === 'Escape') {
            const videoContainer = player.getMainVideoContainer();
            const pcContainer = pointcloud.getMainPointCloudContainer();
            
            if (document.fullscreenElement || document.webkitIsFullScreen) {
                if (videoContainer && videoContainer.classList.contains('fullscreen')) {
                    player.exitVideoFullscreenMode();
                }
                if (pcContainer && pcContainer.classList.contains('fullscreen')) {
                    pointcloud.exitPointCloudFullscreenMode();
                }
            }
        }
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement && !document.webkitIsFullScreen && 
            !document.mozFullScreen && !document.msFullscreenElement) {
            const videoContainer = player.getMainVideoContainer();
            const pcContainer = pointcloud.getMainPointCloudContainer();
            
            if (videoContainer && videoContainer.classList.contains('fullscreen')) {
                player.exitVideoFullscreenMode();
            }
            if (pcContainer && pcContainer.classList.contains('fullscreen')) {
                pointcloud.exitPointCloudFullscreenMode();
            }
       }
    }

    function setupGlobalEventListeners() {
        showVideoPlayerModeBtn.addEventListener('click', () => switchMode('videoPlayer'));
        showPointCloudModeBtn.addEventListener('click', () => switchMode('pointCloud'));

        document.addEventListener('keydown', exitFullscreenOnEscape);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange); 
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);    
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);   
    }

    function init() {
        // Initialize Android TV compatibility first
        androidTV = AndroidTVCompat;
        deviceInfo = androidTV.init();
        
        // Show device info in console
        console.log('App initialized for device:', deviceInfo);
        
        player = Player;
        pointcloud = PointCloud;
        sensors = Sensors;
        mappings = Mappings;
        ui = UI;
        utils = Utils;
        mappingPanel = MappingPanel; 

        cacheGlobalDOMElements();

        const getCurrentMode = () => currentMode;
        const getSensorState = () => {
            // For Android TV, check if virtual sensors are enabled
            if (deviceInfo.isAndroidTV) {
                return androidTV.isVirtualSensorMode();
            }
            return sensors.isGloballyEnabled();
        };

        // Initialize modules with device-specific configurations
        player.init(getCurrentMode, pointcloud, deviceInfo);
        pointcloud.init(player.getVideoElement(), getCurrentMode, getSensorState, deviceInfo);
        
        // Enhanced sensor initialization for Android TV
        if (deviceInfo.isAndroidTV) {
            // Create custom sensor interface for Android TV
            const customSensorUpdater = function() {
                // Apply virtual sensor mappings
                mappings.applyAllActiveMappings();
            };
            sensors.init(customSensorUpdater, player, pointcloud, deviceInfo);
        } else {
            sensors.init(mappings.applyAllActiveMappings, player, pointcloud, deviceInfo);
        }
        
        mappings.init(player, pointcloud, sensors, getCurrentMode, deviceInfo);
        mappingPanel.init(deviceInfo);

        setupGlobalEventListeners();
        updateModeUI();
        
        // Show welcome message for Android TV users
        if (deviceInfo.isAndroidTV) {
            setTimeout(() => {
                console.log('Android TV detected - Remote control enabled');
                console.log('Use D-pad to navigate, OK to select, Menu for help');
            }, 1000);
        }
    }
    
    function forceSwitchMode(mode) {
        console.warn(`Forcing mode switch to: ${mode}`);
        currentMode = mode; 
        updateModeUI(); 
        if (mode === 'videoPlayer') {
            pointcloud.stopRendering();
        }
    }

    // Enhanced sensor value getter that works with virtual sensors
    function getEnhancedSensorValue(sensorId) {
        if (deviceInfo.isAndroidTV && androidTV.isVirtualSensorMode()) {
            return androidTV.getVirtualSensorValue(sensorId);
        }
        return sensors.getSensorValue(sensorId);
    }

    return {
        init,
        forceSwitchMode,
        getDeviceInfo: () => deviceInfo,
        getEnhancedSensorValue
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
