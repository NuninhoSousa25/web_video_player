// js/player/advanced-artistic.js - Advanced Procedural Effects
const AdvancedArtisticEffects = (function() {
    
    let videoPlayer;
    let canvas, ctx;
    let isProcessing = false;
    let animationId = null;
    let time = 0;
    
    // WebGL context for advanced effects
    let gl, program, vertexBuffer, textureBuffer;
    let useWebGL = false;
    
    // Effect parameters with more sophisticated controls
    let effectParams = {
        // Enhanced Pixel Sorting
        pixelSort: {
            intensity: 0,
            threshold: 128,
            direction: 'horizontal',
            mode: 'brightness', // brightness, hue, saturation, red, green, blue
            bandHeight: 1, // for horizontal sorting
            reverse: false,
            intervalFunction: 'threshold' // threshold, random, edges
        },
        
        // Advanced Flow Field
        flowField: {
            intensity: 0,
            resolution: 20,
            speed: 0.02,
            turbulence: 1.0,
            curl: 0.5,
            layers: 3,
            colorMode: 'displacement' // displacement, velocity, divergence
        },
        
        // Procedural Distortions
        distortions: {
            perlinWarp: 0,
            voronoiShatter: 0,
            liquidDistort: 0,
            crystallize: 0,
            fishEye: 0,
            barrelDistort: 0
        },
        
        // Color Space Manipulations
        colorSpace: {
            chromaShift: 0,
            colorQuantize: 0,
            ditherStrength: 0,
            posterize: 0,
            solarize: 0,
            crossProcess: 0
        },
        
        // Generative Overlays
        generative: {
            perlinNoise: 0,
            worleyNoise: 0,
            fbmNoise: 0,
            ridgedNoise: 0,
            electricField: 0
        }
    };
    
    // Noise functions for procedural generation
    const NoiseGenerator = {
        // Improved Perlin noise implementation
        perlin2D: function(x, y, scale = 1, octaves = 4, persistence = 0.5) {
            let value = 0;
            let amplitude = 1;
            let frequency = scale;
            let maxValue = 0;
            
            for (let i = 0; i < octaves; i++) {
                value += this.noise2D(x * frequency, y * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= 2;
            }
            
            return value / maxValue;
        },
        
        // Basic noise function
        noise2D: function(x, y) {
            const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            return (n - Math.floor(n)) * 2 - 1;
        },
        
        // Worley/Cellular noise
        worley2D: function(x, y, cellCount = 16) {
            const cellSize = 1.0 / cellCount;
            const cellX = Math.floor(x / cellSize);
            const cellY = Math.floor(y / cellSize);
            
            let minDist = Infinity;
            
            // Check surrounding cells
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const neighborX = cellX + i;
                    const neighborY = cellY + j;
                    
                    // Generate point in cell
                    const pointX = (neighborX + this.random2D(neighborX, neighborY)) * cellSize;
                    const pointY = (neighborY + this.random2D(neighborY, neighborX)) * cellSize;
                    
                    const dist = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
                    minDist = Math.min(minDist, dist);
                }
            }
            
            return Math.min(1, minDist * cellCount);
        },
        
        // Fractal Brownian Motion
        fbm: function(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
            let value = 0;
            let amplitude = 1;
            let frequency = 1;
            
            for (let i = 0; i < octaves; i++) {
                value += amplitude * this.noise2D(x * frequency, y * frequency);
                frequency *= lacunarity;
                amplitude *= gain;
            }
            
            return value;
        },
        
        // Ridge noise (inverted fbm with abs)
        ridge: function(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
            let value = 0;
            let amplitude = 1;
            let frequency = 1;
            
            for (let i = 0; i < octaves; i++) {
                const n = Math.abs(this.noise2D(x * frequency, y * frequency));
                value += amplitude * (1 - n);
                frequency *= lacunarity;
                amplitude *= gain;
            }
            
            return value;
        },
        
        random2D: function(x, y) {
            const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            return n - Math.floor(n);
        }
    };
    
    // Advanced pixel sorting algorithms
    const PixelSorter = {
        sortByBrightness: function(imageData, threshold, direction, bandHeight, reverse) {
            const { data, width, height } = imageData;
            const newData = new Uint8ClampedArray(data);
            
            if (direction === 'horizontal') {
                for (let y = 0; y < height; y += bandHeight) {
                    for (let band = 0; band < bandHeight && y + band < height; band++) {
                        this.sortRowByBrightness(newData, width, y + band, threshold, reverse);
                    }
                }
            } else {
                for (let x = 0; x < width; x++) {
                    this.sortColumnByBrightness(newData, width, height, x, threshold, reverse);
                }
            }
            
            return new ImageData(newData, width, height);
        },
        
        sortByHue: function(imageData, threshold, direction, reverse) {
            const { data, width, height } = imageData;
            const newData = new Uint8ClampedArray(data);
            
            if (direction === 'horizontal') {
                for (let y = 0; y < height; y++) {
                    this.sortRowByHue(newData, width, y, threshold, reverse);
                }
            }
            
            return new ImageData(newData, width, height);
        },
        
        sortRowByBrightness: function(data, width, row, threshold, reverse) {
            const rowStart = row * width * 4;
            const pixels = [];
            
            for (let x = 0; x < width; x++) {
                const idx = rowStart + x * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                
                pixels.push({ r, g, b, a: data[idx + 3], brightness });
            }
            
            // Find sorting intervals
            const intervals = this.findSortingIntervals(pixels, threshold, 'brightness');
            
            // Sort each interval
            intervals.forEach(interval => {
                const segment = pixels.slice(interval.start, interval.end);
                segment.sort((a, b) => reverse ? b.brightness - a.brightness : a.brightness - b.brightness);
                
                // Put sorted pixels back
                for (let i = 0; i < segment.length; i++) {
                    pixels[interval.start + i] = segment[i];
                }
            });
            
            // Write back to data
            for (let x = 0; x < width; x++) {
                const idx = rowStart + x * 4;
                data[idx] = pixels[x].r;
                data[idx + 1] = pixels[x].g;
                data[idx + 2] = pixels[x].b;
            }
        },
        
        sortRowByHue: function(data, width, row, threshold, reverse) {
            const rowStart = row * width * 4;
            const pixels = [];
            
            for (let x = 0; x < width; x++) {
                const idx = rowStart + x * 4;
                const r = data[idx] / 255;
                const g = data[idx + 1] / 255;
                const b = data[idx + 2] / 255;
                
                const hsl = this.rgbToHsl(r, g, b);
                
                pixels.push({ 
                    r: data[idx], 
                    g: data[idx + 1], 
                    b: data[idx + 2], 
                    a: data[idx + 3], 
                    hue: hsl[0],
                    saturation: hsl[1]
                });
            }
            
            // Find intervals based on saturation
            const intervals = this.findSortingIntervals(pixels, threshold, 'saturation');
            
            intervals.forEach(interval => {
                const segment = pixels.slice(interval.start, interval.end);
                segment.sort((a, b) => reverse ? b.hue - a.hue : a.hue - b.hue);
                
                for (let i = 0; i < segment.length; i++) {
                    pixels[interval.start + i] = segment[i];
                }
            });
            
            // Write back
            for (let x = 0; x < width; x++) {
                const idx = rowStart + x * 4;
                data[idx] = pixels[x].r;
                data[idx + 1] = pixels[x].g;
                data[idx + 2] = pixels[x].b;
            }
        },
        
        findSortingIntervals: function(pixels, threshold, property) {
            const intervals = [];
            let start = -1;
            
            for (let i = 0; i <= pixels.length; i++) {
                const value = i < pixels.length ? pixels[i][property] : 0;
                
                if (value > threshold && start === -1) {
                    start = i;
                } else if ((value <= threshold || i === pixels.length) && start !== -1) {
                    if (i - start > 1) { // Only sort if interval has more than 1 pixel
                        intervals.push({ start, end: i });
                    }
                    start = -1;
                }
            }
            
            return intervals;
        },
        
        rgbToHsl: function(r, g, b) {
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;
            
            if (max === min) {
                h = s = 0;
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            
            return [h * 360, s * 100, l * 100];
        }
    };
    
    // Flow field generator
    const FlowField = {
        generate: function(width, height, resolution, time, turbulence, curl) {
            const field = [];
            const step = resolution;
            
            for (let x = 0; x < width; x += step) {
                for (let y = 0; y < height; y += step) {
                    // Multi-octave noise for complex flow
                    const noiseX = NoiseGenerator.fbm(x * 0.01, y * 0.01 + time, 4) * turbulence;
                    const noiseY = NoiseGenerator.fbm(x * 0.01 + 100, y * 0.01 + time, 4) * turbulence;
                    
                    // Add curl for more organic flow
                    const curlX = NoiseGenerator.noise2D(x * 0.005, y * 0.005 + time * 0.5) * curl;
                    const curlY = NoiseGenerator.noise2D(x * 0.005 + 50, y * 0.005 + time * 0.5) * curl;
                    
                    const angle = Math.atan2(noiseY + curlY, noiseX + curlX);
                    const magnitude = Math.sqrt((noiseX + curlX) ** 2 + (noiseY + curlY) ** 2);
                    
                    field.push({
                        x: x,
                        y: y,
                        angle: angle,
                        magnitude: Math.min(magnitude, step),
                        vx: Math.cos(angle) * magnitude,
                        vy: Math.sin(angle) * magnitude
                    });
                }
            }
            
            return field;
        },
        
        applyToImage: function(imageData, flowField, intensity) {
            if (intensity === 0) return imageData;
            
            const { data, width, height } = imageData;
            const newData = new Uint8ClampedArray(data);
            
            // Create lookup for nearest flow vectors
            const flowLookup = new Map();
            flowField.forEach(flow => {
                const key = `${Math.floor(flow.x)},${Math.floor(flow.y)}`;
                flowLookup.set(key, flow);
            });
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    // Find nearest flow vector
                    const flowKey = `${Math.floor(x / 20) * 20},${Math.floor(y / 20) * 20}`;
                    const flow = flowLookup.get(flowKey);
                    
                    if (flow) {
                        const offsetX = flow.vx * intensity * 0.1;
                        const offsetY = flow.vy * intensity * 0.1;
                        
                        const srcX = Math.round(x + offsetX);
                        const srcY = Math.round(y + offsetY);
                        
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
            }
            
            return new ImageData(newData, width, height);
        }
    };
    
    // Advanced color manipulations
    const ColorProcessor = {
        quantizeColors: function(imageData, levels) {
            if (levels >= 256) return imageData;
            
            const { data } = imageData;
            const step = 255 / (levels - 1);
            
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.round(data[i] / step) * step;         // R
                data[i + 1] = Math.round(data[i + 1] / step) * step; // G
                data[i + 2] = Math.round(data[i + 2] / step) * step; // B
            }
            
            return imageData;
        },
        
        ditherImage: function(imageData, strength) {
            if (strength === 0) return imageData;
            
            const { data, width, height } = imageData;
            
            // Floyd-Steinberg dithering
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    
                    ['r', 'g', 'b'].forEach((channel, c) => {
                        const oldValue = data[idx + c];
                        const newValue = oldValue < 128 ? 0 : 255;
                        const error = oldValue - newValue;
                        
                        data[idx + c] = newValue;
                        
                        // Distribute error to neighboring pixels
                        if (x + 1 < width) {
                            data[idx + 4 + c] += error * 7/16 * strength;
                        }
                        if (y + 1 < height) {
                            if (x > 0) {
                                data[((y + 1) * width + (x - 1)) * 4 + c] += error * 3/16 * strength;
                            }
                            data[((y + 1) * width + x) * 4 + c] += error * 5/16 * strength;
                            if (x + 1 < width) {
                                data[((y + 1) * width + (x + 1)) * 4 + c] += error * 1/16 * strength;
                            }
                        }
                    });
                }
            }
            
            return imageData;
        },
        
        solarize: function(imageData, threshold) {
            const { data } = imageData;
            
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > threshold) data[i] = 255 - data[i];
                if (data[i + 1] > threshold) data[i + 1] = 255 - data[i + 1];
                if (data[i + 2] > threshold) data[i + 2] = 255 - data[i + 2];
            }
            
            return imageData;
        }
    };
    
    // Main processing function
    function processFrame(timestamp) {
        if (!isProcessing || !videoPlayer || !ctx) {
            animationId = null;
            return;
        }
        
        time = timestamp * 0.001; // Convert to seconds
        
        // Update canvas size if needed
        updateCanvas();
        
        // Draw current video frame
        ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply artistic effects in order
        imageData = applyAllEffects(imageData, timestamp);
        
        // Put processed image back
        ctx.putImageData(imageData, 0, 0);
        
        animationId = requestAnimationFrame(processFrame);
    }
    
    function applyAllEffects(imageData, timestamp) {
        // Pixel sorting
        if (effectParams.pixelSort.intensity > 0) {
            switch (effectParams.pixelSort.mode) {
                case 'brightness':
                    imageData = PixelSorter.sortByBrightness(
                        imageData,
                        effectParams.pixelSort.threshold,
                        effectParams.pixelSort.direction,
                        effectParams.pixelSort.bandHeight,
                        effectParams.pixelSort.reverse
                    );
                    break;
                case 'hue':
                    imageData = PixelSorter.sortByHue(
                        imageData,
                        effectParams.pixelSort.threshold,
                        effectParams.pixelSort.direction,
                        effectParams.pixelSort.reverse
                    );
                    break;
            }
        }
        
        // Flow field distortion
        if (effectParams.flowField.intensity > 0) {
            const flowField = FlowField.generate(
                canvas.width,
                canvas.height,
                effectParams.flowField.resolution,
                time * effectParams.flowField.speed,
                effectParams.flowField.turbulence,
                effectParams.flowField.curl
            );
            
            imageData = FlowField.applyToImage(imageData, flowField, effectParams.flowField.intensity);
        }
        
        // Color processing
        if (effectParams.colorSpace.colorQuantize > 0) {
            const levels = Math.floor(2 + (254 * (1 - effectParams.colorSpace.colorQuantize / 100)));
            imageData = ColorProcessor.quantizeColors(imageData, levels);
        }
        
        if (effectParams.colorSpace.ditherStrength > 0) {
            imageData = ColorProcessor.ditherImage(imageData, effectParams.colorSpace.ditherStrength / 100);
        }
        
        if (effectParams.colorSpace.solarize > 0) {
            const threshold = 128 + (effectParams.colorSpace.solarize / 100) * 127;
            imageData = ColorProcessor.solarize(imageData, threshold);
        }
        
        return imageData;
    }
    
    function setupCanvas() {
        if (!canvas) {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '2';
        }
    }
    
    function updateCanvas() {
        if (!videoPlayer || !canvas) return;
        
        const rect = videoPlayer.getBoundingClientRect();
        canvas.width = videoPlayer.videoWidth || rect.width;
        canvas.height = videoPlayer.videoHeight || rect.height;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        if (!canvas.parentNode) {
            videoPlayer.parentNode.insertBefore(canvas, videoPlayer.nextSibling);
        }
    }
    
    function setEffect(effectId, value) {
        let needsProcessing = false;
        
        // Map effect IDs to internal parameters
        switch (effectId) {
            case 'pixelSort':
                effectParams.pixelSort.intensity = value / 100;
                needsProcessing = value > 0;
                break;
                
            case 'pixelSortThreshold':
                effectParams.pixelSort.threshold = value;
                break;
                
            case 'flowField':
                effectParams.flowField.intensity = value;
                needsProcessing = value > 0;
                break;
                
            case 'colorQuantize':
                effectParams.colorSpace.colorQuantize = value;
                needsProcessing = value > 0;
                break;
                
            case 'ditherStrength':
                effectParams.colorSpace.ditherStrength = value;
                needsProcessing = value > 0;
                break;
                
            case 'solarize':
                effectParams.colorSpace.solarize = value;
                needsProcessing = value > 0;
                break;
        }
        
        // Check if any effect is active
        const anyEffectActive = 
            effectParams.pixelSort.intensity > 0 ||
            effectParams.flowField.intensity > 0 ||
            effectParams.colorSpace.colorQuantize > 0 ||
            effectParams.colorSpace.ditherStrength > 0 ||
            effectParams.colorSpace.solarize > 0;
        
        if (anyEffectActive && !isProcessing) {
            startProcessing();
        } else if (!anyEffectActive && isProcessing) {
            stopProcessing();
        }
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
        stopProcessing,
        
        // Expose processors
