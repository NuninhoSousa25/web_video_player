/**
 * Enhanced Sensor Video Processor - Point Cloud Module
 * Handles point cloud visualization of video content
 */

// Point cloud state variables
let pointCloudCtx;
let pointCloudAnimationFrameId;
const tempCanvas = document.createElement('canvas'); 
const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); 
let pointCloudConfig = {
    density: 32,
    displacementScale: 50,
    pointSize: 3,
    tiltSensitivity: 10
};
let pointCloudTiltAngles = { beta: 0, gamma: 0 };

// DOM elements
let pointCloudCanvas;
let mainPointCloudContainer;
let densitySlider;
let densityValue;
let displacementSlider;
let displacementValue;
let pointSizeSlider;
let pointSizeValue;
let tiltSensitivitySlider;
let tiltSensitivityValue;

// Initialize point cloud module
function initializePointCloud() {
    // Get DOM elements
    pointCloudCanvas = utils.getElement('pointCloudCanvas');
    mainPointCloudContainer = utils.getElement('mainPointCloudContainer');
    densitySlider = utils.getElement('densitySlider');
    densityValue = utils.getElement('densityValue');
    displacementSlider = utils.getElement('displacementSlider');
    displacementValue = utils.getElement('displacementValue');
    pointSizeSlider = utils.getElement('pointSizeSlider');
    pointSizeValue = utils.getElement('pointSizeValue');
    tiltSensitivitySlider = utils.getElement('tiltSensitivitySlider');
    tiltSensitivityValue = utils.getElement('tiltSensitivityValue');

    // Initialize canvas context
    if (pointCloudCanvas) {
        pointCloudCtx = pointCloudCanvas.getContext('2d', { willReadFrequently: true });
    }
    
    // Set up event listeners
    densitySlider.addEventListener('input', updatePointCloudConfig);
    displacementSlider.addEventListener('input', updatePointCloudConfig);
    pointSizeSlider.addEventListener('input', updatePointCloudConfig);
    tiltSensitivitySlider.addEventListener('input', updatePointCloudConfig);
    
    // Set up double tap/click for fullscreen
    let lastTap = 0;
    pointCloudCanvas.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        if (currentTime - lastTap < 500) { 
            togglePointCloudFullscreen(); 
            e.preventDefault(); 
        }
        lastTap = currentTime;
    });
    
    pointCloudCanvas.addEventListener('dblclick', () => {
        if (window.currentMode === 'pointCloud') togglePointCloudFullscreen();
    });
    
    // Update initial display values
    updatePointCloudParamDisplays();
}

// Update point cloud configuration from sliders
function updatePointCloudConfig(e) {
    if (e) {
        const target = e.target;
        if (target === densitySlider) {
            pointCloudConfig.density = parseInt(target.value);
        } else if (target === displacementSlider) {
            pointCloudConfig.displacementScale = parseInt(target.value);
        } else if (target === pointSizeSlider) {
            pointCloudConfig.pointSize = parseInt(target.value);
        } else if (target === tiltSensitivitySlider) {
            pointCloudConfig.tiltSensitivity = parseInt(target.value);
        }
    }
    
    updatePointCloudParamDisplays();
}

// Update display values for point cloud parameters
function updatePointCloudParamDisplays() {
    densityValue.textContent = pointCloudConfig.density;
    displacementValue.textContent = pointCloudConfig.displacementScale;
    pointSizeValue.textContent = pointCloudConfig.pointSize;
    tiltSensitivityValue.textContent = pointCloudConfig.tiltSensitivity;
}

// Set up canvas dimensions based on video aspect ratio
function setupPointCloudCanvasDimensions() {
    const videoPlayer = document.getElementById('videoPlayer');
    
    if (!videoPlayer.videoWidth || !videoPlayer.videoHeight || !pointCloudCanvas.parentElement) return;
    
    const videoAspectRatio = videoPlayer.videoWidth / videoPlayer.videoHeight;
    let canvasWidth = pointCloudCanvas.parentElement.clientWidth;

    if (!canvasWidth && mainPointCloudContainer.classList.contains('fullscreen')) { 
        // Fullscreen canvas case
        canvasWidth = window.innerWidth;
        pointCloudCanvas.width = window.innerWidth;
        pointCloudCanvas.height = window.innerHeight;
        return; // Aspect ratio handled by object-fit in fullscreen
    } else if (!canvasWidth) { 
        // Fallback if parent has no width yet
        canvasWidth = Math.min(window.innerWidth - 40, 500-32); // Approx width of container
    }

    pointCloudCanvas.width = canvasWidth;
    
    if (videoAspectRatio && isFinite(videoAspectRatio) && videoAspectRatio > 0) {
        pointCloudCanvas.height = canvasWidth / videoAspectRatio;
    } else {
        pointCloudCanvas.height = canvasWidth * (9/16); 
    }
    
    if (isNaN(pointCloudCanvas.height) || pointCloudCanvas.height <= 0 || !isFinite(pointCloudCanvas.height)) {
        pointCloudCanvas.height = canvasWidth * (9/16);
    }
}

