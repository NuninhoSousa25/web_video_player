// js/player/unified-effects.js - Performance optimized version
const UnifiedVideoEffects = (function() {
    
    let videoPlayer;
    let canvas, ctx;
    let animationId = null;
    let isProcessing = false;
    
    // **PERFORMANCE: Skip frames when too slow**
    let lastFrameTime = 0;
    let frameSkipCount = 0;
    const TARGET_FPS = 30; // Reduced from 60fps for better performance
    const FRAME_TIME_TARGET = 1000 / TARGET_FPS;
    
    // All effects in one object
    let effects = {
        // CSS-style effects (now applied via canvas)
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        blur: 0,
        sepia: 0,
        grayscale: 0,
        invert: 0,
        
        // Artistic effects
        pixelSort: 0,
        digitalGlitch: 0,
        chromaShift: 0,
        kaleidoscope: 0,
        colorQuantize: 0,
        noiseOverlay: 0
    };
    
    // **PERFORMANCE: Canvas size optimization**
    let canvasScale = 1;
    const MAX_CANVAS_WIDTH = 720; // Further reduced for performance
    const MAX_CANVAS_HEIGHT = 480;
    
    function setupCanvas() {
        if (!canvas) {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d', { 
                willReadFrequently: true,
                alpha: false, // Better performance for opaque content
                desynchronized: true // Allow async rendering
            });
            
            // Position canvas over video
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '5';
            canvas.style.backgroundColor = 'transparent';
        }
    }
    
    function updateCanvas() {
        if (!videoPlayer || !canvas) return;
        
        const rect = videoPlayer.getBoundingClientRect();
        const videoWidth = videoPlayer.videoWidth || rect.width;
        const videoHeight = videoPlayer.videoHeight || rect.height;
        
        // **PERFORMANCE: Aggressive canvas size limiting**
        let canvasWidth = videoWidth;
        let canvasHeight = videoHeight;
        
        if (videoWidth > MAX_CANVAS_WIDTH) {
            canvasScale = MAX_CANVAS_WIDTH / videoWidth;
            canvasWidth = MAX_CANVAS_WIDTH;
            canvasHeight = videoHeight * canvasScale;
        }
        
        if (canvasHeight > MAX_CANVAS_HEIGHT) {
            canvasScale = MAX_CANVAS_HEIGHT / videoHeight;
            canvasHeight = MAX_CANVAS_HEIGHT;
            canvasWidth = videoWidth * canvasScale;
        }
        
        // Only update canvas size if it actually changed
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            // Set display size to match video
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
        }
        
        // Insert canvas into DOM if not already there
        if (!canvas.parentNode && videoPlayer.parentNode) {
            videoPlayer.parentNode.style.position = 'relative';
            videoPlayer.parentNode.insertBefore(canvas, videoPlayer.nextSibling);
        }
    }
    
    // **PERFORMANCE: Optimized CSS filter application**
    function applyCSSFilters(imageData) {
        const { data } = imageData;
        
        // **OPTIMIZATION: Skip filters that are at default values**
        const hasFilters = effects.brightness !== 100 || effects.contrast !== 100 || 
                          effects.saturation !== 100 || effects.hue !== 0 || 
                          effects.grayscale > 0 || effects.sepia > 0 || effects.invert > 0;
        
        if (!hasFilters) return imageData;
        
        // **OPTIMIZATION: Combine multiple filters in single loop**
        const brightnessFactor = effects.brightness / 100;
        const contrastFactor = effects.contrast / 100;
        const contrastOffset = 128 * (1 - contrastFactor);
        const satFactor = effects.saturation / 100;
        const grayFactor = effects.grayscale / 100;
        const sepiaFactor = effects.sepia / 100;
        const invertFactor = effects.invert / 100;
        
        // Pre-calculate hue rotation matrix if needed
        let hueMatrix = null;
        if (effects.hue !== 0) {
            const hueRotation = effects.hue * Math.PI / 180;
            const cosH = Math.cos(hueRotation);
            const sinH = Math.sin(hueRotation);
            
            hueMatrix = [
                0.213 + cosH * 0.787 - sinH * 0.213,
                0.715 - cosH * 0.715 - sinH * 0.715,
                0.072 - cosH * 0.072 + sinH * 0.928,
                0.213 - cosH * 0.213 + sinH * 0.143,
                0.715 + cosH * 0.285 + sinH * 0.140,
                0.072 - cosH * 0.072 - sinH * 0.283,
                0.213 - cosH * 0.213 - sinH * 0.787,
                0.715 - cosH * 0.715 + sinH * 0.715,
                0.072 + cosH * 0.928 + sinH * 0.072
            ];
        }
        
        // **OPTIMIZATION: Single loop for all filters**
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Brightness
            if (effects.brightness !== 100) {
                r = Math.min(255, r * brightnessFactor);
                g = Math.min(255, g * brightnessFactor);
                b = Math.min(255, b * brightnessFactor);
            }
            
            // Contrast
            if (effects.contrast !== 100) {
                r = Math.max(0, Math.min(255, r * contrastFactor + contrastOffset));
                g = Math.max(0, Math.min(255, g * contrastFactor + contrastOffset));
                b = Math.max(0, Math.min(255, b * contrastFactor + contrastOffset));
            }
            
            // Saturation
            if (effects.saturation !== 100) {
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                r = Math.max(0, Math.min(255, gray + satFactor * (r - gray)));
                g = Math.max(0, Math.min(255, gray + satFactor * (g - gray)));
                b = Math.max(0, Math.min(255, gray + satFactor * (b - gray)));
            }
            
            // Hue rotation
            if (hueMatrix) {
                const newR = r * hueMatrix[0] + g * hueMatrix[1] + b * hueMatrix[2];
                const newG = r * hueMatrix[3] + g * hueMatrix[4] + b * hueMatrix[5];
                const newB = r * hueMatrix[6] + g * hueMatrix[7] + b * hueMatrix[8];
                r = Math.max(0, Math.min(255, newR));
                g = Math.max(0, Math.min(255, newG));
                b = Math.max(0, Math.min(255, newB));
            }
            
            // Grayscale
            if (effects.grayscale > 0) {
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                r = r + grayFactor * (gray - r);
                g = g + grayFactor * (gray - g);
                b = b + grayFactor * (gray - b);
            }
            
            // Sepia
            if (effects.sepia > 0) {
                const sepiaR = (r * 0.393 + g * 0.769 + b * 0.189);
                const sepiaG = (r * 0.349 + g * 0.686 + b * 0.168);
                const sepiaB = (r * 0.272 + g * 0.534 + b * 0.131);
                
                r = Math.min(255, r + sepiaFactor * (sepiaR - r));
                g = Math.min(255, g + sepiaFactor * (sepiaG - g));
                b = Math.min(255, b + sepiaFactor * (sepiaB - b));
            }
            
            // Invert
            if (effects.invert > 0) {
                r = r + invertFactor * (255 - 2 * r);
                g = g + invertFactor * (255 - 2 * g);
                b = b + invertFactor * (255 - 2 * b);
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
        
        return imageData;
    }
    
    // **PERFORMANCE: Optimized pixel sorting with reduced complexity**
    function applyPixelSort(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const threshold = 128;
        const sortChance = Math.min(intensity / 200, 0.5); // Reduce sort frequency
        
        // **OPTIMIZATION: Process every other row for performance**
        const step = intensity > 50 ? 1 : 2;
        
        for (let y = 0; y < height; y += step) {
            if (Math.random() < sortChance) {
                const row = [];
                const rowStart = y * width * 4;
                
                for (let x = 0; x < width; x++) {
                    const idx = rowStart + x * 4;
                    const brightness = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                    row.push({
                        r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3],
                        brightness: brightness
                    });
                }
                
                let sortStart = -1;
                for (let x = 0; x <= width; x++) {
                    const brightness = x < width ? row[x].brightness : 0;
                    
                    if (brightness > threshold && sortStart === -1) {
                        sortStart = x;
                    } else if ((brightness <= threshold || x === width) && sortStart !== -1) {
                        const segment = row.slice(sortStart, x);
                        segment.sort((a, b) => a.brightness - b.brightness);
                        
                        for (let i = 0; i < segment.length; i++) {
                            row[sortStart + i] = segment[i];
                        }
                        sortStart = -1;
                    }
                }
                
                for (let x = 0; x < width; x++) {
                    const idx = rowStart + x * 4;
                    data[idx] = row[x].r;
                    data[idx + 1] = row[x].g;
                    data[idx + 2] = row[x].b;
                }
            }
        }
        
        return imageData;
    }
    
    // **PERFORMANCE: Simplified digital glitch**
    function applyDigitalGlitch(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const glitchChance = intensity / 2000; // Reduced frequency
        
        for (let y = 0; y < height; y += 3) { // Process every 3rd row
            if (Math.random() < glitchChance) {
                const shift = Math.floor((Math.random() - 0.5) * intensity * 0.3);
                const rowStart = y * width * 4;
                const tempRow = new Uint8ClampedArray(width * 4);
                
                for (let i = 0; i < width * 4; i++) {
                    tempRow[i] = data[rowStart + i];
                }
                
                for (let x = 0; x < width; x++) {
                    let srcX = x - shift;
                    if (srcX < 0) srcX += width;
                    if (srcX >= width) srcX -= width;
                    
                    const srcIdx = srcX * 4;
                    const destIdx = rowStart + x * 4;
                    
                    data[destIdx] = tempRow[srcIdx];
                    data[destIdx + 1] = tempRow[srcIdx + 1];
                    data[destIdx + 2] = tempRow[srcIdx + 2];
                }
            }
        }
        
        return imageData;
    }
    
    // Other artistic effects - simplified for performance
    function applyChromaShift(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const shift = Math.floor(intensity * 0.05); // Reduced shift amount
        const newData = new Uint8ClampedArray(data);
        
        for (let y = 0; y < height; y += 2) { // Every other row
            for (let x = 0; x < width; x += 2) { // Every other pixel
                const idx = (y * width + x) * 4;
                
                const redX = Math.min(width - 1, x + shift);
                const redIdx = (y * width + redX) * 4;
                newData[idx] = data[redIdx];
                
                const blueX = Math.max(0, x - shift);
                const blueIdx = (y * width + blueX) * 4;
                newData[idx + 2] = data[blueIdx + 2];
                
                newData[idx + 1] = data[idx + 1];
                newData[idx + 3] = data[idx + 3];
            }
        }
        
        for (let i = 0; i < data.length; i++) {
            data[i] = newData[i];
        }
        
        return imageData;
    }
    
    function applyColorQuantize(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data } = imageData;
        const levels = Math.max(2, Math.floor(256 - (intensity * 2)));
        const step = 255 / (levels - 1);
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / step) * step;
            data[i + 1] = Math.round(data[i + 1] / step) * step;
            data[i + 2] = Math.round(data[i + 2] / step) * step;
        }
        
        return imageData;
    }
    
    function applyKaleidoscope(imageData, intensity) {
        if (intensity === 0 || intensity < 10) return imageData; // Skip low intensity
        
        const { data, width, height } = imageData;
        const newData = new Uint8ClampedArray(data);
        const centerX = width / 2;
        const centerY = height / 2;
        const segments = 6;
        const angleStep = (Math.PI * 2) / segments;
        
        // **OPTIMIZATION: Lower resolution processing**
        const step = 2;
        
        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const dx = x - centerX;
                const dy = y - centerY;
                const angle = Math.atan2(dy, dx);
                const radius = Math.sqrt(dx * dx + dy * dy);
                
                let segmentAngle = ((angle % angleStep) + angleStep) % angleStep;
                const newAngle = segmentAngle * (intensity / 100) + angle * (1 - intensity / 100);
                
                const srcX = Math.round(centerX + Math.cos(newAngle) * radius);
                const srcY = Math.round(centerY + Math.sin(newAngle) * radius);
                
                if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                    const srcIdx = (srcY * width + srcX) * 4;
                    const destIdx = (y * width + x) * 4;
                    
                    newData[destIdx] = data[srcIdx];
                    newData[destIdx + 1] = data[srcIdx + 1];
                    newData[destIdx + 2] = data[srcIdx + 2];
                    newData[destIdx + 3] = data[srcIdx + 3];
                }
            }
        }
        
        for (let i = 0; i < data.length; i++) {
            data[i] = newData[i];
        }
        
        return imageData;
    }
    
    function applyNoiseOverlay(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data } = imageData;
        const noiseStrength = intensity * 1.5; // Reduced noise strength
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * noiseStrength;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        
        return imageData;
    }
    
    function processFrame() {
        if (!isProcessing || !videoPlayer || !ctx) {
            animationId = null;
            return;
        }
        
        const now = performance.now();
        
        // **PERFORMANCE: Frame rate limiting**
        if (now - lastFrameTime < FRAME_TIME_TARGET) {
            animationId = requestAnimationFrame(processFrame);
            return;
        }
        
        if (videoPlayer.paused || videoPlayer.ended || 
            videoPlayer.readyState < videoPlayer.HAVE_CURRENT_DATA) {
            animationId = requestAnimationFrame(processFrame);
            return;
        }
        
        updateCanvas();
        
        try {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Hide original video when effects are active
            if (needsProcessing()) {
                videoPlayer.style.opacity = '0';
            } else {
                videoPlayer.style.opacity = '1';
            }
            
            // Draw video frame
            ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
            
            // Get image data
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Apply effects in sequence (only if they're active)
            
            // 1. CSS Filter Effects
            imageData = applyCSSFilters(imageData);
            
            // 2. Artistic Effects (only apply if intensity > threshold)
            if (effects.pixelSort > 5) {
                imageData = applyPixelSort(imageData, effects.pixelSort);
            }
            
            if (effects.digitalGlitch > 5) {
                imageData = applyDigitalGlitch(imageData, effects.digitalGlitch);
            }
            
            if (effects.chromaShift > 5) {
                imageData = applyChromaShift(imageData, effects.chromaShift);
            }
            
            if (effects.colorQuantize > 5) {
                imageData = applyColorQuantize(imageData, effects.colorQuantize);
            }
            
            if (effects.kaleidoscope > 10) {
                imageData = applyKaleidoscope(imageData, effects.kaleidoscope);
            }
            
            if (effects.noiseOverlay > 5) {
                imageData = applyNoiseOverlay(imageData, effects.noiseOverlay);
            }
            
            // Apply blur as canvas filter if needed
            if (effects.blur > 0) {
                ctx.filter = `blur(${effects.blur}px)`;
            } else {
                ctx.filter = 'none';
            }
            
            // Put processed image back
            ctx.putImageData(imageData, 0, 0);
            
            lastFrameTime = now;
            
        } catch (error) {
            console.error('Unified effects processing error:', error);
        }
        
        animationId = requestAnimationFrame(processFrame);
    }
    
    function needsProcessing() {
        // Check if any effect is active (not at default value)
        return effects.brightness !== 100 ||
               effects.contrast !== 100 ||
               effects.saturation !== 100 ||
               effects.hue !== 0 ||
               effects.blur > 0 ||
               effects.sepia > 0 ||
               effects.grayscale > 0 ||
               effects.invert > 0 ||
               effects.pixelSort > 0 ||
               effects.digitalGlitch > 0 ||
               effects.chromaShift > 0 ||
               effects.kaleidoscope > 0 ||
               effects.colorQuantize > 0 ||
               effects.noiseOverlay > 0;
    }
    
    function startProcessing() {
        if (isProcessing) return;
        
        setupCanvas();
        isProcessing = true;
        lastFrameTime = 0;
        animationId = requestAnimationFrame(processFrame);
    }
    
    function stopProcessing() {
        isProcessing = false;
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // Show original video
        if (videoPlayer) {
            videoPlayer.style.opacity = '1';
            videoPlayer.style.filter = 'none';
        }
        
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    }
    
    function setEffect(effectId, value) {
        if (effects.hasOwnProperty(effectId)) {
            const oldValue = effects[effectId];
            effects[effectId] = value;
            
            // **REMOVED: console.log spam**
            
            // Start or stop processing based on whether any effects are active
            if (needsProcessing() && !isProcessing) {
                startProcessing();
            } else if (!needsProcessing() && isProcessing) {
                stopProcessing();
            }
        }
    }
    
    function isEffectActive(effectId) {
        if (!effects.hasOwnProperty(effectId)) return false;
        
        // Define default values for each effect
        const defaults = {
            brightness: 100, contrast: 100, saturation: 100, hue: 0,
            blur: 0, sepia: 0, grayscale: 0, invert: 0,
            pixelSort: 0, digitalGlitch: 0, chromaShift: 0,
            kaleidoscope: 0, colorQuantize: 0, noiseOverlay: 0
        };
        
        return effects[effectId] !== (defaults[effectId] || 0);
    }
    
    function resetAllEffects() {
        effects = {
            brightness: 100, contrast: 100, saturation: 100, hue: 0,
            blur: 0, sepia: 0, grayscale: 0, invert: 0,
            pixelSort: 0, digitalGlitch: 0, chromaShift: 0,
            kaleidoscope: 0, colorQuantize: 0, noiseOverlay: 0
        };
        
        if (!needsProcessing() && isProcessing) {
            stopProcessing();
        }
    }
    
    function init(playerCore) {
        videoPlayer = playerCore.getVideoElement();
        
        if (videoPlayer) {
            videoPlayer.addEventListener('play', () => {
                if (needsProcessing()) {
                    setTimeout(startProcessing, 100);
                }
            });
            
            videoPlayer.addEventListener('pause', stopProcessing);
            videoPlayer.addEventListener('ended', stopProcessing);
            
            videoPlayer.addEventListener('seeking', () => {
                if (isProcessing) {
                    isProcessing = false;
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                        animationId = null;
                    }
                }
            });
            
            videoPlayer.addEventListener('seeked', () => {
                if (needsProcessing() && !isProcessing && !videoPlayer.paused) {
                    startProcessing();
                }
            });
        }
    }
    
    return {
        init,
        setEffect,
        isEffectActive,
        resetAllEffects,
        startProcessing,
        stopProcessing,
        
        // Expose effects object for debugging
        get effects() { return { ...effects }; }
    };
})();
