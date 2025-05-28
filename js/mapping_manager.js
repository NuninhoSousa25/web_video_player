// js/mapping_manager.js
const MappingManager = (function() {
    let mappings = [];
    const MAPPINGS_STORAGE_KEY = 'sensorEffectMappings';

    function loadMappings() {
        const storedMappings = localStorage.getItem(MAPPINGS_STORAGE_KEY);
        if (storedMappings) {
            mappings = JSON.parse(storedMappings);
        } else {
            // Default initial mappings
            mappings = [
                { id: Date.now() + 1, sensorId: 'beta', effectId: 'brightness', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 50, rangeMax: 150 },
                { id: Date.now() + 2, sensorId: 'gamma', effectId: 'contrast', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 50, rangeMax: 150 },
                { id: Date.now() + 3, sensorId: 'alpha', effectId: 'saturation', enabled: true, sensitivity: 1.0, invert: false, rangeMin: 0, rangeMax: 200 },
            ];
            saveMappings();
        }
        // Ensure all effects have default ranges if missing (e.g. after adding new effect)
        mappings.forEach(m => {
            const effect = getEffectById(m.effectId);
            if (effect && (m.rangeMin === undefined || m.rangeMax === undefined)) {
                m.rangeMin = effect.min;
                m.rangeMax = effect.max;
            }
        });

    }

    function saveMappings() {
        localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
    }

    function getMappings() {
        return [...mappings]; // Return a copy
    }

    function getActiveMappings() {
        return mappings.filter(m => m.enabled);
    }

    function addMapping(newMappingData) {
        const newId = Date.now();
        const effect = getEffectById(newMappingData.effectId);
        const mappingToAdd = {
            id: newId,
            sensorId: newMappingData.sensorId,
            effectId: newMappingData.effectId,
            enabled: newMappingData.enabled !== undefined ? newMappingData.enabled : true,
            sensitivity: parseFloat(newMappingData.sensitivity) || 1.0,
            invert: newMappingData.invert || false,
            rangeMin: parseFloat(newMappingData.rangeMin) ?? effect?.min ?? 0,
            rangeMax: parseFloat(newMappingData.rangeMax) ?? effect?.max ?? 100,
        };
        mappings.push(mappingToAdd);
        saveMappings();
        return mappingToAdd;
    }

    function updateMapping(mappingId, updatedData) {
        const index = mappings.findIndex(m => m.id === mappingId);
        if (index !== -1) {
            mappings[index] = { ...mappings[index], ...updatedData };
            // Ensure numeric types
            mappings[index].sensitivity = parseFloat(mappings[index].sensitivity);
            mappings[index].rangeMin = parseFloat(mappings[index].rangeMin);
            mappings[index].rangeMax = parseFloat(mappings[index].rangeMax);
            saveMappings();
            return mappings[index];
        }
        return null;
    }

    function deleteMapping(mappingId) {
        mappings = mappings.filter(m => m.id !== mappingId);
        saveMappings();
    }

    function getMappingById(id) {
        return mappings.find(m => m.id === id);
    }

    // Calculates the output value for an effect based on sensor input and mapping
    function calculateEffectValue(sensorValue, mapping) {
        const sensorDetails = getSensorById(mapping.sensorId);
        const effectDetails = getEffectById(mapping.effectId);

        if (!sensorDetails || !effectDetails) return effectDetails ? effectDetails.default : 0;

        // Normalize sensor input (0 to 1)
        // This is a crucial step and might need adjustment based on actual sensor behavior
        let normalizedSensor = 0;
        const sensorRange = sensorDetails.typicalMax - sensorDetails.typicalMin;
        
        if (sensorRange !== 0) {
            normalizedSensor = (sensorValue - sensorDetails.typicalMin) / sensorRange;
        }
        normalizedSensor = Math.max(0, Math.min(1, normalizedSensor)); // Clamp to 0-1

        if (mapping.invert) {
            normalizedSensor = 1 - normalizedSensor;
        }

        // Apply sensitivity (can make sensor more or less responsive around its midpoint)
        // A simple way: treat sensitivity as a multiplier on the deviation from 0.5
        // This is a placeholder; more sophisticated sensitivity curves could be used.
        // For now, let's interpret sensitivity as a direct multiplier on the normalized value that affects the output range span.
        // Or, more simply, just scale the output range based on sensitivity later (easier to reason about for users)
        // Let's apply sensitivity to the normalized value to control how "fast" it traverses the 0-1 range.
        // A sensitivity of 2 means it reaches 1 when the raw sensor is halfway through its range.
        // A sensitivity of 0.5 means it reaches 0.5 when the raw sensor is at its max.
        // This interpretation might be complex. Let's use sensitivity to scale the output delta.

        // Linearly interpolate to the effect's output range
        const outputRange = mapping.rangeMax - mapping.rangeMin;
        let effectValue = mapping.rangeMin + (normalizedSensor * outputRange);
        
        // Clamp to effect's absolute min/max
        effectValue = Math.max(effectDetails.min, Math.min(effectDetails.max, effectValue));
        
        // For properties like playbackRate that don't accept many decimal places
        if (effectDetails.id === 'playbackRate') {
            effectValue = parseFloat(effectValue.toFixed(2));
        } else if (effectDetails.unit === '%' || effectDetails.prop === 'blur' || effectDetails.prop === 'hue-rotate') {
            effectValue = Math.round(effectValue); // Integer for filters
        } else if (effectDetails.prop === 'volume') {
             effectValue = parseFloat(effectValue.toFixed(2));
        }


        return effectValue;
    }
    
    loadMappings(); // Load on init

    return {
        getMappings,
        getActiveMappings,
        addMapping,
        updateMapping,
        deleteMapping,
        getMappingById,
        calculateEffectValue
    };
})();
--- START OF FILE mapping_panel.js ---

