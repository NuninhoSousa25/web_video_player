
// js/utils.js
const Utils = (function() {
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    function handlePlayError(e) {
        console.error("Video play error:", e);
    }

    function loadPlayerSettings(videoPlayer, volumeSlider) { 
        const savedVolume = localStorage.getItem('videoPlayerVolume');
        if (savedVolume && volumeSlider) { 
            videoPlayer.volume = parseFloat(savedVolume); 
            volumeSlider.value = parseFloat(savedVolume); 
        }
        // Removed loading of brightness, saturation, contrast, hue from localStorage
    }

    // Removed saveVideoPlayerSettings as filter sliders are removed.
    // Removed applySmoothing as it's now internal to Sensors module.

    return {
        formatTime,
        handlePlayError,
        loadPlayerSettings,
    };
})();
--- START OF FILE styles.css ---

 * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: #121212; color: #f0f0f0;
            min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 10px;
        }
        .container {
            width: 100%; max-width: 500px; margin: 0 auto;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3); border-radius: 8px;
            overflow: hidden; background-color: #1e1e1e;
        }
        .player-header { padding: 12px 16px; background-color: #2d2d2d; text-align: center; }
        .player-header h1 { font-size: 18px; font-weight: 600; }

        .mode-switcher { display: flex; background-color: #2d2d2d; border-bottom: 1px solid #333;}
        .mode-switcher button {
            flex: 1; padding: 12px; background-color: #2d2d2d; color: #aaa;
            border: none; border-bottom: 3px solid transparent; font-size: 14px; cursor: pointer;
        }
        .mode-switcher button.active { color: #2c7be5; border-bottom-color: #2c7be5; font-weight: bold; }
        .mode-switcher button:hover:not(.active) { background-color: #383838; }

        .video-container { position: relative; width: 100%; background-color: #000; }
        video { width: 100%; display: block; }
        
        .video-container.fullscreen, .point-cloud-container.fullscreen {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            z-index: 9999; background-color: #000;
            display: flex; align-items: center; justify-content: center;
        }
        .video-container.fullscreen video, .point-cloud-container.fullscreen #pointCloudCanvas {
            max-width: 100%; max-height: 100%; width: auto !important; height: auto !important; object-fit: contain;
        }
        .controls-overlay { 
            position: absolute; bottom: 0; left: 0; right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.7));
            padding: 20px 10px 10px; opacity: 0; transition: opacity 0.3s ease; z-index: 10000;
        }
        .video-container.fullscreen .controls-overlay { /* Controls only show on hover/active in fullscreen */
             pointer-events: none; /* Don't capture mouse events unless active */
        }
        .video-container.fullscreen .controls-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }
        .video-container.fullscreen:hover .controls-overlay { /* Show on hover */
             opacity: 1;
             pointer-events: auto;
        }
        
        .controls, .point-cloud-params-container {
            padding: 12px 16px; display: flex; flex-direction: column; gap: 12px;
        }
        .point-cloud-params-container { background-color: #2a2a2a; border-top: 1px solid #333; }
        .main-controls { display: flex; justify-content: space-between; align-items: center; }
        
        .file-controls {
            display: flex; flex-direction: column; gap: 8px; padding: 16px; background-color: #1e1e1e;
        }
        button { 
            background-color: #2c7be5; color: white; border: none; border-radius: 4px;
            padding: 10px 15px; font-size: 14px; cursor: pointer; transition: background-color 0.2s;
        }
        button:hover { background-color: #1a68d1; }
        button:disabled { background-color: #555; cursor: not-allowed; }
        .toggle-button { min-width: 100px; }
        input[type="file"] { display: none; }
        .file-label {
            display: inline-block; background-color: #4caf50; color: white; border-radius: 4px;
            padding: 10px 15px; font-size: 14px; cursor: pointer; transition: background-color 0.2s;
            text-align: center;
        }
        .file-label:hover { background-color: #3e8e41; }
        .file-name { padding: 5px; color: #aaa; font-size: 14px; text-align: center; word-break: break-all; }
        
        .progress-container {
            width: 100%; height: 5px; background-color: #333; border-radius: 5px;
            overflow: hidden; margin-top: 8px; cursor: pointer;
        }
        .progress-bar { height: 100%; background-color: #2c7be5; width: 0; transition: width 0.1s; }
        .time-display { display: flex; justify-content: space-between; font-size: 12px; color: #aaa; margin-top: 5px; }
        
        .volume-container { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
        .volume-icon { color: #aaa; width: 20px; text-align: center; }
        .volume-slider {
            flex: 1; -webkit-appearance: none; height: 5px; border-radius: 5px; background: #333; outline: none;
        }
        .volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none; width: 15px; height: 15px;
            border-radius: 50%; background: #2c7be5; cursor: pointer;
        }
        .volume-slider::-moz-range-thumb { 
            width: 15px; height: 15px; border-radius: 50%; background: #2c7be5; cursor: pointer; border: none;
        }
        .placeholder-message { padding: 30px; text-align: center; color: #888; }
        
        .filter-control { margin-bottom: 12px; }
        .filter-control:last-child { margin-bottom: 0; }
        .filter-label { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; color: #ddd; }
        .filter-value { color: #2c7be5; font-weight: 500; }
        .filter-slider {
            width: 100%; -webkit-appearance: none; height: 5px; border-radius: 5px; background: #333; outline: none;
        }
        #pcProcessingResolutionSlider.filter-slider { /* Style for the select element */
            -webkit-appearance: menulist-button; /* Or auto, or none depending on desired look */
            appearance: menulist-button;       /* Or auto */
            background-color: #3a3a3a;
            color: #f0f0f0;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 8px 10px !important; /* Override general filter-slider height if needed */
            height: auto !important;
        }

        .filter-slider::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none; width: 15px; height: 15px;
            border-radius: 50%; background: #2c7be5; cursor: pointer;
        }
         .filter-slider::-moz-range-thumb { 
            width: 15px; height: 15px; border-radius: 50%; background: #2c7be5; cursor: pointer; border: none;
        }
        
        .sensor-section {
            background-color: #1e1e1e; 
            padding: 15px;
            border-top: 1px solid #333;
        }
        .sensor-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .sensor-title { font-size: 16px; font-weight: 600; }
        .sensor-toggle {
            background-color: #2c7be5; color: white; border: none; border-radius: 4px;
            padding: 6px 12px; font-size: 14px; cursor: pointer;
        }
        .sensor-toggle.active { background-color: #4caf50; }
        .mapping-info { font-size: 13px; color: #aaa; margin: 10px 0; text-align: center; line-height: 1.4; min-height: 1em; }
        .mapping-highlight { color: #2c7be5; font-weight: 500; }
        
        .point-cloud-container { width:100%; }
        #pointCloudCanvas {
            width: 100%; background-color: #050505;
            border: 1px solid #333; display: block; 
            cursor: pointer; 
        }

        .mapping-panel-toggle-container button.button { 
            width: auto; 
            padding: 8px 15px; 
        }

        .sensor-mapping-panel {
            position: fixed; 
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 550px; 
            max-height: 85vh; 
            background-color: #262626; 
            color: #f0f0f0;
            border-radius: 10px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.6); 
            z-index: 10001; 
            display: flex;
            flex-direction: column;
            border: 1px solid #444; 
        }

        .sensor-mapping-panel.hidden {
            display: none !important; 
        }

        .sensor-mapping-panel .panel-header {
            padding: 10px 15px; 
            background-color: #333; 
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #444;
            border-radius: 10px 10px 0 0; 
        }
        .sensor-mapping-panel .panel-header h2 {
            font-size: 16px; 
            margin: 0; 
            font-weight: 600;
        }
        .sensor-mapping-panel .close-button {
            background: none; border: none; color: #bbb; font-size: 22px; 
            cursor: pointer; padding: 0; line-height: 1;
        }
        .sensor-mapping-panel .close-button:hover { color: #fff; }

        .sensor-mapping-panel .panel-content {
            padding: 15px;
            overflow-y: auto;
            flex-grow: 1;
        }

        .sensor-mapping-panel .mappings-list-container h3,
        .sensor-mapping-panel .edit-form-container h3 {
            font-size: 15px; 
            color: #0095ff; 
            margin-bottom: 12px;
            border-bottom: 1px solid #444;
            padding-bottom: 8px;
        }

        .sensor-mapping-panel .mappings-list {
            list-style: none;
            padding: 0;
            margin: 0 0 15px 0;
        }
        .sensor-mapping-panel .mappings-list li {
            background-color: #303030; 
            padding: 10px 12px; 
            border-radius: 6px; 
            margin-bottom: 10px;
            border: 1px solid #484848; 
            transition: background-color 0.2s;
        }
         .sensor-mapping-panel .mappings-list li:hover {
            background-color: #383838;
        }

        .sensor-mapping-panel .mappings-list li.disabled {
            opacity: 0.6;
            border-left: 3px solid #666;
        }
         .sensor-mapping-panel .mappings-list li.enabled {
            border-left: 3px solid #0095ff;
        }

        .sensor-mapping-panel .mappings-list li .mapping-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px; 
        }
        .sensor-mapping-panel .mappings-list li .mapping-name {
            font-weight: 500;
            font-size: 14px; 
        }
        .sensor-mapping-panel .mappings-list li .mapping-details {
            font-size: 0.8em; 
            color: #bbb; 
        }
        .sensor-mapping-panel .mappings-list li .mapping-actions button {
            font-size: 0.75em; 
            padding: 3px 7px; 
            margin-left: 6px;
            background-color: #4a4a4a; 
            border-radius: 3px;
        }
        .sensor-mapping-panel .mappings-list li .mapping-actions button:hover {
            background-color: #555;
        }
        .sensor-mapping-panel .mappings-list li .mapping-actions .delete-btn {
            background-color: #b73e3e; 
        }
        .sensor-mapping-panel .mappings-list li .mapping-actions .delete-btn:hover {
            background-color: #c94a4a;
        }
        .sensor-mapping-panel .add-new-button.button { 
            width: 100%; 
            margin-top: 10px; 
            padding: 10px; 
            font-size: 14px;
        }

        .sensor-mapping-panel .edit-form-container {
            background-color: #2f2f2f; 
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #444;
        }
        .sensor-mapping-panel .edit-form-container div {
            margin-bottom: 10px; 
        }
        .sensor-mapping-panel .edit-form-container label {
            display: block;
            font-size: 13px; 
            margin-bottom: 5px; 
            color: #ddd; 
        }
        .sensor-mapping-panel .edit-form-container select,
        .sensor-mapping-panel .edit-form-container input[type="number"],
        .sensor-mapping-panel .edit-form-container input[type="range"] {
            width: 100%;
            padding: 8px 10px; 
            background-color: #3a3a3a; 
            border: 1px solid #555; 
            color: #f0f0f0;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 13px;
        }
        .sensor-mapping-panel .edit-form-container input[type="checkbox"] {
            width: auto;
            margin-right: 8px; 
            vertical-align: middle;
        }
        .sensor-mapping-panel .description-text {
            font-size: 0.75em; 
            color: #999; 
            margin-top: 4px; 
        }
        .sensor-mapping-panel .range-inputs {
            display: flex;
            gap: 12px; 
        }
        .sensor-mapping-panel .range-inputs > div {
            flex: 1;
        }
        .sensor-mapping-panel .form-actions {
            margin-top: 15px; 
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .sensor-mapping-panel .form-actions .button { width: auto; font-size: 13px; padding: 8px 15px;}
        .sensor-mapping-panel .form-actions .secondary-button { background-color: #555; }
        .sensor-mapping-panel .form-actions .secondary-button:hover { background-color: #666; }
        
        .active-mapping-indicator-container {
            position: relative;
            display: inline-flex; 
            align-items: center; 
        }
        .active-mapping-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            background-color: #ffc107; 
            border-radius: 50%;
            margin-left: 6px; 
            visibility: hidden; 
            transition: transform 0.2s ease-out, opacity 0.2s;
            opacity: 0;
        }
        .active-mapping-dot.active {
            visibility: visible;
            transform: scale(1.2);
            opacity: 1;
        }
        .volume-icon.active-mapping-indicator-container {}
        .filter-label > span:first-child.active-mapping-indicator-container {
            display: inline-flex;
            align-items: center;
        }


        @media (max-width: 480px) {
            .controls, .point-cloud-params-container { padding: 10px; gap: 10px;}
            button, .file-label { padding: 8px 12px; font-size: 13px; }
            .toggle-button { min-width: 80px; }
            .sensor-config-controls { grid-template-columns: 1fr; } 
            .mapping-grid { grid-template-columns: 1fr; } 
            .sensor-mapping-panel { width: 95%; max-height: 90vh; }
            .sensor-mapping-panel .panel-content { padding: 10px; }
        }
        .hidden { display: none !important; }
