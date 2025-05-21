// js/main.js
// Use an IIFE to create a scope for the App
const App = (function() {
    let currentMode = 'videoPlayer'; // 'videoPlayer' or 'pointCloud'

    // DOM Elements for mode switching and global fullscreen handling
    let showVideoPlayerModeBtn, showPointCloudModeBtn,
        videoPlayerModeContent, pointCloudModeContent,
        sensorMappingInfo;
    
    // Module references
    let player, pointcloud, sensors, mappings, ui, utils;

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
    }

    function switchMode(newMode) {
        if (newMode === currentMode) return;

        currentMode = newMode;
        updateModeUI();
        const videoElement = player.getVideoElement();

        if (currentMode === 'pointCloud') {
            pointcloud.stopRendering(); // Ensure any previous rendering is stopped
            if (!videoElement.src || videoElement.readyState < videoElement.HAVE_METADATA) {
                alert("Please load and play a video first to use Point Cloud mode.");
                currentMode = 'videoPlayer'; 
                updateModeUI();
                return;
            }
            pointcloud.setupCanvasDimensions();
            if (videoElement.paused) videoElement.play().catch(Utils.handlePlayError); // Player module will call pointcloud.startRendering on 'play'
            else pointcloud.startRendering(); // If already playing
        } else { // Switching to videoPlayer mode
            pointcloud.stopRendering();
        }
    }
    
    function exitFullscreenOnEscape(e) {
        if (e.key === 'Escape') {
            const videoContainer = player.getMainVideoContainer();
            const pcContainer = pointcloud.getMainPointCloudContainer();
            if (videoContainer && videoContainer.classList.contains('fullscreen')) player.exitVideoFullscreenMode();
            if (pcContainer && pcContainer.classList.contains('fullscreen')) pointcloud.exitPointCloudFullscreenMode();
        }
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
            const videoContainer = player.getMainVideoContainer();
            const pcContainer = pointcloud.getMainPointCloudContainer();
            if (videoContainer && videoContainer.classList.contains('fullscreen')) player.exitVideoFullscreenMode();
            if (pcContainer && pcContainer.classList.contains('fullscreen')) pointcloud.exitPointCloudFullscreenMode();
       }
    }

    function setupGlobalEventListeners() {
        showVideoPlayerModeBtn.addEventListener('click', () => switchMode('videoPlayer'));
        showPointCloudModeBtn.addEventListener('click', () => switchMode('pointCloud'));

        document.addEventListener('keydown', exitFullscreenOnEscape);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);    // Firefox
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);   // IE/Edge
    }


    function init() {
        // Assign module references (assuming they are globally available as Player, PointCloud, etc.)
        player = Player;
        pointcloud = PointCloud;
        sensors = Sensors;
        mappings = Mappings;
        ui = UI; // UI is already an object from ui.js
        utils = Utils; // Utils is already an object from utils.js

        cacheGlobalDOMElements();

        // Initialize modules, passing necessary references or callbacks
        const getCurrentMode = () => currentMode;
        const getSensorState = () => sensors.isGloballyEnabled();

        player.init(getCurrentMode, pointcloud); // Pass PointCloud for canvas dimension updates
        pointcloud.init(player.getVideoElement(), getCurrentMode, getSensorState);
        mappings.init(player, pointcloud, getCurrentMode);
        sensors.init(mappings.processOrientation, player); // Pass Mappings' processing function & Player for filter reset on calibrate

        setupGlobalEventListeners();
        updateModeUI(); // Set initial UI based on default mode
    }
    
    // Expose a way to force switch mode if PointCloud encounters a critical error
    function forceSwitchMode(mode) {
        console.warn(`Forcing mode switch to: ${mode}`);
        currentMode = mode; // Directly set
        updateModeUI(); // Update UI accordingly
        if (mode === 'videoPlayer') {
            pointcloud.stopRendering();
        }
    }

    // Public API for App if needed, e.g., for debugging or external calls
    return {
        init,
        forceSwitchMode // Expose this
        // getCurrentMode, // If other parts absolutely need it outside modules
    };
})();

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
