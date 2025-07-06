// js/player/simple-artistic.js - Working Artistic Effects (FIXED)
const SimpleArtisticEffects = (function() {
    
    let videoPlayer;
    let canvas, ctx;
    let animationId = null;
    let isProcessing = false;
    
    // Simple effect parameters
    let effects = {
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
            ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            // FIXED: Better positioning and z-index
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
        
        // FIXED: Get the video's actual rendered size, not just bounding rect
        const rect = videoPlayer.getBoundingClientRect();
        const videoWidth = videoPlayer.videoWidth || rect.width;
        const videoHeight = videoPlayer.videoHeight || rect.height;
        
        // Limit canvas size for performance but maintain aspect ratio
        const maxWidth = 800;
        const maxHeight = 600;
        
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
        
        // Set the display size to match the video
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        // FIXED: Ensure canvas is properly inserted
        if (!canvas.parentNode && videoPlayer.parentNode) {
            videoPlayer.parentNode.style.position = 'relative'; // Ensure parent has position
            videoPlayer.parentNode.insertBefore(canvas, videoPlayer.nextSibling);
            console.log('Canvas inserted into DOM');
        }
    }
    
    // Simple pixel sorting - just on horizontal lines
    function applyPixelSort(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const threshold = 128;
        const sortChance = intensity / 100;
        
        for (let y = 0; y < height; y++) {
            if (Math.random() < sortChance) {
                const row = [];
                const rowStart = y * width * 4;
                
                // Extract row pixels
                for (let x = 0; x < width; x++) {
                    const idx = rowStart + x * 4;
                    const brightness = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                    row.push({
                        r: data[idx],
                        g: data[idx + 1], 
                        b: data[idx + 2],
                        a: data[idx + 3],
                        brightness: brightness
                    });
                }
                
                // Sort bright pixels
                let sortStart = -1;
                for (let x = 0; x <= width; x++) {
                    const brightness = x < width ? row[x].brightness : 0;
                    
                    if (brightness > threshold && sortStart === -1) {
                        sortStart = x;
                    } else if ((brightness <= threshold || x === width) && sortStart !== -1) {
                        // Sort this segment
                        const segment = row.slice(sortStart, x);
                        segment.sort((a, b) => a.brightness - b.brightness);
                        
                        // Put back
                        for (let i = 0; i < segment.length; i++) {
                            row[sortStart + i] = segment[i];
                        }
                        sortStart = -1;
                    }
                }
                
                // Write row back
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
    
    // Simple digital glitch
    function applyDigitalGlitch(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const glitchChance = intensity / 1000; // Lower chance for better performance
        
        for (let y = 0; y < height; y += 2) { // Every other line for performance
            if (Math.random() < glitchChance) {
                // Shift line horizontally
                const shift = Math.floor((Math.random() - 0.5) * intensity * 0.5);
                const rowStart = y * width * 4;
                const tempRow = new Uint8ClampedArray(width * 4);
                
                // Copy row
                for (let i = 0; i < width * 4; i++) {
                    tempRow[i] = data[rowStart + i];
                }
                
                // Shift and wrap
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
    
    // Simple chroma shift
    function applyChromaShift(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const shift = Math.floor(intensity * 0.1);
        const newData = new Uint8ClampedArray(data);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                // Shift red channel right
                const redX = Math.min(width - 1, x + shift);
                const redIdx = (y * width + redX) * 4;
                newData[idx] = data[redIdx];
                
                // Shift blue channel left  
                const blueX = Math.max(0, x - shift);
                const blueIdx = (y * width + blueX) * 4;
                newData[idx + 2] = data[blueIdx + 2];
                
                // Keep green channel normal
                newData[idx + 1] = data[idx + 1];
                newData[idx + 3] = data[idx + 3];
            }
        }
        
        // Copy back
        for (let i = 0; i < data.length; i++) {
            data[i] = newData[i];
        }
        
        return imageData;
    }
    
    // Simple color quantization
    function applyColorQuantize(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data } = imageData;
        const levels = Math.max(2, Math.floor(256 - (intensity * 2.5))); // More intensity = fewer levels
        const step = 255 / (levels - 1);
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / step) * step;         // R
            data[i + 1] = Math.round(data[i + 1] / step) * step; // G
            data[i + 2] = Math.round(data[i + 2] / step) * step; // B
        }
        
        return imageData;
    }
    
    // Simple kaleidoscope
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
                
                // Map to first segment
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
        
        // Copy back
        for (let i = 0; i < data.length; i++) {
            data[i] = newData[i];
        }
        
        return imageData;
    }
    
    // Simple noise overlay
    function applyNoiseOverlay(imageData, intensity) {
        if (intensity === 0) return imageData;
        
        const { data } = imageData;
        const noiseStrength = intensity * 2.55; // 0-255 range
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * noiseStrength;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));         // R
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G  
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
        }
        
        return imageData;
    }
    
    function processFrame() {
        if (!isProcessing || !videoPlayer || !ctx) {
            animationId = null;
            return;
        }
        
        // FIXED: Check if video is actually playing and has data
        if (videoPlayer.paused || videoPlayer.ended || 
            videoPlayer.readyState < videoPlayer.HAVE_CURRENT_DATA) {
            // Don't process if video isn't ready, but continue loop
            animationId = requestAnimationFrame(processFrame);
            return;
        }
        
        updateCanvas();
        
        try {
            // FIXED: Clear canvas first
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw current video frame
            ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
            
            // Get image data
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Apply effects in order (only active ones)
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
            
            // Put processed image back
            ctx.putImageData(imageData, 0, 0);
            
        } catch (error) {
            console.error('Artistic effect processing error:', error);
        }
        
        animationId = requestAnimationFrame(processFrame);
    }
    
    function startProcessing() {
        if (isProcessing) return;
        
        console.log('Starting artistic effects processing...');
        setupCanvas();
        isProcessing = true;
        animationId = requestAnimationFrame(processFrame);
    }
    
    function stopProcessing() {
        console.log('Stopping artistic effects processing...');
        isProcessing = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    }
    
    function setEffect(effectId, value) {
        if (effects.hasOwnProperty(effectId)) {
            const oldValue = effects[effectId];
            effects[effectId] = value;
            
            console.log(`Setting ${effectId} to ${value} (was ${oldValue})`);
            
            // Check if any effect is active
            const anyActive = Object.values(effects).some(val => val > 0);
            
            if (anyActive && !isProcessing) {
                startProcessing();
            } else if (!anyActive && isProcessing) {
                stopProcessing();
            }
        }
    }
    
    function isEffectActive(effectId) {
        return effects[effectId] > 0;
    }
    
    function init(playerCore) {
        console.log('Initializing SimpleArtisticEffects...');
        videoPlayer = playerCore.getVideoElement();
        
        // FIXED: Listen for video events directly from the video element
        if (videoPlayer) {
            videoPlayer.addEventListener('play', () => {
                console.log('Video play event - checking if effects should start');
                const anyActive = Object.values(effects).some(val => val > 0);
                if (anyActive) {
                    setTimeout(startProcessing, 100); // Small delay to ensure video is ready
                }
            });
            
            videoPlayer.addEventListener('pause', () => {
                console.log('Video pause event - stopping effects');
                stopProcessing();
            });
            
            videoPlayer.addEventListener('ended', () => {
                console.log('Video ended event - stopping effects');
                stopProcessing();
            });
            
            // Also listen for seeking events
            videoPlayer.addEventListener('seeking', () => {
                if (isProcessing) {
                    // Pause processing during seek for better performance
                    isProcessing = false;
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                        animationId = null;
                    }
                }
            });
            
            videoPlayer.addEventListener('seeked', () => {
                const anyActive = Object.values(effects).some(val => val > 0);
                if (anyActive && !isProcessing && !videoPlayer.paused) {
                    startProcessing();
                }
            });
        }
        
        console.log('SimpleArtisticEffects initialized');
    }
    
    return {
        init,
        setEffect,
        isEffectActive,
        startProcessing,
        stopProcessing
    };
})();
