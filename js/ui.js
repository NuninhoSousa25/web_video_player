/**
 * Enhanced Sensor Video Processor - UI Module
 * Handles the UI mode switching and interactions
 */

// UI state variables
let currentMode = 'videoPlayer'; // 'videoPlayer', 'pointCloud', or 'sensorMappings'

// DOM Elements
let showVideoPlayerModeBtn;
let showPointCloudModeBtn;
let showMappingsModeBtn;
let videoPlayerModeContent;
let pointCloudModeContent;
let sensorMappingsModeContent;
let sensorMappingInfo;
let videoPlaceholder;
let videoPlayerControls;
let videoFilterControls;

// Initialize UI module
function initializeUI() {
    // Get DOM elements
    showVideoPlayerModeBtn = utils.getElement('showVideoPlayerModeBtn');
    showPointCloudModeBtn = utils.getElement('showPointCloudModeBtn');
    showMappingsModeBtn = utils.getElement('showMappingsModeBtn');
    videoPlayerModeContent = utils.getElement('videoPlayerModeContent');
    pointCloudModeContent = utils.getElement('pointCloudModeContent');
    sensorMappingsModeContent = utils.getElement('sensorMappingsModeContent');
    sensorMappingInfo = utils.getElement('sensorMappingInfo');
    videoPlaceholder = utils.getElement('videoPlaceholder');
    videoPlayerControls = utils.getElement('videoPlayerControls');
    videoFilterControls = utils.getElement('videoFilterControls');
    
    // Set up mode switching event listeners
    showVideoPlayerModeBtn.addEventListener('click', () => switchMode('videoPlayer'));
    showPointCloudModeBtn.addEventListener('click', () => switchMode('pointCloud'));
    showMappingsModeBtn.addEventListener('click', () => switchMode('sensorMappings'));
    
    // Initialize mode UI
    updateModeUI();
}

// Switch between application modes
function switchMode(newMode) {
    if (newMode === currentMode) return;

    currentMode = newMode;
    updateModeUI();

    if (currentMode === 'pointCloud') {
        const videoPlayer = document.getElementById('videoPlayer');
        if (!videoPlayer.src || videoPlayer.readyState < videoPlayer.HAVE_METADATA) {
            alert("Please load and play a video first to use Point Cloud mode.");
            // Revert to video player mode if no video
            currentMode = 'videoPlayer'; 
            updateModeUI();
            return;
        }
        window.pointCloud.setupPointCloudCanvasDimensions();
        if (videoPlayer.paused) videoPlayer.play().catch(err => console.error("Play error:", err));
        window.pointCloud.renderPointCloudFrame();
    } else { 
        // Switching from pointCloud mode
        if (window.pointCloudAnimationFrameId) {
            cancelAnimationFrame(window.pointCloudAnimationFrameId);
            window.pointCloudAnimationFrameId = null;
        }
    }
    
    // If switching to mappings mode, update the UI
    if (newMode === 'sensorMappings') {
        window.mappings.renderMappings();
    }
}

// Update UI based on current mode
function updateModeUI() {
    // Update tab buttons
    showVideoPlayerModeBtn.classList.toggle('active', currentMode === 'videoPlayer');
    showPointCloudModeBtn.classList.toggle('active', currentMode === 'pointCloud');
    showMappingsModeBtn.classList.toggle('active', currentMode === 'sensorMappings');

    // Show/hide content sections
    utils.toggleElementVisibility(videoPlayerModeContent, currentMode === 'videoPlayer');
    utils.toggleElementVisibility(pointCloudModeContent, currentMode === 'pointCloud');
    utils.toggleElementVisibility(sensorMappingsModeContent, currentMode === 'sensorMappings');
    
    // Hide placeholder if video is loaded, regardless of mode
    const videoPlayer = document.getElementById('videoPlayer');
    utils.toggleElementVisibility(videoPlaceholder, !videoPlayer.src);
    
    // Show video controls only if video loaded AND in video player mode
    utils.toggleElementVisibility(videoPlayerControls, videoPlayer.src && currentMode === 'videoPlayer');
    utils.toggleElementVisibility(videoFilterControls, videoPlayer.src && currentMode === 'videoPlayer');

    // Update sensor mapping info text
    if (currentMode === 'videoPlayer') {
        sensorMappingInfo.innerHTML = `Use the <b>Sensor Mappings</b> tab to configure motion controls for video effects`;
    } else if (currentMode === 'pointCloud') { 
        sensorMappingInfo.innerHTML = `Tilt your device to adjust point cloud view. Ensure sensors are enabled below.`;
    } else { // 'sensorMappings'
        sensorMappingInfo.innerHTML = `Create custom mappings between device sensors and video effects.`;
    }
}

// Export functions to global scope
window.ui = {
    initializeUI,
    switchMode,
    updateModeUI,
    getCurrentMode: function() { return currentMode; }
};

// Export global variables for other modules to access
window.currentMode = currentMode;