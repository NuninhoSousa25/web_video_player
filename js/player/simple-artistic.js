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
