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
