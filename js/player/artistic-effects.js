// js/player/artistic-effects.js - Procedural Digital Art Effects
const ArtisticEffects = (function() {
    
    let videoPlayer;
    let canvas, ctx;
    let noiseCanvas, noiseCtx;
    let isProcessing = false;
    let animationId = null;
    
    // Effect parameters
    let effectParams = {
        perlinNoise: { intensity: 0, scale: 100, speed: 0.01, octaves: 4 },
        pixelSort: { threshold: 128, mode: 'brightness', direction: 'horizontal', strength: 0 },
        datamosh: { intensity: 0, blockSize: 8, glitchRate: 0.1 },
        voronoi: { intensity: 0, cellCount: 50, colorMode: 'original' },
        flowField: { intensity: 0, resolution: 20, speed: 0.02 },
        chromaShift: { intensity: 0, angle: 0, distance: 10 },
        digitalGlitch: { intensity: 0, scanlines: true, pixelDrift: true },
        kaleidoscope: { intensity: 0, segments: 6, centerX: 0.5, centerY: 0.5 }
    };
    
    // Noise generation functions
    function generatePerlinNoise(width, height, scale, octaves, time) {
        const noise = new Array(width * height);
        
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                let value = 0;
                let amplitude = 1;
                let frequency = 1 / scale;
                
                for (let i = 0; i < octaves; i++) {
                    value += amplitude * noise2D(x * frequency + time, y * frequency + time);
                    amplitude *= 0.5;
                    frequency *= 2;
                }
                
                noise[y * width + x] = Math.abs(value);
            }
        }
        
        return noise;
    }
    
    // Simple 2D noise function (pseudo-Perlin)
    function noise2D(x, y) {
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
    }
    
    // Pixel sorting algorithms
    function pixelSort(imageData, threshold, mode, direction, strength) {
        if (strength === 0) return imageData;
        
        const { data, width, height } = imageData;
        const sortedData = new Uint8ClampedArray(data);
        
        if (direction === 'horizontal') {
            for (let y = 0; y < height; y++) {
                sortRowByBrightness(sortedData, width, y, threshold, strength);
            }
        } else {
            for (let x = 0; x < width; x++) {
                sortColumnByBrightness(sortedData, width, height, x, threshold, strength);
            }
        }
        
        return new ImageData(sortedData, width, height);
    }
    
    function sortRowByBrightness(data, width, row, threshold, strength) {
        const rowStart = row * width * 4;
        const pixels = [];
        
        // Extract pixels with brightness values
        for (let x = 0; x < width; x++) {
            const idx = rowStart + x * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            
            pixels.push({ r, g, b, a: data[idx + 3], brightness, originalIndex: x });
        }
        
        // Sort segments above threshold
        let sortStart = -1;
        for (let i = 0; i <= pixels.length; i++) {
            const brightness = i < pixels.length ? pixels[i].brightness : 0;
            
            if (brightness > threshold && sortStart === -1) {
                sortStart = i;
            } else if ((brightness <= threshold || i === pixels.length) && sortStart !== -1) {
                // Sort this segment
                const segment = pixels.slice(sortStart, i);
                segment.sort((a, b) => a.brightness - b.brightness);
                
                // Apply sorting strength (interpolate between original and sorted)
                for (let j = 0; j < segment.length; j++) {
                    const originalIdx = sortStart + j;
                    const sortedPixel = segment[j];
                    const originalPixel = pixels[originalIdx];
                    
                    pixels[originalIdx] = {
                        r: lerp(originalPixel.r, sortedPixel.r, strength),
                        g: lerp(originalPixel.g, sortedPixel.g, strength),
                        b: lerp(originalPixel.b, sortedPixel.b, strength),
                        a: originalPixel.a,
                        brightness: originalPixel.brightness
                    };
                }
                
                sortStart = -1;
            }
        }
        
        // Put pixels back
        for (let x = 0; x < width; x++) {
            const idx = rowStart + x * 4;
            data[idx] = pixels[x].r;
            data[idx + 1] = pixels[x].g;
            data[idx + 2] = pixels[x].b;
        }
    }
    
    function sortColumnByBrightness(data, width, height, col, threshold, strength) {
        const pixels = [];
        
        // Extract column pixels
        for (let y = 0; y < height; y++) {
            const idx = (y * width + col) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            
            pixels.push({ r, g, b, a: data[idx + 3], brightness });
        }
        
        // Sort segments (similar to row sorting)
        let sortStart = -1;
        for (let i = 0; i <= pixels.length; i++) {
            const brightness = i < pixels.length ? pixels[i].brightness : 0;
            
            if (brightness > threshold && sortStart === -1) {
                sortStart = i;
            } else if ((brightness <= threshold || i === pixels.length) && sortStart !== -1) {
                const segment = pixels.slice(sortStart, i);
                segment.sort((a, b) => a.brightness - b.brightness);
                
                for (let j = 0; j < segment.length; j++) {
                    const originalIdx = sortStart + j;
                    const sortedPixel = segment[j];
                    const originalPixel = pixels[originalIdx];
                    
                    pixels[originalIdx] = {
                        r: lerp(originalPixel.r, sortedPixel.r, strength),
                        g: lerp(originalPixel.g, sortedPixel.g, strength),
                        b: lerp(originalPixel.b, sortedPixel.b, strength),
                        a: originalPixel.a
                    };
                }
                
                sortStart = -1;
            }
        }
        
        // Put pixels back
        for (let y = 0; y < height; y++) {
            const idx = (y * width + col) * 4;
            data[idx] = pixels[y].r;
            data[idx + 1] = pixels[y].g;
            data[idx + 2] = pixels[y].b;
        }
    }
    
    // Datamoshing effect
    function applyDatamosh(imageData, intensity, blockSize, glitchRate) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const newData = new Uint8ClampedArray(data);
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                if (Math.random() < glitchRate * intensity) {
                    // Randomly shift blocks
                    const offsetX = Math.floor((Math.random() - 0.5) * blockSize * intensity);
                    const offsetY = Math.floor((Math.random() - 0.5) * blockSize * intensity);
                    
                    copyBlock(data, newData, width, height, x, y, x + offsetX, y + offsetY, blockSize);
                }
            }
        }
        
        return new ImageData(newData, width, height);
    }
    
    function copyBlock(srcData, destData, width, height, srcX, srcY, destX, destY, blockSize) {
        for (let dy = 0; dy < blockSize; dy++) {
            for (let dx = 0; dx < blockSize; dx++) {
                const sx = Math.max(0, Math.min(width - 1, srcX + dx));
                const sy = Math.max(0, Math.min(height - 1, srcY + dy));
                const dx2 = Math.max(0, Math.min(width - 1, destX + dx));
                const dy2 = Math.max(0, Math.min(height - 1, destY + dy));
                
                const srcIdx = (sy * width + sx) * 4;
                const destIdx = (dy2 * width + dx2) * 4;
                
                destData[destIdx] = srcData[srcIdx];
                destData[destIdx + 1] = srcData[srcIdx + 1];
                destData[destIdx + 2] = srcData[srcIdx + 2];
                destData[destIdx + 3] = srcData[srcIdx + 3];
            }
        }
    }
    
    // Digital glitch effect
    function applyDigitalGlitch(imageData, intensity, scanlines, pixelDrift) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const newData = new Uint8ClampedArray(data);
        
        // Scanline interference
        if (scanlines) {
            for (let y = 0; y < height; y++) {
                if (Math.random() < intensity * 0.1) {
                    const lineIntensity = Math.random() * intensity;
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        newData[idx] = Math.min(255, newData[idx] + lineIntensity * 50);
                        newData[idx + 1] = Math.max(0, newData[idx + 1] - lineIntensity * 25);
                    }
                }
            }
        }
        
        // Pixel drift
        if (pixelDrift) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (Math.random() < intensity * 0.05) {
                        const driftX = Math.floor((Math.random() - 0.5) * intensity * 10);
                        const driftY = Math.floor((Math.random() - 0.5) * intensity * 5);
                        
                        const srcX = Math.max(0, Math.min(width - 1, x + driftX));
                        const srcY = Math.max(0, Math.min(height - 1, y + driftY));
                        
                        const srcIdx = (srcY * width + srcX) * 4;
                        const destIdx = (y * width + x) * 4;
                        
                        newData[destIdx] = data[srcIdx];
                        newData[destIdx + 1] = data[srcIdx + 1];
                        newData[destIdx + 2] = data[srcIdx + 2];
                    }
                }
            }
        }
        
        return new ImageData(newData, width, height);
    }
    
    // Kaleidoscope effect
    function applyKaleidoscope(imageData, intensity, segments, centerX, centerY) {
        if (intensity === 0) return imageData;
        
        const { data, width, height } = imageData;
        const newData = new Uint8ClampedArray(data);
        
        const cx = width * centerX;
        const cy = height * centerY;
        const angleStep = (Math.PI * 2) / segments;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const angle = Math.atan2(dy, dx);
                const radius = Math.sqrt(dx * dx + dy * dy);
                
                // Map to first segment
                const segmentAngle = ((angle % angleStep) + angleStep) % angleStep;
                const newAngle = segmentAngle * intensity + angle * (1 - intensity);
                
                const srcX = Math.round(cx + Math.cos(newAngle) * radius);
                const srcY = Math.round(cy + Math.sin(newAngle) * radius);
                
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
        
        return new ImageData(newData, width, height);
    }
    
    // Utility functions
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    function setupCanvas() {
        if (!canvas) {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            noiseCanvas = document.createElement('canvas');
            noiseCtx = noiseCanvas.getContext('2d');
            
            // Position canvas over video
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '1';
        }
    }
    
    function updateCanvas() {
        if (!videoPlayer || !canvas) return;
        
        const rect = videoPlayer.getBoundingClientRect();
        canvas.width = videoPlayer.videoWidth || rect.width;
        canvas.height = videoPlayer.videoHeight || rect.height;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        // Insert canvas after video element
        if (!canvas.parentNode) {
            videoPlayer.parentNode.insertBefore(canvas, videoPlayer.nextSibling);
        }
    }
    
    function processFrame(timestamp) {
        if (!isProcessing || !videoPlayer || !ctx) {
            animationId = null;
            return;
        }
        
        updateCanvas();
        
        // Draw current video frame
        ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply effects in order
        if (effectParams.pixelSort.strength > 0) {
            imageData = pixelSort(
                imageData,
                effectParams.pixelSort.threshold,
                effectParams.pixelSort.mode,
                effectParams.pixelSort.direction,
                effectParams.pixelSort.strength
            );
        }
        
        if (effectParams.datamosh.intensity > 0) {
            imageData = applyDatamosh(
                imageData,
                effectParams.datamosh.intensity,
                effectParams.datamosh.blockSize,
                effectParams.datamosh.glitchRate
            );
        }
        
        if (effectParams.digitalGlitch.intensity > 0) {
            imageData = applyDigitalGlitch(
                imageData,
                effectParams.digitalGlitch.intensity,
                effectParams.digitalGlitch.scanlines,
                effectParams.digitalGlitch.pixelDrift
            );
        }
        
        if (effectParams.kaleidoscope.intensity > 0) {
            imageData = applyKaleidoscope(
                imageData,
                effectParams.kaleidoscope.intensity,
                effectParams.kaleidoscope.segments,
                effectParams.kaleidoscope.centerX,
                effectParams.kaleidoscope.centerY
            );
        }
        
        // Put processed image back
        ctx.putImageData(imageData, 0, 0);
        
        animationId = requestAnimationFrame(processFrame);
    }
    
    function startProcessing() {
        if (isProcessing) return;
        
        setupCanvas();
        isProcessing = true;
        animationId = requestAnimationFrame(processFrame);
    }
    
    function stopProcessing() {
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
        let needsProcessing = false;
        
        switch (effectId) {
            case 'pixelSort':
                effectParams.pixelSort.strength = value / 100;
                needsProcessing = value > 0;
                break;
                
            case 'pixelSortThreshold':
                effectParams.pixelSort.threshold = value;
                break;
                
            case 'datamosh':
                effectParams.datamosh.intensity = value / 100;
                needsProcessing = value > 0;
                break;
                
            case 'digitalGlitch':
                effectParams.digitalGlitch.intensity = value / 100;
                needsProcessing = value > 0;
                break;
                
            case 'kaleidoscope':
                effectParams.kaleidoscope.intensity = value / 100;
                needsProcessing = value > 0;
                break;
                
            case 'kaleidoscopeSegments':
                effectParams.kaleidoscope.segments = Math.max(3, Math.floor(value));
                break;
        }
        
        // Check if any effect is active
        const anyEffectActive = Object.values(effectParams).some(effect => 
            effect.intensity > 0 || effect.strength > 0
        );
        
        if (anyEffectActive && !isProcessing) {
            startProcessing();
        } else if (!anyEffectActive && isProcessing) {
            stopProcessing();
        }
    }
    
    function init(playerCore) {
        videoPlayer = playerCore.getVideoElement();
        
        // Listen for video events
        document.addEventListener('video:play', startProcessing);
        document.addEventListener('video:pause', stopProcessing);
        document.addEventListener('video:ended', stopProcessing);
    }
    
    return {
        init,
        setEffect,
        startProcessing,
        stopProcessing
    };
})();
