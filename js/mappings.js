/**
 * Enhanced Sensor Video Processor - Mappings Module
 * Handles sensor to effect mappings with a React-inspired design
 */

// Define global sensors and effects data
// Available sensors and their configuration
const availableSensors = [
    { id: 'alpha', name: 'Rotation (Alpha)', description: 'Device rotation around z-axis (compass direction)', unit: '°', min: 0, max: 360, default: 180 }

// Populate the sensor and effect select inputs in the modal
function populateSelectInputs() {
    // Clear existing options
    modalSensorSelect.innerHTML = '';
    modalEffectSelect.innerHTML = '';
    
    // Add sensor options
    availableSensors.forEach(sensor => {
        const option = document.createElement('option');
        option.value = sensor.id;
        option.textContent = sensor.name;
        modalSensorSelect.appendChild(option);
    });
    
    // Add effect options
    availableEffects.forEach(effect => {
        const option = document.createElement('option');
        option.value = effect.id;
        option.textContent = effect.name;
        modalEffectSelect.appendChild(option);
    });
}

// Update the descriptions in the modal based on selected sensor and effect
function updateModalDescriptions() {
    const sensorId = modalSensorSelect.value;
    const effectId = modalEffectSelect.value;
    
    const sensor = getSensorById(sensorId);
    const effect = getEffectById(effectId);
    
    if (sensor) {
        modalSensorDescription.textContent = `${sensor.description} (${sensor.min}${sensor.unit} - ${sensor.max}${sensor.unit})`;
    }
    
    if (effect) {
        modalEffectDescription.textContent = `${effect.description} (${effect.min}${effect.unit} - ${effect.max}${effect.unit})`;
    }
}

// Update range min/max values when effect changes
function updateRangeValuesForEffect(effectId) {
    const effect = getEffectById(effectId);
    
    if (effect) {
        modalRangeMin.value = effect.min;
        modalRangeMax.value = effect.max;
    }
}

// Toggle between list and grid view
function updateMappingViewUI() {
    listViewBtn.classList.toggle('active', mappingViewMode === 'list');
    gridViewBtn.classList.toggle('active', mappingViewMode === 'grid');
    
    utils.toggleElementVisibility(mappingListView, mappingViewMode === 'list');
    utils.toggleElementVisibility(mappingGridView, mappingViewMode === 'grid');
    
    // When in list view, show the list view add button and hide grid add button
    utils.toggleElementVisibility(addMappingBtn, mappingViewMode === 'list');
}

// Show the add mapping modal with default values
function showAddMappingModal() {
    // Generate a new ID
    const nextId = getNextMappingId();
    
    // Set default values
    currentEditingMapping = {
        id: nextId,
        sensorId: availableSensors[0].id,
        effectId: availableEffects[0].id,
        enabled: true,
        sensitivity: 1.0,
        invert: false,
        minOutput: availableEffects[0].min,
        maxOutput: availableEffects[0].max
    };
    
    // Update modal title
    document.querySelector('.mapping-modal-title').textContent = 'Add New Mapping';
    
    // Fill form with default values
    populateModalWithMapping(currentEditingMapping);
    
    // Show modal
    showModal();
}

// Show modal for editing an existing mapping
function editMapping(mappingId) {
    const mapping = sensorMappings.find(m => m.id === parseInt(mappingId));
    if (!mapping) return;
    
    // Set as current editing mapping
    currentEditingMapping = { ...mapping };
    
    // Update modal title
    document.querySelector('.mapping-modal-title').textContent = 'Edit Mapping';
    
    // Fill form with mapping values
    populateModalWithMapping(mapping);
    
    // Show modal
    showModal();
}

// Populate the modal form with mapping values
function populateModalWithMapping(mapping) {
    modalSensorSelect.value = mapping.sensorId;
    modalEffectSelect.value = mapping.effectId;
    modalSensitivitySlider.value = mapping.sensitivity;
    modalSensitivityValue.textContent = mapping.sensitivity.toFixed(1);
    modalRangeMin.value = mapping.minOutput;
    modalRangeMax.value = mapping.maxOutput;
    modalInvertMapping.checked = mapping.invert;
    
    // Update descriptions
    updateModalDescriptions();
}

// Hide the mapping modal
function hideModal() {
    mappingModal.classList.add('hidden');
    currentEditingMapping = null;
}

// Show the mapping modal
function showModal() {
    mappingModal.classList.remove('hidden');
}

// Save the current mapping from the modal
function saveMapping() {
    if (!currentEditingMapping) return;
    
    // Get values from form
    currentEditingMapping.sensorId = modalSensorSelect.value;
    currentEditingMapping.effectId = modalEffectSelect.value;
    currentEditingMapping.sensitivity = parseFloat(modalSensitivitySlider.value);
    currentEditingMapping.minOutput = parseFloat(modalRangeMin.value);
    currentEditingMapping.maxOutput = parseFloat(modalRangeMax.value);
    currentEditingMapping.invert = modalInvertMapping.checked;
    
    // Find if editing existing mapping or adding new
    const existingIndex = sensorMappings.findIndex(m => m.id === currentEditingMapping.id);
    
    if (existingIndex !== -1) {
        // Update existing mapping
        sensorMappings[existingIndex] = { ...currentEditingMapping };
    } else {
        // Add new mapping
        sensorMappings.push({ ...currentEditingMapping });
    }
    
    // Close modal
    hideModal();
    
    // Update UI
    renderMappings();
    
    // Save to local storage
    saveMappingsToLocalStorage();
}

// Toggle mapping enabled state
function toggleMapping(mappingId) {
    const index = sensorMappings.findIndex(m => m.id === parseInt(mappingId));
    if (index !== -1) {
        sensorMappings[index].enabled = !sensorMappings[index].enabled;
        renderMappings(); // Re-render the UI
        saveMappingsToLocalStorage(); // Save changes
    }
}

// Delete a mapping
function deleteMapping(mappingId) {
    if (confirm('Are you sure you want to delete this mapping?')) {
        sensorMappings = sensorMappings.filter(m => m.id !== parseInt(mappingId));
        renderMappings(); // Re-render the UI
        saveMappingsToLocalStorage(); // Save changes
    }
}

// Render all mappings in the UI
function renderMappings() {
    // Clear existing content
    mappingListView.innerHTML = '';
    mappingGridView.innerHTML = '';
    
    // Create list view items
    sensorMappings.forEach(mapping => {
        const sensor = getSensorById(mapping.sensorId);
        const effect = getEffectById(mapping.effectId);
        if (!sensor || !effect) return;
        
        // Create list item
        const listItem = document.createElement('div');
        listItem.className = `mapping-item${!mapping.enabled ? ' disabled' : ''}`;
        listItem.dataset.mappingId = mapping.id;
        
        listItem.innerHTML = `
            <div class="mapping-item-header">
                <div class="mapping-connection">
                    <span class="mapping-sensor">${sensor.name}</span>
                    <span class="mapping-arrow">→</span>
                    <span class="mapping-effect">${effect.name}</span>
                </div>
                <div class="mapping-actions">
                    <button class="mapping-action-btn toggle-btn">${mapping.enabled ? 'Disable' : 'Enable'}</button>
                    <button class="mapping-action-btn edit-btn">Edit</button>
                    <button class="mapping-action-btn delete delete-btn">Delete</button>
                </div>
            </div>
            <div class="mapping-details">
                <div class="mapping-detail">
                    <span class="mapping-detail-icon">⚙️</span>
                    <span>Sensitivity: ${mapping.sensitivity.toFixed(1)}</span>
                </div>
                <div class="mapping-detail">
                    <span class="mapping-detail-icon">🔄</span>
                    <span>${mapping.invert ? 'Inverted' : 'Normal'}</span>
                </div>
                <div class="mapping-detail">
                    <span class="mapping-detail-icon">📊</span>
                    <span>Range: ${mapping.minOutput}${effect.unit} - ${mapping.maxOutput}${effect.unit}</span>
                </div>
            </div>
        `;
        
        // Add event listeners for buttons
        const toggleBtn = listItem.querySelector('.toggle-btn');
        toggleBtn.addEventListener('click', () => toggleMapping(mapping.id));
        
        const editBtn = listItem.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => editMapping(mapping.id));
        
        const deleteBtn = listItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteMapping(mapping.id));
        
        mappingListView.appendChild(listItem);
        
        // Create grid item
        const gridItem = document.createElement('div');
        gridItem.className = `mapping-grid-item${!mapping.enabled ? ' disabled' : ''}`;
        gridItem.dataset.mappingId = mapping.id;
        
        gridItem.innerHTML = `
            <div class="mapping-grid-header">
                <div class="mapping-grid-sensor">${sensor.name}</div>
                <div class="mapping-grid-actions">
                    <button class="mapping-grid-action toggle-btn">${mapping.enabled ? '⚡' : '💤'}</button>
                    <button class="mapping-grid-action edit-btn">✏️</button>
                    <button class="mapping-grid-action delete-btn">🗑️</button>
                </div>
            </div>
            <div class="mapping-grid-effect">${effect.name}</div>
            <div class="mapping-grid-details">
                <div class="mapping-grid-detail">
                    <span>Sensitivity:</span>
                    <span class="mapping-grid-value">${mapping.sensitivity.toFixed(1)}</span>
                </div>
                <div class="mapping-grid-detail">
                    <span>Invert:</span>
                    <span class="mapping-grid-value">${mapping.invert ? 'Yes' : 'No'}</span>
                </div>
                <div class="mapping-grid-detail">
                    <span>Range:</span>
                    <span class="mapping-grid-value">${mapping.minOutput}${effect.unit} - ${mapping.maxOutput}${effect.unit}</span>
                </div>
            </div>
        `;
        
        // Add event listeners for grid buttons
        const gridToggleBtn = gridItem.querySelector('.toggle-btn');
        gridToggleBtn.addEventListener('click', () => toggleMapping(mapping.id));
        
        const gridEditBtn = gridItem.querySelector('.edit-btn');
        gridEditBtn.addEventListener('click', () => editMapping(mapping.id));
        
        const gridDeleteBtn = gridItem.querySelector('.delete-btn');
        gridDeleteBtn.addEventListener('click', () => deleteMapping(mapping.id));
        
        mappingGridView.appendChild(gridItem);
    });
    
    // Add "Add New" button to grid view
    const addGridBtn = document.createElement('div');
    addGridBtn.className = 'mapping-grid-add';
    addGridBtn.innerHTML = `
        <div class="mapping-grid-add-icon">+</div>
        <div class="mapping-grid-add-text">Add New Mapping</div>
    `;
    addGridBtn.addEventListener('click', showAddMappingModal);
    mappingGridView.appendChild(addGridBtn);
}

