// js/pointcloud.js
const PointCloud = (function() {
    let pointCloudCanvas, mainPointCloudContainer, pointCloudParams, densitySlider, densityValue,
        displacementSlider, displacementValue, pointSizeSlider, pointSizeValue,
        tiltSensitivitySlider, tiltSensitivityValue, // This will now be parallax sensitivity
        pcProcessingResolutionSlider, pcProcessingValue; 

    let videoPlayerRef; 
    let currentModeGetter = () => 'videoPlayer'; 

    let pointCloudCtx;
    let pointCloudAnimationFrameId;
    const tempCanvas = document.createElement('canvas'); 
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); 
    
    let config = {
        density: 32,
        displacementScale: 50,
        pointSize: 3,
        parallaxSensitivity: 10, // Renamed from tiltSensitivity
        maxProcessingDimension: 120 
    };
    let currentSensorTilt = { beta: 0, gamma: 0 }; // Store sensor beta/gamma for parallax
    let lastCanvasTap = 0;
    let sensorsGloballyEnabledGetter = () => false; // To check if sensors are active

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
        tiltSensitivitySlider = document.getElementById('tiltSensitivitySlider'); // This ID is used for parallax
        tiltSensitivityValue = document.getElementById('tiltSensitivityValue'); // Its label is "Parallax Sensitivity"
        pcProcessingResolutionSlider = document.getElementById('pcProcessingResolutionSlider'); 
        pcProcessingValue = document.getElementById('pcProcessingValue'); 
    }
    
    function setEffect(effectId, value) {
        const effectDetails = getEffectById(effectId);
        if (!effectDetails || effectDetails.target !== 'pointcloud') return;

        if (config.hasOwnProperty(effectDetails.prop)) {
            config[effectDetails.prop] = Math.max(effectDetails.min, Math.min(effectDetails.max, value));
            
            if (effectId === 'pc_density' && densitySlider) densitySlider.value = value;
            else if (effectId === 'pc_displacement' && displacementSlider) displacementSlider.value = value;
            else if (effectId === 'pc_pointSize' && pointSizeSlider) pointSizeSlider.value = value;

            if(densityValue) UI.updatePointCloudParamDisplays(
                config, densityValue, displacementValue, pointSizeValue,
                tiltSensitivityValue, pcProcessingValue 
            );
            UI.updateActiveMappingIndicators(); 
        }
    }
    
    function loadInitialPCEffects() {
        setEffect('pc_density', parseInt(densitySlider.value) || getEffectById('pc_density').default);
        setEffect('pc_displacement', parseInt(displacementSlider.value) || getEffectById('pc_displacement').default);
        setEffect('pc_pointSize', parseInt(pointSizeSlider.value) || getEffectById('pc_pointSize').default);
        
        config.parallaxSensitivity = parseInt(tiltSensitivitySlider.value) || 10;
        config.maxProcessingDimension = parseInt(pcProcessingResolutionSlider.value) || 120;

        UI.updatePointCloudParamDisplays(
            config, densityValue, displacementValue, pointSizeValue, 
            tiltSensitivityValue, pcProcessingValue
        );
        UI.updateActiveMappingIndicators(); 
    }

    function setupCanvasDimensions() {
        if (!videoPlayerRef || !videoPlayerRef.videoWidth || !videoPlayerRef.videoHeight || !pointCloudCanvas.parentElement) return;
        const videoAspectRatio = videoPlayerRef.videoWidth / videoPlayerRef.videoHeight;
        let canvasWidth = pointCloudCanvas.parentElement.clientWidth;

        if (!canvasWidth && mainPointCloudContainer.classList.contains('fullscreen')) {
            canvasWidth = window.innerWidth;
        } else if (!canvasWidth) {
            canvasWidth = Math.min(window.innerWidth - 40, 500 - 32); // Default if parent has no width
        }
        
        // Set canvas logical size for drawing
        pointCloudCanvas.width = canvasWidth;
        if (videoAspectRatio && isFinite(videoAspectRatio) && videoAspectRatio > 0) {
            pointCloudCanvas.height = canvasWidth / videoAspectRatio;
        } else {
            pointCloudCanvas.height = canvasWidth * (9 / 16); // Fallback aspect ratio
        }
        if (isNaN(pointCloudCanvas.height) || pointCloudCanvas.height <= 0 || !isFinite(pointCloudCanvas.height)) {
            pointCloudCanvas.height = canvasWidth * (9 / 16);
        }

        // If in fullscreen, also set display style to fill the screen
        if (mainPointCloudContainer.classList.contains('fullscreen')) {
            pointCloudCanvas.style.width = '100%';
            pointCloudCanvas.style.height = '100%';
            // Object-fit is not directly applicable to canvas, aspect ratio maintained by width/height setting
        } else {
            pointCloudCanvas.style.width = ''; // Reset style so it's governed by parent
            pointCloudCanvas.style.height = '';
        }
    }


    function drawPointCloudData(imageData) { // Removed tiltBeta, tiltGamma from params, use currentSensorTilt
        if (!pointCloudCtx || !pointCloudCanvas) return;
        pointCloudCtx.fillStyle = '#050505'; 
        pointCloudCtx.fillRect(0, 0, pointCloudCanvas.width, pointCloudCanvas.height);

        const data = imageData.data;
        const imgWidth = imageData.width;
        const imgHeight = imageData.height;

        const stepX = Math.max(1, Math.floor(imgWidth / config.density)); // Ensure integer steps
        const stepY = Math.max(1, Math.floor(imgHeight / config.density));


        // Normalized tilt for parallax effect (-1 to 1 range)
        // Clamp sensor values to a reasonable range (e.g., -90 to 90 for beta/gamma)
        const normTiltBeta = Math.max(-1, Math.min(1, (currentSensorTilt.beta || 0) / 90.0));
        const normTiltGamma = Math.max(-1, Math.min(1, (currentSensorTilt.gamma || 0) / 90.0));

        for (let y = 0; y < imgHeight; y += stepY) {
            for (let x = 0; x < imgWidth; x += stepX) {
                const i = (Math.floor(y) * imgWidth + Math.floor(x)) * 4;
                const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
                const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // 0 (black) to 1 (white)

                const canvasX = (x / imgWidth) * pointCloudCanvas.width;
                const baseCanvasY = (y / imgHeight) * pointCloudCanvas.height;
                
                // Displacement: positive for brighter (comes out), negative for darker (goes in)
                const displacement = (brightness - 0.5) * config.displacementScale; 
                const finalCanvasY = baseCanvasY - displacement; 

                let shiftX = 0; 
                let shiftY = 0;

                if (sensorsGloballyEnabledGetter() && config.parallaxSensitivity > 0) {
                    // Depth factor: 0 for mid-gray, positive for "closer", negative for "further"
                    // Normalize displacement to roughly -1 to 1 based on displacementScale
                    const depthFactor = config.displacementScale !== 0 ? displacement / (0.5 * config.displacementScale + 1e-6) : 0;
                    
                    shiftX = normTiltGamma * depthFactor * config.parallaxSensitivity;
                    shiftY = normTiltBeta * depthFactor * config.parallaxSensitivity; 
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
        
        const MAX_PROCESS_DIM = config.maxProcessingDimension; 
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
            drawPointCloudData(imageData); // Pass only imageData
        } catch (e) {
            console.error("Error processing video for point cloud:", e);
            if (e.name === "SecurityError") {
                alert("Point Cloud Error: Cannot process video due to cross-origin restrictions (CORS). Try a different video source.");
            } else {
                alert("Point Cloud Error: Could not process video frame.");
            }
            if (typeof window.App !== 'undefined' && typeof window.App.forceSwitchMode === 'function') {
                window.App.forceSwitchMode('videoPlayer');
            }
            return; // Stop rendering on error
        }
        pointCloudAnimationFrameId = requestAnimationFrame(renderFrame);
    }
    
    function togglePointCloudFullscreen() {
        if (!mainPointCloudContainer.classList.contains('fullscreen')) {
            enterPointCloudFullscreenMode();
        } else {
            exitPointCloudFullscreenMode();
        }
   }
   
   function enterPointCloudFullscreenMode() {
       if (mainPointCloudContainer.classList.contains('fullscreen')) return;
       mainPointCloudContainer.classList.add('fullscreen');
       document.body.style.overflow = 'hidden';
       if (mainPointCloudContainer.requestFullscreen) {
            mainPointCloudContainer.requestFullscreen().catch(err => {
                console.error("PC FS Error:", err);
                mainPointCloudContainer.classList.remove('fullscreen');
                document.body.style.overflow = '';
            }).then(() => setupCanvasDimensions()); // Recalculate size after entering FS
       } else if (mainPointCloudContainer.webkitRequestFullscreen) { // Safari
            mainPointCloudContainer.webkitRequestFullscreen();
            // Safari might need a slight delay or listen to webkitfullscreenchange
            setTimeout(setupCanvasDimensions, 100); 
       }
       setupCanvasDimensions(); // Call immediately for layout, then again on promise/event
   }
   
   function exitPointCloudFullscreenMode() {
       if (!mainPointCloudContainer.classList.contains('fullscreen') && !document.fullscreenElement && !document.webkitIsFullScreen) return;
       mainPointCloudContainer.classList.remove('fullscreen');
       document.body.style.overflow = '';
       if (document.exitFullscreen) {
           document.exitFullscreen().catch(err => console.error("PC Exit FS Error:", err))
           .then(() => setupCanvasDimensions()); // Recalculate after exiting
       } else if (document.webkitExitFullscreen) { // Safari
           document.webkitExitFullscreen();
           setTimeout(setupCanvasDimensions, 100);
       }
       setupCanvasDimensions();
   }

    function setupEventListeners() {
        densitySlider.addEventListener('input', (e) => {
            setEffect('pc_density', parseInt(e.target.value));
        });
        
        displacementSlider.addEventListener('input', (e) => {
            setEffect('pc_displacement', parseInt(e.target.value));
        });
        
        pointSizeSlider.addEventListener('input', (e) => {
            setEffect('pc_pointSize', parseInt(e.target.value));
        });
        
        tiltSensitivitySlider.addEventListener('input', (e) => { // Now parallax sensitivity
            config.parallaxSensitivity = parseInt(e.target.value); 
            UI.updatePointCloudParamDisplays(
                config, densityValue, displacementValue, pointSizeValue, 
                tiltSensitivityValue, pcProcessingValue
            );
        });

        pcProcessingResolutionSlider.addEventListener('change', (e) => { 
            config.maxProcessingDimension = parseInt(e.target.value);
            UI.updatePointCloudParamDisplays(
                config, densityValue, displacementValue, pointSizeValue, 
                tiltSensitivityValue, pcProcessingValue
            );
        });
    
        pointCloudCanvas.addEventListener('touchend', (e) => {
            if (currentModeGetter() !== 'pointCloud') return;
            const currentTime = new Date().getTime();
            if (currentTime - lastCanvasTap < 300) { // Reduced for dbl tap
                togglePointCloudFullscreen(); 
                e.preventDefault(); 
            }
            lastCanvasTap = currentTime;
        });
        
        pointCloudCanvas.addEventListener('dblclick', () => {
            if (currentModeGetter() === 'pointCloud') {
                togglePointCloudFullscreen();
            }
        });

        // Listen for fullscreen changes to resize canvas
        document.addEventListener('fullscreenchange', () => {
            if (currentModeGetter() === 'pointCloud') setupCanvasDimensions();
        });
        document.addEventListener('webkitfullscreenchange', () => { // Safari
            if (currentModeGetter() === 'pointCloud') setupCanvasDimensions();
        });

    }
    
    function init(videoElemRef, modeGetterFn, sensorStateGetterFn) { // Added sensorStateGetterFn
        videoPlayerRef = videoElemRef;
        currentModeGetter = modeGetterFn;
        sensorsGloballyEnabledGetter = sensorStateGetterFn; // Store the getter

        cacheDOMElements();
        if (pointCloudCanvas) {
            pointCloudCtx = pointCloudCanvas.getContext('2d', { willReadFrequently: true });
        }
        setupEventListeners();
        loadInitialPCEffects(); 
    }

    return {
        init,
        setEffect,
        startRendering: renderFrame,
        stopRendering: () => {
            if (pointCloudAnimationFrameId) {
                cancelAnimationFrame(pointCloudAnimationFrameId);
                pointCloudAnimationFrameId = null;
            }
        },
        setupCanvasDimensions,
        updateSensorTilt: (beta, gamma) => { // New method to receive sensor data
            currentSensorTilt.beta = beta;
            currentSensorTilt.gamma = gamma;
        },
        getMainPointCloudContainer: () => mainPointCloudContainer,
        // togglePointCloudFullscreen, // Dbl tap is primary
        enterPointCloudFullscreenMode,
        exitPointCloudFullscreenMode, // Keep for global Esc
        getDOM: () => ({
             pointCloudParams,
             pointCloudCanvas
        }),
        isEffectActive: (effectId) => {
            const effect = getEffectById(effectId);
            if (!effect || !config.hasOwnProperty(effect.prop)) return false;
            return config[effect.prop] !== effect.default;
        }
    };
})();
