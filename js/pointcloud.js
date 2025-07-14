// js/pointcloud.js
const PointCloud = (function() {
    let pointCloudCanvas, mainPointCloudContainer, pointCloudParams, densitySlider, densityValue,
        displacementSlider, displacementValue, pointSizeSlider, pointSizeValue,
        parallaxSensitivitySlider, parallaxSensitivityValue, 
        pcProcessingResolutionSlider, pcProcessingValue,
        pcInvertDepthCheckbox; // New checkbox element

    let videoElementRef; 
    let currentModeGetter = () => 'videoPlayer'; 

    let pointCloudCtx;
    let pointCloudAnimationFrameId;
    const tempCanvas = document.createElement('canvas'); 
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); 
    
    let config = {
        density: 32,
        displacementScale: 50,
        pointSize: 3,
        parallaxSensitivity: 10, 
        maxProcessingDimension: 120,
        invertDepth: false // New config option
    };
    let currentSensorTilt = { beta: 0, gamma: 0 }; 
    let lastCanvasTap = 0;
    let sensorsGloballyEnabledGetter = () => false; 

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
        parallaxSensitivitySlider = document.getElementById('tiltSensitivitySlider'); 
        parallaxSensitivityValue = document.getElementById('tiltSensitivityValue'); 
        pcProcessingResolutionSlider = document.getElementById('pcProcessingResolutionSlider'); 
        pcProcessingValue = document.getElementById('pcProcessingValue'); 
        pcInvertDepthCheckbox = document.getElementById('pcInvertDepthCheckbox'); // Cache new checkbox
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
                parallaxSensitivityValue, pcProcessingValue 
                // Note: invertDepth is not displayed via this function, its state is the checkbox itself
            );
            UI.updateActiveMappingIndicators(); 
        }
    }
    
    function loadInitialPCEffects() {
        setEffect('pc_density', parseInt(densitySlider.value) || getEffectById('pc_density').default);
        setEffect('pc_displacement', parseInt(displacementSlider.value) || getEffectById('pc_displacement').default);
        setEffect('pc_pointSize', parseInt(pointSizeSlider.value) || getEffectById('pc_pointSize').default);
        
        config.parallaxSensitivity = parseInt(parallaxSensitivitySlider.value) || 10;
        config.maxProcessingDimension = parseInt(pcProcessingResolutionSlider.value) || 120;
        config.invertDepth = pcInvertDepthCheckbox.checked; // Load initial state of invertDepth

        UI.updatePointCloudParamDisplays(
            config, densityValue, displacementValue, pointSizeValue, 
            parallaxSensitivityValue, pcProcessingValue
        );
        UI.updateActiveMappingIndicators(); 
    }

    function setupCanvasDimensions() {
        // ... (no changes in this function from previous version) ...
        if (!videoElementRef || !videoElementRef.videoWidth || !videoElementRef.videoHeight || !pointCloudCanvas.parentElement) return;
        const videoAspectRatio = videoElementRef.videoWidth / videoElementRef.videoHeight;
        let canvasWidth = pointCloudCanvas.parentElement.clientWidth;

        if (!canvasWidth && mainPointCloudContainer.classList.contains('fullscreen')) {
            canvasWidth = window.innerWidth;
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

        if (mainPointCloudContainer.classList.contains('fullscreen')) {
            pointCloudCanvas.style.width = '100%';
            pointCloudCanvas.style.height = '100%';
        } else {
            pointCloudCanvas.style.width = ''; 
            pointCloudCanvas.style.height = '';
        }
    }


    function drawPointCloudData(imageData) { 
        if (!pointCloudCtx || !pointCloudCanvas) return;
        pointCloudCtx.fillStyle = '#050505'; 
        pointCloudCtx.fillRect(0, 0, pointCloudCanvas.width, pointCloudCanvas.height);

        const data = imageData.data;
        const imgWidth = imageData.width;
        const imgHeight = imageData.height;

        const stepX = Math.max(1, Math.floor(imgWidth / config.density)); 
        const stepY = Math.max(1, Math.floor(imgHeight / config.density));

        const normTiltBeta = Math.max(-1, Math.min(1, (currentSensorTilt.beta || 0) / 90.0));
        const normTiltGamma = Math.max(-1, Math.min(1, (currentSensorTilt.gamma || 0) / 90.0));

        for (let y = 0; y < imgHeight; y += stepY) {
            for (let x = 0; x < imgWidth; x += stepX) {
                const i = (Math.floor(y) * imgWidth + Math.floor(x)) * 4;
                const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
                
                let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255; 
                if (config.invertDepth) {
                    brightness = 1.0 - brightness; // Invert brightness for depth calculation
                }

                const canvasX = (x / imgWidth) * pointCloudCanvas.width;
                const baseCanvasY = (y / imgHeight) * pointCloudCanvas.height;
                
                // Displacement: positive for "brighter" (after potential inversion), negative for "darker"
                const displacement = (brightness - 0.5) * config.displacementScale; 
                const finalCanvasY = baseCanvasY - displacement; 

                let shiftX = 0; 
                let shiftY = 0;

                if (sensorsGloballyEnabledGetter() && config.parallaxSensitivity > 0) {
                    // Depth factor now also reflects inverted brightness if active
                    const depthFactor = config.displacementScale !== 0 ? displacement / (0.5 * config.displacementScale + 1e-6) : 0;
                    
                    shiftX = normTiltGamma * depthFactor * config.parallaxSensitivity;
                    shiftY = normTiltBeta * depthFactor * config.parallaxSensitivity; 
                }
                
                pointCloudCtx.fillStyle = `rgb(${r},${g},${b})`; // Original color is still used for the point
                pointCloudCtx.fillRect(canvasX + shiftX, finalCanvasY + shiftY, config.pointSize, config.pointSize);
            }
        }
    }

    function renderFrame() {
        // ... (no changes in this function from previous version) ...
        if (currentModeGetter() !== 'pointCloud' || !videoElementRef || !videoElementRef.src) {
             if (pointCloudAnimationFrameId) cancelAnimationFrame(pointCloudAnimationFrameId);
             pointCloudAnimationFrameId = null;
             return;
        }

        if (videoElementRef.paused || videoElementRef.ended || videoElementRef.seeking || videoElementRef.readyState < videoElementRef.HAVE_CURRENT_DATA) {
            pointCloudAnimationFrameId = requestAnimationFrame(renderFrame);
            return;
        }
        
        const MAX_PROCESS_DIM = config.maxProcessingDimension; 
        let processWidth, processHeight;
        if (videoElementRef.videoWidth > videoElementRef.videoHeight) {
            processWidth = Math.min(videoElementRef.videoWidth, MAX_PROCESS_DIM);
            processHeight = videoElementRef.videoHeight * (processWidth / videoElementRef.videoWidth);
        } else {
            processHeight = Math.min(videoElementRef.videoHeight, MAX_PROCESS_DIM);
            processWidth = videoElementRef.videoWidth * (processHeight / videoElementRef.videoHeight);
        }
        processWidth = Math.max(1, Math.round(processWidth)); 
        processHeight = Math.max(1, Math.round(processHeight));

        if (tempCanvas.width !== processWidth) tempCanvas.width = processWidth;
        if (tempCanvas.height !== processHeight) tempCanvas.height = processHeight;

        try {
            tempCtx.drawImage(videoElementRef, 0, 0, tempCanvas.width, tempCanvas.height);
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            drawPointCloudData(imageData); 
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
            return; 
        }
        pointCloudAnimationFrameId = requestAnimationFrame(renderFrame);
    }
    
    function togglePointCloudFullscreen() {
        // ... (no changes in this function from previous version) ...
        if (!mainPointCloudContainer.classList.contains('fullscreen')) {
            enterPointCloudFullscreenMode();
        } else {
            exitPointCloudFullscreenMode();
        }
   }
   
   function enterPointCloudFullscreenMode() {
       // ... (no changes in this function from previous version) ...
       if (mainPointCloudContainer.classList.contains('fullscreen')) return;
       mainPointCloudContainer.classList.add('fullscreen');
       document.body.style.overflow = 'hidden';
       const fsPromise = mainPointCloudContainer.requestFullscreen ? 
                         mainPointCloudContainer.requestFullscreen() : 
                         (mainPointCloudContainer.webkitRequestFullscreen ? mainPointCloudContainer.webkitRequestFullscreen() : Promise.reject());
       
       fsPromise.then(() => {
            setTimeout(setupCanvasDimensions, 50); 
       }).catch(err => {
            console.error("PC FS Error:", err);
            mainPointCloudContainer.classList.remove('fullscreen');
            document.body.style.overflow = '';
            setupCanvasDimensions(); 
       });
   }
   
   function exitPointCloudFullscreenMode() {
       // ... (no changes in this function from previous version) ...
       if (!mainPointCloudContainer.classList.contains('fullscreen') && !document.fullscreenElement && !document.webkitIsFullScreen) return;
       
       const exitFsPromise = document.exitFullscreen ? 
                             document.exitFullscreen() : 
                             (document.webkitExitFullscreen ? document.webkitExitFullscreen() : Promise.reject());

       mainPointCloudContainer.classList.remove('fullscreen'); 
       document.body.style.overflow = '';

       exitFsPromise.then(() => {
            setTimeout(setupCanvasDimensions, 50);
       }).catch(err => {
           console.error("PC Exit FS Error:", err);
           setupCanvasDimensions();
       });
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
        
        parallaxSensitivitySlider.addEventListener('input', (e) => { 
            config.parallaxSensitivity = parseInt(e.target.value); 
            UI.updatePointCloudParamDisplays(
                config, densityValue, displacementValue, pointSizeValue, 
                parallaxSensitivityValue, pcProcessingValue
            );
        });

        pcProcessingResolutionSlider.addEventListener('change', (e) => { 
            config.maxProcessingDimension = parseInt(e.target.value);
            UI.updatePointCloudParamDisplays(
                config, densityValue, displacementValue, pointSizeValue, 
                parallaxSensitivityValue, pcProcessingValue
            );
        });

        pcInvertDepthCheckbox.addEventListener('change', (e) => { // Listener for new checkbox
            config.invertDepth = e.target.checked;
            // No need to call UI.updatePointCloudParamDisplays unless you add a text display for this
        });
    
        pointCloudCanvas.addEventListener('touchend', (e) => {
            if (currentModeGetter() !== 'pointCloud') return;
            const currentTime = new Date().getTime();
            if (currentTime - lastCanvasTap < 300) { 
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

        document.addEventListener('fullscreenchange', () => {
            if (currentModeGetter() === 'pointCloud' && !document.fullscreenElement && mainPointCloudContainer.classList.contains('fullscreen')) {
                exitPointCloudFullscreenMode(); 
            } else if (currentModeGetter() === 'pointCloud') {
                 setTimeout(setupCanvasDimensions, 50); 
            }
        });
        document.addEventListener('webkitfullscreenchange', () => { 
            if (currentModeGetter() === 'pointCloud' && !document.webkitIsFullScreen && mainPointCloudContainer.classList.contains('fullscreen')) {
                exitPointCloudFullscreenMode();
            } else if (currentModeGetter() === 'pointCloud') {
                setTimeout(setupCanvasDimensions, 50);
            }
        });

    }
    
    function init(videoEl, modeGetterFn, sensorStateGetterFn) { 
        videoElementRef = videoEl; 
        currentModeGetter = modeGetterFn;
        sensorsGloballyEnabledGetter = sensorStateGetterFn; 

        cacheDOMElements();
        if (pointCloudCanvas) {
            pointCloudCtx = pointCloudCanvas.getContext('2d', { willReadFrequently: true });
        }
        
        if (parallaxSensitivityValue && parallaxSensitivityValue.previousElementSibling) {
             parallaxSensitivityValue.previousElementSibling.textContent = "Parallax Sensitivity";
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
        updateSensorTilt: (beta, gamma) => { 
            currentSensorTilt.beta = beta;
            currentSensorTilt.gamma = gamma;
        },
        getMainPointCloudContainer: () => mainPointCloudContainer,
        enterPointCloudFullscreenMode,
        exitPointCloudFullscreenMode, 
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