// Apply all sensor mappings based on current sensor values
function applyAllSensorMappings() {
    if (!window.sensorsGloballyEnabled && !window.testingModeEnabled) return;
    
    // Apply each active mapping
    sensorMappings.forEach(mapping => {
        if (!mapping.enabled) return;
        
        // Get the sensor value (from testing mode or actual sensors)
        let sensorValue = window.testingModeEnabled 
            ? getTestingSensorValue(mapping.sensorId) 
            : getSensorValue(mapping.sensorId);
        
        // Get sensor config
        const sensorConfig = getSensorById(mapping.sensorId);
        if (!sensorConfig) return;
        
        // Normalize the sensor value to 0-1 range
        const normalizedValue = utils.normalizeSensorValue(
            sensorValue, 
            sensorConfig.min, 
            sensorConfig.max
        );
        
        // Apply sensitivity and inversion
        let adjustedValue = normalizedValue * mapping.sensitivity;
        if (mapping.invert) adjustedValue = 1 - adjustedValue;
        
        // Map to output range
        const outputValue = utils.mapValue(
            adjustedValue,
            0, 1,
            mapping.minOutput, mapping.maxOutput
        );
        
        // Apply the effect
        applyEffect(mapping.effectId, outputValue);
    });
}

// Helper function to get sensor value
function getSensorValue(sensorId) {
    return window.sensorValues ? (window.sensorValues[sensorId] || 0) : 0;
}

