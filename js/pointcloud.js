// js/pointcloud.js
const PointCloud = (function() {
    let pointCloudCanvas, mainPointCloudContainer, pointCloudParams, densitySlider, densityValue,
        displacementSlider, displacementValue, pointSizeSlider, pointSizeValue,
        tiltSensitivitySlider, tiltSensitivityValue;

    let videoPlayerRef; // Reference to the video element from Player module
    let currentModeGetter = () => 'videoPlayer'; // Default getter

    let pointCloudCtx;
    let pointCloudAnimationFrameId;
    const tempCanvas = document.createElement('canvas'); 
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); 
    
    let config = {
        density: 32,
        displacementScale: 50,
        pointSize: 3,
        tiltSensitivity: 10
    };
    let tiltAngles = { beta: 0, gamma: 0 }; // Will be updated by Mappings.js or Sensor.js
    let lastCanvasTap = 0;
    let sensorsGloballyEnabledGetter = () => false; // Getter for sensor state

    function cacheDOMElements() {
        pointCloudCanvas = document.getElementById('pointCloudCanvas');
        mainPointCloudContainer = document.getElementById('mainPointCloudContainer');
        pointCloudParams = document.getElementById('pointCloudParams');
        densitySlider = document.getElementById('densitySlider');
        densityValue = document.getElementById('densityValue');
        displacementSlider = document.getElementById('displacementSlider');
        displacementValue = document.getElementById('displacementValue');
        pointSizeSlider = document.getElementById('pointSizeSlider');
        pointSizeValue = document.getElementById('pointSizeValue');
        tiltSensitivitySlider = document.getElementById('tiltSensitivitySlider');
        tiltSensitivityValue = document.getElementById('tiltSensitivityValue');
    }
    
    function setupCanvasDimensions() {
        if (!videoPlayerRef || !videoPlayerRef.videoWidth || !videoPlayerRef.videoHeight || !pointCloudCanvas.parentElement) return;
        const videoAspectRatio = videoPlayerRef.videoWidth / videoPlayerRef.videoHeight;
        let canvasWidth = pointCloudCanvas.parentElement.clientWidth;

        if (!canvasWidth && mainPointCloudContainer.classList.contains('fullscreen')) {
            canvasWidth = window.innerWidth;
            pointCloudCanvas.width = window.innerWidth;
            pointCloudCanvas.height = window.innerHeight;
            return;
        } else if (!canvasWidth) {
            canvasWidth = Math.min(window.innerWidth - 40, 500 - 32);
        }

        pointCloudCanvas.width = canvasWidth;
        if (videoAspectRatio && isFinite(videoAspectRatio) && videoAspectRatio > 0) {
            pointCloudCanvas.height = canvasWidth / videoAspectRatio;
        } else {
            pointCloudCanvas.height = canvasWidth * (9 / 16);
        }
        if (isNaN(pointCloudCanvas.height) || pointCloudCanvas.height <= 0 || !isFinite(pointCloudCanvas.height)) {
            pointCloudCanvas.height = canvasWidth * (9 / 16);
        }
    }

    function drawPointCloudData(imageData, currentTiltBeta, currentTiltGamma) {
        if (!pointCloudCtx || !pointCloudCanvas) return;
        pointCloudCtx.fillStyle = '#050505'; 
        pointCloudCtx.fillRect(0, 0, pointCloudCanvas.width, pointCloudCanvas.height);

        const data = imageData.data;
        const imgWidth = imageData.width;
        const imgHeight = imageData.height;

        const stepX = Math.max(1, imgWidth / config.density);
        const stepY = Math.max(1, imgHeight / config.density);

        let currentPCSensorTiltSensitivity = 0;
        if (sensorsGloballyEnabledGetter()) { // Use getter
             currentPCSensorTiltSensitivity = config.tiltSensitivity;
        }

        const normTiltBeta = Math.max(-90, Math.min(90, currentTiltBeta || 0)) / 90.0;
        const normTiltGamma = Math.max(-90, Math.min(90, currentTiltGamma || 0)) / 90.0;

        for (let y = 0; y < imgHeight; y += stepY) {
            for (let x = 0; x < imgWidth; x += stepX) {
                const i = (Math.floor(y) * imgWidth + Math.floor(x)) * 4;
                const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
                const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255; 

                const canvasX = (x / imgWidth) * pointCloudCanvas.width;
                const baseCanvasY = (y / imgHeight) * pointCloudCanvas.height;
                
                const displacement = (brightness - 0.5) * config.displacementScale; 
                const finalCanvasY = baseCanvasY - displacement; 

                let shiftX = 0; let shiftY = 0;
                if (sensorsGloballyEnabledGetter() && currentPCSensorTiltSensitivity > 0) {
                    const depthFactor = config.displacementScale !== 0 ? displacement / (0.5 * config.displacementScale + 1e-6) : 0;
                    shiftX = normTiltGamma * depthFactor * currentPCSensorTiltSensitivity;
                    shiftY = normTiltBeta * depthFactor * currentPCSensorTiltSensitivity; 
                }
                
                pointCloudCtx.fillStyle = `rgb(${r},${g},${b})`;
                pointCloudCtx.fillRect(canvasX + shiftX, finalCanvasY + shiftY, config.pointSize, config.pointSize);
            }
        }
    }

    function renderFrame() {
        if (currentModeGetter() !== 'pointCloud' || !videoPlayerRef || !videoPlayerRef.src) {
             if (pointCloudAnimationFrameId) cancelAnimationFrame(pointCloudAnimationFrameId);
             pointCloudAnimationFrameId = null;
             return;
        }

        if (videoPlayerRef.paused || videoPlayerRef.ended || videoPlayerRef.seeking || videoPlayerRef.readyState < videoPlayerRef.HAVE_CURRENT_DATA) {
            pointCloudAnimationFrameId = requestAnimationFrame(renderFrame);
            return;
        }
        
        const MAX_PROCESS_DIM = 120;
        let processWidth, processHeight;
        if (videoPlayerRef.videoWidth > videoPlayerRef.videoHeight) {
            processWidth = Math.min(videoPlayerRef.videoWidth, MAX_PROCESS_DIM);
            processHeight = videoPlayerRef.videoHeight * (processWidth / videoPlayerRef.videoWidth);
        } else {
            processHeight = Math.min(videoPlayerRef.videoHeight, MAX_PROCESS_DIM);
            processWidth = videoPlayerRef.videoWidth * (processHeight / videoPlayerRef.videoHeight);
        }
        processWidth = Math.max(1, Math.round(processWidth)); 
        processHeight = Math.max(1, Math.round(processHeight));

        if (tempCanvas.width !== processWidth) tempCanvas.width = processWidth;
        if (tempCanvas.height !== processHeight) tempCanvas.height = processHeight;

        try {
            tempCtx.drawImage(videoPlayerRef, 0, 0, tempCanvas.width, tempCanvas.height);
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            drawPointCloudData(imageData, tiltAngles.beta, tiltAngles.gamma);
        } catch (e) {
            console.error("Error processing video for point cloud:", e);
            if (e.name === "SecurityError") {
                alert("Point Cloud Error: Cannot process video due to cross-origin restrictions (CORS). Try a different video source.");
            } else {
                alert("Point Cloud Error: Could not process video frame.");
            }
            // Notify main.js to switch mode
            if (typeof window.App !== 'undefined' && typeof window.App.forceSwitchMode === 'function') {
                window.App.forceSwitchMode('videoPlayer');
            }
            return;
        }
        pointCloudAnimationFrameId = requestAnimationFrame(renderFrame);
    }
    
    function togglePointCloudFullscreen() {
        if (!mainPointCloudContainer.classList.contains('fullscreen')) enterPointCloudFullscreenMode();
        else exitPointCloudFullscreenMode();
   }
   function enterPointCloudFullscreenMode() {
       mainPointCloudContainer.classList.add('fullscreen');
       document.body.style.overflow = 'hidden';
       // document.addEventListener('keydown', exitFullscreenOnEscape); // Managed by Main.js
       if (mainPointCloudContainer.requestFullscreen) mainPointCloudContainer.requestFullscreen().catch(err => console.error("FS Error:", err));
   }
   function exitPointCloudFullscreenMode() {
       mainPointCloudContainer.classList.remove('fullscreen');
       document.body.style.overflow = '';
       // document.removeEventListener('keydown', exitFullscreenOnEscape); // Managed by Main.js
       if (document.exitFullscreen) document.exitFullscreen().catch(err => console.error("Exit FS Error:", err));
   }

    function setupEventListeners() {
        densitySlider.addEventListener('input', (e) => { config.density = parseInt(e.target.value); UI.updatePointCloudParamDisplays(config, densityValue, displacementValue, pointSizeValue, tiltSensitivityValue); });
        displacementSlider.addEventListener('input', (e) => { config.displacementScale = parseInt(e.target.value); UI.updatePointCloudParamDisplays(config, densityValue, displacementValue, pointSizeValue, tiltSensitivityValue); });
        pointSizeSlider.addEventListener('input', (e) => { config.pointSize = parseInt(e.target.value); UI.updatePointCloudParamDisplays(config, densityValue, displacementValue, pointSizeValue, tiltSensitivityValue); });
        tiltSensitivitySlider.addEventListener('input', (e) => { config.tiltSensitivity = parseInt(e.target.value); UI.updatePointCloudParamDisplays(config, densityValue, displacementValue, pointSizeValue, tiltSensitivityValue);});
    
        pointCloudCanvas.addEventListener('touchend', (e) => {
            if (currentModeGetter() !== 'pointCloud') return;
            const currentTime = new Date().getTime();
            if (currentTime - lastCanvasTap < 500) { togglePointCloudFullscreen(); e.preventDefault(); }
            lastCanvasTap = currentTime;
        });
        pointCloudCanvas.addEventListener('dblclick', () => { if (currentModeGetter() === 'pointCloud') togglePointCloudFullscreen(); });
    }
    
    function init(videoElemRef, modeGetterFn, sensorStateGetter) {
        videoPlayerRef = videoElemRef;
        currentModeGetter = modeGetterFn;
        sensorsGloballyEnabledGetter = sensorStateGetter;

        cacheDOMElements();
        if (pointCloudCanvas) {
            pointCloudCtx = pointCloudCanvas.getContext('2d', { willReadFrequently: true });
        }
        setupEventListeners();
        UI.updatePointCloudParamDisplays(config, densityValue, displacementValue, pointSizeValue, tiltSensitivityValue);
    }

    // Public API
    return {
        init,
        startRendering: renderFrame,
        stopRendering: () => {
            if (pointCloudAnimationFrameId) {
                cancelAnimationFrame(pointCloudAnimationFrameId);
                pointCloudAnimationFrameId = null;
            }
        },
        setupCanvasDimensions,
        updateTiltAngles: (beta, gamma) => { // Called by Mappings.js
            tiltAngles.beta = beta;
            tiltAngles.gamma = gamma;
        },
        getMainPointCloudContainer: () => mainPointCloudContainer,
        togglePointCloudFullscreen,
        enterPointCloudFullscreenMode,
        exitPointCloudFullscreenMode,
        getDOM: () => ({ // For main.js to show/hide relevant controls
             pointCloudParams,
             pointCloudCanvas // Though canvas is always part of its container
        })
    };
})();
