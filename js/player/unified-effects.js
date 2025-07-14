// js/player/unified-effects.js - Single Canvas Effects System
const UnifiedVideoEffects = (function() {
    
    let videoPlayer;
    let canvas, ctx;
    let animationId = null;
    let isProcessing = false;
    
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
    
    function setupCanvas() {
        if (!canvas) {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d', { 
                willReadFrequently: true,
                alpha: false // Better performance for opaque content
            });
            
            // Position canvas over video
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '5';
            canvas.style.backgroundColor = 'transparent';
            
            console.log('Unified effects canvas created');
        }
    }
    
    function updateCanvas() {
        if (!videoPlayer || !canvas) return;
        
        const rect = videoPlayer.getBoundingClientRect();
        const videoWidth = videoPlayer.videoWidth || rect.width;
        const videoHeight = videoPlayer.videoHeight || rect.height;
        
        // Limit canvas size for performance while maintaining aspect ratio
        const maxWidth = 1024;
        const maxHeight = 768;
        
        let canvasWidth = videoWidth;
        let canvasHeight = videoHeight;
        
        if (videoWidth > maxWidth) {
            canvasWidth = maxWidth;
            canvasHeight = (videoHeight * maxWidth) / videoWidth;
        }
        
        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = (videoWidth * maxHeight) / videoHeight;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Set display size to match video
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        // Insert canvas into DOM if not already there
        if (!canvas.parentNode && videoPlayer.parentNode) {
            videoPlayer.parentNode.style.position = 'relative';
            videoPlayer.parentNode.insertBefore(canvas, videoPlayer.nextSibling);
            console.log('Unified effects canvas inserted into DOM');
        }
    }
    
    // CSS Filter Effects applied via Canvas
    function applyCSSFilters(imageData) {
        const { data } = imageData;
        
        // Brightness
        if (effects.brightness !== 100) {
            const brightnessFactor = effects.brightness / 100;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] * brightnessFactor);
                data[i + 1] = Math.min(255, data[i + 1] * brightnessFactor);
                data[i + 2] = Math.min(255, data[i + 2] * brightnessFactor);
            }
        }
        
        // Contrast
        if (effects.contrast !== 100) {
            const contrastFactor = effects.contrast / 100;
            const offset = 128 * (1 - contrastFactor);
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.max(0, Math.min(255, data[i] * contrastFactor + offset));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * contrastFactor + offset));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * contrastFactor + offset));
            }
        }
        
        // Saturation
        if (effects.saturation !== 100) {
            const satFactor = effects.saturation / 100;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Convert to grayscale
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                
                // Apply saturation
                data[i] = Math.max(0, Math.min(255, gray + satFactor * (r - gray)));
                data[i + 1] = Math.max(0, Math.min(255, gray + satFactor * (g - gray)));
                data[i + 2] = Math.max(0, Math.min(255, gray + satFactor * (b - gray)));
            }
        }
        
        // Hue rotation
        if (effects.hue !== 0) {
            const hueRotation = effects.hue * Math.PI / 180;
            const cosH = Math.cos(hueRotation);
            const sinH = Math.sin(hueRotation);
            
            // Hue rotation matrix
            const matrix = [
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
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                data[i] = Math.max(0, Math.min(255, r * matrix[0] + g * matrix[1] + b * matrix[2]));
                data[i + 1] = Math.max(0, Math.min(255, r * matrix[3] + g * matrix[4] + b * matrix[5]));
                data[i + 2] = Math.max(0, Math.min(255, r * matrix[6] + g * matrix[7] + b * matrix[8]));
            }
        }
        
        // Grayscale
        if (effects.grayscale > 0) {
            const grayFactor = effects.grayscale / 100;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                
                data[i] = r + grayFactor * (gray - r);
                data[i + 1] = g + grayFactor * (gray - g);
                data[i + 2] = b + grayFactor * (gray - b);
            }
        }
        
        // Sepia
        if (effects.sepia > 0) {
            const sepiaFactor = effects.sepia / 100;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const sepiaR = (r * 0.393 + g * 0.769 + b * 0.189);
                const sepiaG = (r * 0.349 + g * 0.686 + b * 0.168);
                const sepiaB = (r * 0.272 + g * 0.534 + b * 0.131);
                
                data[i] = Math.min(255, r + sepiaFactor * (sepiaR - r));
                data[i + 1] = Math.min(255, g + sepiaFactor * (sepiaG - g));
                data[i + 2] = Math.min(255, b + sepiaFactor * (sepiaB - b));
            }
        }
        
        // Invert
        if (effects.invert > 0) {
            const invertFactor = effects.invert / 100;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = data[i] + invertFactor * (255 - 2 * data[i]);
                data[i + 1] = data[i + 1] + invertFactor * (255 - 2 * data[i + 1]);
                data[i + 2] = data[i + 2] + invertFactor * (255 - 2 * data[i + 2]);
            }
        }
        
        return imageData;
    }
    
    // Artistic Effects (from SimpleArtisticEffects)
    function applyPixelSort(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const threshold = 128;
        const sortChance = intensity / 100;
        
        for (let y = 0; y < height; y++) {
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
    
    function applyDigitalGlitch(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const glitchChance = intensity / 1000;
        
        for (let y = 0; y < height; y += 2) {
            if (Math.random() < glitchChance) {
                const shift = Math.floor((Math.random() - 0.5) * intensity * 0.5);
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
    
    function applyChromaShift(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const shift = Math.floor(intensity * 0.1);
        const newData = new Uint8ClampedArray(data);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
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
        const levels = Math.max(2, Math.floor(256 - (intensity * 2.5)));
        const step = 255 / (levels - 1);
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / step) * step;
            data[i + 1] = Math.round(data[i + 1] / step) * step;
            data[i + 2] = Math.round(data[i + 2] / step) * step;
        }
        
        return imageData;
    }
    
    function applyKaleidoscope(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const newData = new Uint8ClampedArray(data);
        const centerX = width / 2;
        const centerY = height / 2;
        const segments = 6;
        const angleStep = (Math.PI * 2) / segments;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
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
        const noiseStrength = intensity * 2.55;
        
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
            
            // Apply all effects in sequence
            
            // 1. CSS Filter Effects
            imageData = applyCSSFilters(imageData);
            
            // 2. Artistic Effects
            if (effects.pixelSort > 0) {
                imageData = applyPixelSort(imageData, effects.pixelSort);
            }
            
            if (effects.digitalGlitch > 0) {
                imageData = applyDigitalGlitch(imageData, effects.digitalGlitch);
            }
            
            if (effects.chromaShift > 0) {
                imageData = applyChromaShift(imageData, effects.chromaShift);
            }
            
            if (effects.colorQuantize > 0) {
                imageData = applyColorQuantize(imageData, effects.colorQuantize);
            }
            
            if (effects.kaleidoscope > 0) {
                imageData = applyKaleidoscope(imageData, effects.kaleidoscope);
            }
            
            if (effects.noiseOverlay > 0) {
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
        
        console.log('Starting unified effects processing...');
        setupCanvas();
        isProcessing = true;
        animationId = requestAnimationFrame(processFrame);
    }
    
    function stopProcessing() {
        console.log('Stopping unified effects processing...');
        isProcessing = false;
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // Show original video
        if (videoPlayer) {
            videoPlayer.style.opacity = '1';
            videoPlayer.style.filter = 'none'; // Clear any CSS filters
        }
        
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    }
    
    function setEffect(effectId, value) {
        if (effects.hasOwnProperty(effectId)) {
            const oldValue = effects[effectId];
            effects[effectId] = value;
            
            console.log(`Setting unified effect ${effectId} to ${value} (was ${oldValue})`);
            
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
        console.log('Initializing UnifiedVideoEffects...');
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
        
        console.log('UnifiedVideoEffects initialized');
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