// Helper function to get testing sensor value
function getTestingSensorValue(sensorId) {
    if (!window.testingControls) return 0;
    
    switch (sensorId) {
        case 'alpha': return parseFloat(document.getElementById('testAlphaSlider').value);
        case 'beta': return parseFloat(document.getElementById('testBetaSlider').value);
        case 'gamma': return parseFloat(document.getElementById('testGammaSlider').value);
        case 'mic': return parseFloat(document.getElementById('testMicSlider').value);
        case 'light': return parseFloat(document.getElementById('testLightSlider').value);
        case 'accelX': return parseFloat(document.getElementById('testAccelXSlider').value);
        default: return 0;
    }
}

// Apply an effect with a specific value
function applyEffect(effectId, value) {
    const effect = getEffectById(effectId);
    if (!effect) return;
    
    // Apply the effect based on type
    switch (effectId) {
        case 'brightness':
            document.getElementById('brightnessSlider').value = value;
            document.getElementById('brightnessValue').textContent = `${Math.round(value)}%`;
            break;
        case 'contrast':
            document.getElementById('contrastSlider').value = value;
            document.getElementById('contrastValue').textContent = `${Math.round(value)}%`;
            break;
        case 'saturation':
            document.getElementById('saturationSlider').value = value;
            document.getElementById('saturationValue').textContent = `${Math.round(value)}%`;
            break;
        case 'hueRotate':
            document.getElementById('hueRotateSlider').value = value;
            document.getElementById('hueRotateValue').textContent = `${Math.round(value)}°`;
            break;
        case 'blur':
            document.getElementById('blurSlider').value = value;
            document.getElementById('blurValue').textContent = `${Math.round(value)}px`;
            break;
        case 'sepia':
            // Sepia needs to be applied directly to video as it doesn't have its own slider
            window.lastVideoFilterValues.sepia = value;
            break;
        case 'playbackRate':
            if (window.videoPlayer) {
                window.videoPlayer.playbackRate = value;
            }
            break;
        case 'pointCloudDisplacement':
            document.getElementById('displacementSlider').value = value;
            document.getElementById('displacementValue').textContent = Math.round(value);
            if (window.pointCloudConfig) window.pointCloudConfig.displacementScale = value;
            break;
        case 'pointCloudDensity':
            document.getElementById('densitySlider').value = value;
            document.getElementById('densityValue').textContent = Math.round(value);
            if (window.pointCloudConfig) window.pointCloudConfig.density = value;
            break;
        case 'pointCloudSize':
            document.getElementById('pointSizeSlider').value = value;
            document.getElementById('pointSizeValue').textContent = Math.round(value);
            if (window.pointCloudConfig) window.pointCloudConfig.pointSize = value;
            break;
    }
    
    // Apply all updated filter values to the video
    if (effect.effectType === 'video' && window.applyVideoFilters) {
        window.applyVideoFilters();
    }
}