// Start point cloud rendering loop
function renderPointCloudFrame() {
    if (window.currentMode !== 'pointCloud' || !document.getElementById('videoPlayer').src) {
        if (pointCloudAnimationFrameId) {
            cancelAnimationFrame(pointCloudAnimationFrameId);
        }
        pointCloudAnimationFrameId = null;
        return;
    }

    const videoPlayer = document.getElementById('videoPlayer');
    
    if (videoPlayer.paused || videoPlayer.ended || videoPlayer.seeking || 
        videoPlayer.readyState < videoPlayer.HAVE_CURRENT_DATA) {
        pointCloudAnimationFrameId = requestAnimationFrame(renderPointCloudFrame); // Keep trying
        return;
    }
    
    const MAX_PROCESS_DIM = 120; // Keep it small for performance
    let processWidth, processHeight;
    
    if (videoPlayer.videoWidth > videoPlayer.videoHeight) {
        processWidth = Math.min(videoPlayer.videoWidth, MAX_PROCESS_DIM);
        processHeight = videoPlayer.videoHeight * (processWidth / videoPlayer.videoWidth);
    } else {
        processHeight = Math.min(videoPlayer.videoHeight, MAX_PROCESS_DIM);
        processWidth = videoPlayer.videoWidth * (processHeight / videoPlayer.videoHeight);
    }
    
    processWidth = Math.max(1, Math.round(processWidth)); 
    processHeight = Math.max(1, Math.round(processHeight));

    if (tempCanvas.width !== processWidth) tempCanvas.width = processWidth;
    if (tempCanvas.height !== processHeight) tempCanvas.height = processHeight;

    try {
        tempCtx.drawImage(videoPlayer, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        drawPointCloud(imageData, pointCloudTiltAngles.beta, pointCloudTiltAngles.gamma);
    } catch (e) {
        console.error("Error processing video for point cloud:", e);
        if (e.name === "SecurityError") {
            alert("Point Cloud Error: Cannot process video due to cross-origin restrictions (CORS). Try a different video source.");
        } else {
            alert("Point Cloud Error: Could not process video frame.");
        }
        window.ui.switchMode('videoPlayer'); // Revert to video player on error
        return;
    }
    
    pointCloudAnimationFrameId = requestAnimationFrame(renderPointCloudFrame);
}

// Draw the point cloud visualization
function drawPointCloud(imageData, tiltBeta, tiltGamma) {
    if (!pointCloudCtx || !pointCloudCanvas) return;
    
    pointCloudCtx.fillStyle = '#050505'; 
    pointCloudCtx.fillRect(0, 0, pointCloudCanvas.width, pointCloudCanvas.height);

    const data = imageData.data;
    const imgWidth = imageData.width;
    const imgHeight = imageData.height;

    const stepX = Math.max(1, imgWidth / pointCloudConfig.density);
    const stepY = Math.max(1, imgHeight / pointCloudConfig.density);

    let currentPCSensorTiltSensitivity = 0;
    if (window.sensorsGloballyEnabled || window.testingModeEnabled) {
        currentPCSensorTiltSensitivity = pointCloudConfig.tiltSensitivity;
    }

    const normTiltBeta = Math.max(-90, Math.min(90, tiltBeta || 0)) / 90.0;
    const normTiltGamma = Math.max(-90, Math.min(90, tiltGamma || 0)) / 90.0;

    for (let y = 0; y < imgHeight; y += stepY) {
        for (let x = 0; x < imgWidth; x += stepX) {
            const i = (Math.floor(y) * imgWidth + Math.floor(x)) * 4;
            const r = data[i]; 
            const g = data[i + 1]; 
            const b = data[i + 2];
            
            // Calculate brightness (0-1)
            const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255; 

            const canvasX = (x / imgWidth) * pointCloudCanvas.width;
            const baseCanvasY = (y / imgHeight) * pointCloudCanvas.height;
            
            const displacement = (brightness - 0.5) * pointCloudConfig.displacementScale; 
            const finalCanvasY = baseCanvasY - displacement; 

            let shiftX = 0; 
            let shiftY = 0;
            
            if ((window.sensorsGloballyEnabled || window.testingModeEnabled) && currentPCSensorTiltSensitivity > 0) {
                const depthFactor = pointCloudConfig.displacementScale !== 0 ? 
                    displacement / (0.5 * pointCloudConfig.displacementScale + 1e-6) : 0;
                shiftX = normTiltGamma * depthFactor * currentPCSensorTiltSensitivity;
                shiftY = normTiltBeta * depthFactor * currentPCSensorTiltSensitivity; 
            }
            
            pointCloudCtx.fillStyle = `rgb(${r},${g},${b})`;
            pointCloudCtx.fillRect(
                canvasX + shiftX, 
                finalCanvasY + shiftY, 
                pointCloudConfig.pointSize, 
                pointCloudConfig.pointSize
            );
        }
    }
}

// Toggle point cloud fullscreen mode
function togglePointCloudFullscreen() {
    if (!mainPointCloudContainer.classList.contains('fullscreen')) {
        enterPointCloudFullscreenMode();
    } else {
        exitPointCloudFullscreenMode();
    }
}

// Enter point cloud fullscreen mode
function enterPointCloudFullscreenMode() {
    mainPointCloudContainer.classList.add('fullscreen');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', exitFullscreenOnEscape);
    
    if (mainPointCloudContainer.requestFullscreen) {
        mainPointCloudContainer.requestFullscreen().catch(err => console.error("FS Error:", err));
    }
    
    // Need to resize canvas for fullscreen
    setupPointCloudCanvasDimensions();
}

// Exit point cloud fullscreen mode
function exitPointCloudFullscreenMode() {
    mainPointCloudContainer.classList.remove('fullscreen');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', exitFullscreenOnEscape);
    
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error("Exit FS Error:", err));
    }
    
    // Resize canvas back to normal
    setupPointCloudCanvasDimensions();
}

// Handle ESC key to exit fullscreen
function exitFullscreenOnEscape(e) {
    if (e.key === 'Escape') {
        exitPointCloudFullscreenMode();
    }
}

// Export functions to global scope
window.pointCloud = {
    initializePointCloud,
    setupPointCloudCanvasDimensions,
    renderPointCloudFrame,
    togglePointCloudFullscreen
};

// Export global variables for other modules to access
window.pointCloudConfig = pointCloudConfig;
window.pointCloudTiltAngles = pointCloudTiltAngles;