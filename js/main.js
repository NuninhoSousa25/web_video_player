// js/main.js
const App = (function() {
    let currentMode = 'videoPlayer'; 

    let showVideoPlayerModeBtn, showPointCloudModeBtn,
        videoPlayerModeContent, pointCloudModeContent,
        sensorMappingInfo;
    
    let player, pointcloud, sensors, mappings, ui, utils, mappingPanel, deviceDetector; // Add deviceDetector

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

        UI.updateSensorMappingInfoText(sensorMappingInfo, currentMode); // Already in place
        UI.updateActiveMappingIndicators(); // Update indicators on mode switch
    }

    function switchMode(newMode) {
        if (newMode === currentMode) return;

        currentMode = newMode;
        updateModeUI();
        const videoElement = player.getVideoElement();

        if (currentMode === 'pointCloud') {
            pointcloud.stopRendering(); 
            if (!videoElement.src || videoElement.readyState < videoElement.HAVE_METADATA) {
                alert("Please load and play a video first to use Point Cloud mode.");
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
        if (e.key === 'Escape') {
            const videoContainer = player.getMainVideoContainer();
            const pcContainer = pointcloud.getMainPointCloudContainer();
            // Check if any element is in fullscreen mode first
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
        // This function is called when browser fullscreen state changes (e.g., by Esc key)
        if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
            const videoContainer = player.getMainVideoContainer();
            const pcContainer = pointcloud.getMainPointCloudContainer();
            
            if (videoContainer && videoContainer.classList.contains('fullscreen')) {
                player.exitVideoFullscreenMode(); // Call module's exit to clean up classes
            }
            if (pcContainer && pcContainer.classList.contains('fullscreen')) {
                pointcloud.exitPointCloudFullscreenMode(); // Call module's exit
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
        player = Player;
        pointcloud = PointCloud;
        sensors = Sensors;
        mappings = Mappings;
        ui = UI;
        utils = Utils;
        mappingPanel = MappingPanel; 
        deviceDetector = DeviceDetector; // Initialize the detector module

        cacheGlobalDOMElements();
        deviceDetector.init(); // Run detection

        const getCurrentMode = () => currentMode;
        const getSensorState = () => sensors.isGloballyEnabled();

        player.init(getCurrentMode, pointcloud);
        pointcloud.init(player.getVideoElement(), getCurrentMode, getSensorState); // Pass sensor state getter
        
        mappings.init(player, pointcloud, sensors, getCurrentMode);
        
        // Pass device capabilities to sensors.init for adaptive UI and functionality
        const capabilities = deviceDetector.getCapabilities();
        sensors.init(mappings.applyAllActiveMappings, player, pointcloud, capabilities); 
        
        mappingPanel.init();

        setupGlobalEventListeners();
        updateModeUI(); 
    }
    
    function forceSwitchMode(mode) {
        console.warn(`Forcing mode switch to: ${mode}`);
        currentMode = mode; 
        updateModeUI(); 
        if (mode === 'videoPlayer') {
            pointcloud.stopRendering();
        }
    }

    return {
        init,
        forceSwitchMode
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