// Helper function to get sensor by ID
function getSensorById(id) {
    return availableSensors.find(s => s.id === id);
}

// Helper function to get effect by ID
function getEffectById(id) {
    return availableEffects.find(e => e.id === id);
}

// Generate next mapping ID
function getNextMappingId() {
    return Math.max(0, ...sensorMappings.map(m => m.id)) + 1;
}

// Save mappings to local storage
function saveMappingsToLocalStorage() {
    utils.saveToLocalStorage('sensorMappings', sensorMappings);
}

// Load mappings from local storage
function loadMappingsFromLocalStorage() {
    const savedMappings = utils.loadFromLocalStorage('sensorMappings', null);
    sensorMappings = savedMappings || defaultSensorMappings;
}

// Export functions to global scope
window.mappings = {
    initializeMappings,
    applyAllSensorMappings,
    renderMappings,
    getSensorById,
    getEffectById,
    availableSensors,
    availableEffects
};,
    { id: 'beta', name: 'Tilt Forward/Back (Beta)', description: 'Device tilt front/back', unit: '°', min: -90, max: 90, default: 0 },
    { id: 'gamma', name: 'Tilt Left/Right (Gamma)', description: 'Device tilt left/right', unit: '°', min: -90, max: 90, default: 0 },
    { id: 'mic', name: 'Microphone Level', description: 'Audio input volume level', unit: '%', min: 0, max: 100, default: 0 },
    { id: 'light', name: 'Ambient Light', description: 'Environmental light level from light sensor', unit: 'lux', min: 0, max: 1000, default: 500 },
    { id: 'accelX', name: 'Acceleration X', description: 'Linear acceleration along x-axis', unit: 'm/s²', min: -10, max: 10, default: 0 },
    { id: 'accelY', name: 'Acceleration Y', description: 'Linear acceleration along y-axis', unit: 'm/s²', min: -10, max: 10, default: 0 },
    { id: 'accelZ', name: 'Acceleration Z', description: 'Linear acceleration along z-axis', unit: 'm/s²', min: -10, max: 10, default: 0 }
];