// js/mapping_panel.js
const MappingPanel = (function() {
    let panelElement, closeButton, toggleButton, mappingsListElement,
        editFormContainer, editForm, editFormTitle, mappingIdInput,
        sensorSelect, effectSelect, sensitivityRange, sensitivityValueDisplay, // sensitivityValueDisplay is the span
        outputMinInput, outputMaxInput, invertCheckbox, enabledCheckbox,
        addNewMappingBtn, cancelEditBtn,
        sensorDescriptionEl, effectDescriptionEl, effectUnitMinEl, effectUnitMaxEl;

    let currentEditingId = null;

    function cacheDOMElements() {
        panelElement = document.getElementById('sensorMappingPanel');
        closeButton = document.getElementById('closeMappingPanelBtn');
        toggleButton = document.getElementById('toggleMappingPanelBtn'); 
        
        mappingsListElement = document.getElementById('mappingsList');
        addNewMappingBtn = document.getElementById('addNewMappingBtn');

        editFormContainer = document.getElementById('mappingEditFormContainer');
        editForm = document.getElementById('mappingEditForm');
        editFormTitle = document.getElementById('editFormTitle');
        mappingIdInput = document.getElementById('mappingId');
        sensorSelect = document.getElementById('sensorSelect');
        effectSelect = document.getElementById('effectSelect');
        sensitivityRange = document.getElementById('sensitivityRange');
        sensitivityValueDisplay = document.getElementById('sensitivityValueDisplay'); // Corrected ID
        outputMinInput = document.getElementById('outputMin');
        outputMaxInput = document.getElementById('outputMax');
        invertCheckbox = document.getElementById('invertMapping');
        enabledCheckbox = document.getElementById('mappingEnabled');
        cancelEditBtn = document.getElementById('cancelEditBtn');

        sensorDescriptionEl = document.getElementById('sensorDescription');
        effectDescriptionEl = document.getElementById('effectDescription');
        effectUnitMinEl = document.getElementById('effectUnitMin');
        effectUnitMaxEl = document.getElementById('effectUnitMax');
    }

    function populateSelectOptions() {
        sensorSelect.innerHTML = AVAILABLE_SENSORS.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        effectSelect.innerHTML = AVAILABLE_EFFECTS.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    }

    function renderMappingsList() {
        const mappings = MappingManager.getMappings();
        mappingsListElement.innerHTML = ''; 
        if (mappings.length === 0) {
            mappingsListElement.innerHTML = '<li>No mappings defined. Click "Add New Mapping".</li>';
            UI.updateActiveMappingIndicators(); // Update indicators even if list is empty
            return;
        }

        mappings.forEach(mapping => {
            const sensor = getSensorById(mapping.sensorId);
            const effect = getEffectById(mapping.effectId);
            if (!sensor || !effect) return;

            const li = document.createElement('li');
            li.className = mapping.enabled ? 'enabled' : 'disabled';
            li.dataset.mappingId = mapping.id;

            let sensitivityDisplay = mapping.sensitivity ? mapping.sensitivity.toFixed(1) : '1.0';

            li.innerHTML = `
                <div class="mapping-info">
                    <span class="mapping-name">${sensor.name} → ${effect.name}</span>
                    <div class="mapping-actions">
                        <button class="toggle-enable-btn" data-id="${mapping.id}">${mapping.enabled ? 'Disable' : 'Enable'}</button>
                        <button class="edit-btn" data-id="${mapping.id}">Edit</button>
                        <button class="delete-btn" data-id="${mapping.id}">Delete</button>
                    </div>
                </div>
                <div class="mapping-details">
                    Sensitivity: ${sensitivityDisplay}, Output: ${mapping.rangeMin}${effect.unit || ''} to ${mapping.rangeMax}${effect.unit || ''}${mapping.invert ? ' (Inverted)' : ''}
                </div>
            `;
            mappingsListElement.appendChild(li);
        });
        UI.updateActiveMappingIndicators(); // Update indicators after rendering list
    }
    
    function showPanel() { panelElement.classList.remove('hidden'); }
    function hidePanel() { panelElement.classList.add('hidden'); hideEditForm(); }
    function togglePanel() { panelElement.classList.toggle('hidden'); if(panelElement.classList.contains('hidden')) hideEditForm(); }


    function showEditForm(mappingData = null) {
        currentEditingId = mappingData ? mappingData.id : null;
        editFormTitle.textContent = mappingData ? 'Edit Mapping' : 'Add New Mapping';
        
        if (mappingData) {
            mappingIdInput.value = mappingData.id;
            sensorSelect.value = mappingData.sensorId;
            effectSelect.value = mappingData.effectId;
            sensitivityRange.value = mappingData.sensitivity || 1.0;
            outputMinInput.value = mappingData.rangeMin;
            outputMaxInput.value = mappingData.rangeMax;
            invertCheckbox.checked = mappingData.invert || false;
            enabledCheckbox.checked = mappingData.enabled !== undefined ? mappingData.enabled : true;
        } else { 
            editForm.reset(); 
            mappingIdInput.value = '';
            sensorSelect.value = AVAILABLE_SENSORS[0].id;
            effectSelect.value = AVAILABLE_EFFECTS[0].id;
            sensitivityRange.value = 1.0;
            const defaultEffect = getEffectById(effectSelect.value);
            outputMinInput.value = defaultEffect.min; 
            outputMaxInput.value = defaultEffect.max;
            invertCheckbox.checked = false;
            enabledCheckbox.checked = true;
        }
        updateSensitivityDisplay();
        updateDescriptionAndUnits();
        editFormContainer.classList.remove('hidden');
    }

    function hideEditForm() {
        editFormContainer.classList.add('hidden');
        currentEditingId = null;
    }

    function updateSensitivityDisplay() {
        if (sensitivityValueDisplay && sensitivityRange) { // Check elements exist
            sensitivityValueDisplay.textContent = parseFloat(sensitivityRange.value).toFixed(1);
        }
    }
    
    function updateDescriptionAndUnits() {
        const selectedSensor = getSensorById(sensorSelect.value);
        const selectedEffect = getEffectById(effectSelect.value);

        if (selectedSensor && sensorDescriptionEl) sensorDescriptionEl.textContent = selectedSensor.description;
        if (selectedEffect) {
            if(effectDescriptionEl) effectDescriptionEl.textContent = selectedEffect.description;
            if(effectUnitMinEl) effectUnitMinEl.textContent = selectedEffect.unit || '';
            if(effectUnitMaxEl) effectUnitMaxEl.textContent = selectedEffect.unit || '';
            
            if (!currentEditingId || 
                (outputMinInput && outputMaxInput && selectedEffect && (
                    parseFloat(outputMinInput.value) < selectedEffect.min || 
                    parseFloat(outputMaxInput.value) > selectedEffect.max ||
                    outputMinInput.value === '' || outputMaxInput.value === ''
                ))) {
                if (outputMinInput) outputMinInput.min = selectedEffect.min;
                if (outputMinInput) outputMinInput.max = selectedEffect.max;
                if (outputMaxInput) outputMaxInput.min = selectedEffect.min;
                if (outputMaxInput) outputMaxInput.max = selectedEffect.max;
                if (!currentEditingId) {
                    if (outputMinInput) outputMinInput.value = selectedEffect.min;
                    if (outputMaxInput) outputMaxInput.value = selectedEffect.max;
                }
            }
        }
    }


    function handleFormSubmit(event) {
        event.preventDefault();
        const formData = {
            sensorId: sensorSelect.value,
            effectId: effectSelect.value,
            sensitivity: parseFloat(sensitivityRange.value),
            rangeMin: parseFloat(outputMinInput.value),
            rangeMax: parseFloat(outputMaxInput.value),
            invert: invertCheckbox.checked,
            enabled: enabledCheckbox.checked,
        };

        const effectDetails = getEffectById(formData.effectId);
        if (formData.rangeMin < effectDetails.min) formData.rangeMin = effectDetails.min;
        if (formData.rangeMax > effectDetails.max) formData.rangeMax = effectDetails.max;
        if (formData.rangeMin > formData.rangeMax) { 
            [formData.rangeMin, formData.rangeMax] = [formData.rangeMax, formData.rangeMin];
        }


        if (currentEditingId) {
            MappingManager.updateMapping(currentEditingId, formData);
        } else {
            MappingManager.addMapping(formData);
        }
        renderMappingsList(); // This will also call UI.updateActiveMappingIndicators()
        hideEditForm();
    }

    function handleListClick(event) {
        const target = event.target;
        if (!target.dataset.id) return; // Ensure data-id exists
        const mappingId = parseInt(target.dataset.id);


        if (target.classList.contains('edit-btn')) {
            const mapping = MappingManager.getMappingById(mappingId);
            if (mapping) showEditForm(mapping);
        } else if (target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this mapping?')) {
                MappingManager.deleteMapping(mappingId);
                renderMappingsList(); // This will also call UI.updateActiveMappingIndicators()
            }
        } else if (target.classList.contains('toggle-enable-btn')) {
             const mapping = MappingManager.getMappingById(mappingId);
             if (mapping) {
                 MappingManager.updateMapping(mappingId, { enabled: !mapping.enabled });
                 renderMappingsList(); // This will also call UI.updateActiveMappingIndicators()
             }
        }
    }

    function setupEventListeners() {
        if(toggleButton) toggleButton.addEventListener('click', togglePanel);
        if(closeButton) closeButton.addEventListener('click', hidePanel);
        if(addNewMappingBtn) addNewMappingBtn.addEventListener('click', () => showEditForm());
        if(cancelEditBtn) cancelEditBtn.addEventListener('click', hideEditForm);
        if(editForm) editForm.addEventListener('submit', handleFormSubmit);
        if(mappingsListElement) mappingsListElement.addEventListener('click', handleListClick);
        
        if(sensitivityRange) sensitivityRange.addEventListener('input', updateSensitivityDisplay);
        if(sensorSelect) sensorSelect.addEventListener('change', updateDescriptionAndUnits);
        if(effectSelect) effectSelect.addEventListener('change', () => {
             const selectedEffect = getEffectById(effectSelect.value);
             if(selectedEffect) {
                if(outputMinInput) outputMinInput.value = selectedEffect.min;
                if(outputMaxInput) outputMaxInput.value = selectedEffect.max;
             }
            updateDescriptionAndUnits();
        });
    }

    function init() {
        cacheDOMElements();
        populateSelectOptions();
        renderMappingsList();
        setupEventListeners();
        UI.updateActiveMappingIndicators(); // Initial call
    }

    return {
        init,
        renderMappingsList, 
        show: showPanel,
        hide: hidePanel,
        toggle: togglePanel
    };
})();