// Available effects and their configuration
const availableEffects = [
    { id: 'brightness', name: 'Brightness', description: 'Video brightness filter', unit: '%', min: 25, max: 200, default: 100, effectType: 'video' },
    { id: 'contrast', name: 'Contrast', description: 'Video contrast filter', unit: '%', min: 25, max: 200, default: 100, effectType: 'video' },
    { id: 'saturation', name: 'Saturation', description: 'Video saturation filter', unit: '%', min: 25, max: 200, default: 100, effectType: 'video' },
    { id: 'hueRotate', name: 'Hue Rotation', description: 'Color hue rotation', unit: '°', min: 0, max: 360, default: 0, effectType: 'video' },
    { id: 'blur', name: 'Blur', description: 'Gaussian blur effect', unit: 'px', min: 0, max: 20, default: 0, effectType: 'video' },
    { id: 'sepia', name: 'Sepia', description: 'Sepia tone effect', unit: '%', min: 0, max: 100, default: 0, effectType: 'video' },
    { id: 'playbackRate', name: 'Playback Speed', description: 'Video playback rate', unit: 'x', min: 0.25, max: 2, default: 1, effectType: 'video' },
    { id: 'pointCloudDisplacement', name: 'Point Cloud Displacement', description: 'Point cloud z-axis displacement', unit: '', min: 0, max: 200, default: 50, effectType: 'pointCloud' },
    { id: 'pointCloudDensity', name: 'Point Cloud Density', description: 'Point cloud sampling density', unit: '', min: 8, max: 128, default: 32, effectType: 'pointCloud' },
    { id: 'pointCloudSize', name: 'Point Size', description: 'Size of point cloud particles', unit: 'px', min: 1, max: 10, default: 3, effectType: 'pointCloud' }
];

// Default sensor mappings
let defaultSensorMappings = [
    { 
        id: 1, 
        sensorId: 'alpha', 
        effectId: 'saturation', 
        enabled: true, 
        sensitivity: 1.0, 
        invert: false, 
        minOutput: 50, 
        maxOutput: 150 
    },
    { 
        id: 2, 
        sensorId: 'beta', 
        effectId: 'brightness', 
        enabled: true, 
        sensitivity: 1.0, 
        invert: false, 
        minOutput: 50, 
        maxOutput: 150 
    },
    { 
        id: 3, 
        sensorId: 'gamma', 
        effectId: 'contrast', 
        enabled: true, 
        sensitivity: 1.0, 
        invert: false, 
        minOutput: 50, 
        maxOutput: 150 
    },
    {
        id: 4,
        sensorId: 'mic',
        effectId: 'blur',
        enabled: true,
        sensitivity: 1.0,
        invert: false,
        minOutput: 0,
        maxOutput: 10
    },
    {
        id: 5,
        sensorId: 'light',
        effectId: 'hueRotate',
        enabled: true,
        sensitivity: 1.0,
        invert: false,
        minOutput: 0,
        maxOutput: 360
    }
];

// Mapping module state
let sensorMappings = [];
let mappingViewMode = 'list'; // 'list' or 'grid'
let currentEditingMapping = null;

// DOM Elements
let mappingListView;
let mappingGridView;
let listViewBtn;
let gridViewBtn;
let addMappingBtn;
let mappingModal;
let modalSensorSelect;
let modalEffectSelect;
let modalSensorDescription;
let modalEffectDescription;
let modalSensitivitySlider;
let modalSensitivityValue;
let modalRangeMin;
let modalRangeMax;
let modalInvertMapping;
let closeModalBtn;
let modalCancelBtn;
let modalSaveBtn;

// Initialize the mappings module
function initializeMappings() {
    // Get DOM elements
    mappingListView = utils.getElement('mappingListView');
    mappingGridView = utils.getElement('mappingGridView');
    listViewBtn = utils.getElement('listViewBtn');
    gridViewBtn = utils.getElement('gridViewBtn');
    addMappingBtn = utils.getElement('addMappingBtn');
    mappingModal = utils.getElement('mappingModal');
    modalSensorSelect = utils.getElement('modalSensorSelect');
    modalEffectSelect = utils.getElement('modalEffectSelect');
    modalSensorDescription = utils.getElement('modalSensorDescription');
    modalEffectDescription = utils.getElement('modalEffectDescription');
    modalSensitivitySlider = utils.getElement('modalSensitivitySlider');
    modalSensitivityValue = utils.getElement('modalSensitivityValue');
    modalRangeMin = utils.getElement('modalRangeMin');
    modalRangeMax = utils.getElement('modalRangeMax');
    modalInvertMapping = utils.getElement('modalInvertMapping');
    closeModalBtn = utils.getElement('closeModalBtn');
    modalCancelBtn = utils.getElement('modalCancelBtn');
    modalSaveBtn = utils.getElement('modalSaveBtn');

    // Load mappings from localStorage or use defaults
    loadMappingsFromLocalStorage();
    
    // Populate select inputs in the modal
    populateSelectInputs();
    
    // Set up event listeners
    setupEventListeners();
    
    // Render initial mappings UI
    renderMappings();
}

// Set up all event listeners for the mapping UI
function setupEventListeners() {
    // View toggle
    listViewBtn.addEventListener('click', () => {
        mappingViewMode = 'list';
        updateMappingViewUI();
    });
    
    gridViewBtn.addEventListener('click', () => {
        mappingViewMode = 'grid';
        updateMappingViewUI();
    });
    
    // Add mapping button
    addMappingBtn.addEventListener('click', showAddMappingModal);
    
    // Modal close buttons
    closeModalBtn.addEventListener('click', hideModal);
    modalCancelBtn.addEventListener('click', hideModal);
    
    // Modal save button
    modalSaveBtn.addEventListener('click', saveMapping);
    
    // Effect change updates descriptions and range values
    modalEffectSelect.addEventListener('change', () => {
        updateModalDescriptions();
        updateRangeValuesForEffect(modalEffectSelect.value);
    });
    
    // Sensor change updates description
    modalSensorSelect.addEventListener('change', () => {
        updateModalDescriptions();
    });
    
    // Sensitivity slider updates value display
    modalSensitivitySlider.addEventListener('input', () => {
        modalSensitivityValue.textContent = parseFloat(modalSensitivitySlider.value).toFixed(1);
    });