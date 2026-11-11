// ==UserScript==
// @name         GeoFS-V4.0_Overpowered-Engines
// @namespace    https://greasyfork.org/users/1594049
// @version      0.1.0
// @description  Experimental GeoFS V4 port of the V3.9 thrust, ceiling, and stability controls.
// @author       AMFI-Disable
// @icon         https://www.geo-fs.com/images/icons/favicon.ico
// @match        https://beta.geo-fs.com/geofs.php*
// @match        https://www.geo-fs.com/geofs.php*
// @require      https://update.greasyfork.org/scripts/604885/code.js
// @require      https://update.greasyfork.org/scripts/604887/code.js
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==
(() => {
    if (!window.GeoFSV4Core || !window.GeoFSV4Design) {
        console.error('[GeoFS-V4.0_Overpowered-Engines] Missing dependency');
        return;
    }
    function main() {
    // Persistence Layer: Load state from localStorage with fallbacks
    window.opMultiplier = parseFloat(localStorage.getItem('geofs-op-mult')) || 1.0;
    window.opCeiling = parseInt(localStorage.getItem('geofs-op-ceiling')) || 3000000;
    
    globalThis.isThrustActive = false;
    globalThis.isCeilingActive = false;
    globalThis.isSASActive = localStorage.getItem('geofs-op-sas') === 'true';
    
    // Physical Buffers: Cache original engine parameters for non-destructive restoration
    let t_cache = { thrust: {}, zeroThrustAltitude: null, zeroRPMAltitude: null, torque: {} };
    let lastAircraft = geofs?.aircraft?.instance || null;

    const overpoweredEnginesSuite = {
        state: {
            keybind: localStorage.getItem('geofs-op-keybind') || 'q',
            isSettingKey: false,
            isDragging: false,
            dragOffset: { x: 0, y: 0 }
        },
        
        thrustSnapPoints: [1, 2, 5, 10, 50, 100, 500, 1000, 5000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000],
        ceilingSnapPoints: [3000000, 10000000, 100000000, 1000000000, 10000000000, 100000000000, 1000000000000],

        createUI: function() {
            if (document.getElementById("opEngineCard")) return;

            const card = document.createElement("div"); 
            card.id = "opEngineCard"; 
            card.style.cssText = `
                position: fixed; bottom: 120px; left: 540px; width: 320px; height: auto; z-index: 10000; 
                display: none; padding: 0; border: 1px solid #888; border-radius: 15px; 
                overflow: hidden; box-shadow: 0 0 5px #000; background: rgba(0,0,0,0.8); 
                color: white; font-family: Helvetica, Arial, sans-serif; user-select: none; 
                box-sizing: border-box; transform: translate(0,0); transition: none; cursor: grab;
            `;
            
            card.innerHTML = `
                <div id="opEngineHeader" style="background: rgba(255,255,255,0.05); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); pointer-events: none;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        
                        <span id="opEngineHeaderText" style="font-weight: normal; font-size: 12px; letter-spacing: normal; color: #fff; text-transform: uppercase;">Overpowered Engines</span>
                    </div>
                    <button onclick="window.toggleOpEngineUI()" style="background: none; border: none; color: #666; cursor: pointer; font-size: 18px; transition: 0.2s; pointer-events: auto;" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='#666'">✕</button>
                </div>

                <div style="padding: 20px; display: flex; flex-direction: column; gap: 15px; pointer-events: none;">
                    
                    <!-- THRUST SECTION -->
                    <div id="opThrustContainer" style="position: relative;">
                        <div id="opThrustLockOverlay" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; cursor: not-allowed;" onclick="if(window.V40_NOTIF) V40_NOTIF.warn('OP Engines thrust is currently auto-managed by the Autothrottle OP-SYNC.')"></div>
                        <div id="opThrustSection" style="display: flex; flex-direction: column; gap: 10px; pointer-events: auto;">
                            <div style="display: flex; gap: 8px;">
                            <button id="opThrustBtn" onclick="window.toggleThrustMode()" style="
                                flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; 
                                padding: 10px; border-radius: 15px; cursor: pointer; font-size: 12px; font-weight: normal; 
                                transition: all 0.3s; letter-spacing: normal;
                            ">ACTIVATE THRUST</button>
                            <button id="opSASBtn" onclick="window.toggleSASMode()" title="Stability Augmentation System" style="
                                width: 50px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #dddddd; 
                                padding: 10px; border-radius: 10px; cursor: pointer; font-size: 10px; font-weight: 900; 
                                transition: all 0.3s;
                            ">SAS</button>
                        </div>
                        
                        <div style="background: transparent; padding: 4px 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-size: 10px; color: #888; text-transform: uppercase;">Thrust Multiplier</span>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <input type="number" id="opMultInput" value="${window.opMultiplier}" step="0.1" style="
                                        background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); color: #dddddd; 
                                        width: 60px; font-size: 12px; font-weight: 900; text-align: center; border-radius: 4px; padding: 2px;
                                    " oninput="window.overpoweredEnginesSuite.syncThrustFromInput(this.value)">
                                    <span style="color: #dddddd; font-weight: 900; font-size: 12px;">x</span>
                                </div>
                            </div>
                            <input type="range" id="opMultSlider" min="0" max="${this.thrustSnapPoints.length - 1}" step="1" 
                                value="${this.getThrustIndex(window.opMultiplier)}" 
                                oninput="window.overpoweredEnginesSuite.syncThrustFromSlider(this.value)" 
                                style="width: 100%; accent-color: #dddddd; cursor: pointer; height: 4px; background: rgba(255,255,255,0.1);">
                            </div>
                        </div>
                    </div>

                    <!-- CEILING SECTION -->
                    <div id="opCeilingContainer" style="position: relative;">
                        <div id="opCeilingLockOverlay" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; cursor: not-allowed;" onclick="if(window.V40_NOTIF) V40_NOTIF.warn('OP Engines atmosphere bypass is currently auto-managed by the Autothrottle.')"></div>
                        <div id="opCeilingSection" style="display: flex; flex-direction: column; gap: 10px; pointer-events: auto;">
                            <button id="opCeilingBtn" onclick="window.toggleCeilingMode()" style="
                                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; 
                                padding: 10px; border-radius: 15px; cursor: pointer; font-size: 12px; font-weight: normal; 
                                transition: all 0.3s; letter-spacing: normal;
                            ">BYPASS ATMOSPHERE</button>
                            
                            <div style="background: transparent; padding: 4px 0;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 10px; color: #888; text-transform: uppercase;">Altitude Ceiling</span>
                                    <span id="opCeilingReadout" style="color: #dddddd; font-weight: 900; font-size: 12px;">${this.formatNumberCompact(window.opCeiling)} ft</span>
                                </div>
                                <input type="range" id="opCeilingSlider" min="0" max="${this.ceilingSnapPoints.length - 1}" step="1" 
                                    value="${this.getCeilingIndex(window.opCeiling)}" 
                                    oninput="window.overpoweredEnginesSuite.syncCeilingFromSlider(this.value)" 
                                    style="width: 100%; accent-color: #dddddd; cursor: pointer; height: 4px; background: rgba(255,255,255,0.1);">
                            </div>
                        </div>
                    </div>

                    <!-- FOOTER & KEYBIND -->
                    <div style="display: flex; justify-content: space-between; align-items: center; pointer-events: auto;">
                        <button id="opKeybindBtn" onclick="window.overpoweredEnginesSuite.startKeybind()" style="
                            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #dddddd; 
                            padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase;
                        ">${this.state.keybind}</button>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                             <div id="opStatusMsg" style="font-size: 10px; color: #aaa; text-align: right; opacity: 0.6; font-style: italic;">
                                Press [${this.state.keybind.toUpperCase()}] to toggle Thrust.
                            </div>
                            <div id="opSASMsg" style="font-size: 10px; color: #dddddd; text-align: right; opacity: 0.5; display: ${globalThis.isSASActive ? 'block' : 'none'};">
                                SAS ACTIVE: Turns may feel stiff.
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(card);
            this.initDraggable(card);
            this.updatePhysicsUI();
            
            // Cross-Module Synchronization for Autothrottle OP-SYNC.
            document.addEventListener("V40_opSyncStateChanged", (e) => {
                const isLocked = e.detail.active;
                const thrustSection = document.getElementById("opThrustSection");
                const lockOverlay = document.getElementById("opThrustLockOverlay");
                const headerText = document.getElementById("opEngineHeaderText");
                
                if (isLocked) {
                    thrustSection.style.pointerEvents = "none";
                    thrustSection.style.opacity = "0.4";
                    lockOverlay.style.display = "block";
                    headerText.innerText = "OP ENGINES [AUTO-MANAGED BY A/THR]";
                    headerText.style.color = "#a855f7"; // Purple for automation status.
                } else {
                    thrustSection.style.pointerEvents = "auto";
                    thrustSection.style.opacity = "1";
                    lockOverlay.style.display = "none";
                    headerText.innerText = "Overpowered Engines";
                    headerText.style.color = "#dddddd";
                }
            });
            
            // Sync live multiplier values from Autothrottle to the local UI
            document.addEventListener("V40_opMultiplierUpdated", (e) => {
                const val = e.detail.value;
                if (globalThis.isThrustActive) applyThrust(true);
                const inputEl = document.getElementById("opMultInput");
                const sliderEl = document.getElementById("opMultSlider");
                if (inputEl) inputEl.value = val.toFixed(1);
                if (sliderEl) sliderEl.value = this.getThrustIndex(val);
            });

            // Autothrottle State Change Synchronization (disables Ceiling controls when A/THR is active).
            const syncCeilingControls = (activeState) => {
                const isAthrActive = typeof activeState === "boolean" ? activeState : !!(window.geofs?.autothrottle?.on);
                const ceilingSection = document.getElementById("opCeilingSection");
                const ceilingLockOverlay = document.getElementById("opCeilingLockOverlay");
                if (ceilingSection) {
                    ceilingSection.style.pointerEvents = isAthrActive ? "none" : "auto";
                    ceilingSection.style.opacity = isAthrActive ? "0.4" : "1";
                }
                if (ceilingLockOverlay) {
                    ceilingLockOverlay.style.display = isAthrActive ? "block" : "none";
                }
                if (window.overpoweredEnginesSuite) {
                    window.overpoweredEnginesSuite.updatePhysicsUI(isAthrActive);
                }
            };

            if (window.$) {
                $(document).on("autothrottleOn", () => setTimeout(() => syncCeilingControls(), 0));
                $(document).on("autothrottleOff", () => setTimeout(() => syncCeilingControls(), 0));
            }
            document.addEventListener("V40_autothrottleStateChanged", (e) => {
                syncCeilingControls(e.detail.active);
            });
            setTimeout(syncCeilingControls, 500);
        },

        /**
         * SAS Ticker: Angular Velocity Dampening (50Hz)
         * Implements Stability Augmentation. Aggressively suppresses angular 
         * velocity when no user input is detected to prevent aircraft 
         * oscillations during overpowered flight.
         */
        tickSAS: () => {
            if (!globalThis.isSASActive || !geofs?.aircraft?.instance) return;
            const rb = geofs.aircraft.instance.rigidBody;
            if (!rb) return;

            // Input Validation: Threshold check for user stick/yoke interaction
            const roll = Math.abs(geofs.animation.values.roll || 0);
            const pitch = Math.abs(geofs.animation.values.pitch || 0);
            const yaw = Math.abs(geofs.animation.values.yaw || 0);
            const isUserControlling = (roll > 0.05 || pitch > 0.05 || yaw > 0.05);

            if (!isUserControlling) {
                // Static Lock: Suppress all rotation in absence of control input
                rb.setAngularVelocity([0, 0, 0]);
            } else {
                // Maneuver Smoothing: Apply slight dampening to prevent flat spins
                const av = rb.getAngularVelocity();
                rb.setAngularVelocity([av[0] * 0.95, av[1] * 0.95, av[2] * 0.95]);
            }
        },

        /**
         * Formats a large number into a compact string suffix notation.
         * 
         * @param {number} val - The numeric value to format.
         * @returns {string} Compact string representation (e.g., 1.5M, 2.3B).
         */
        formatNumberCompact: (val) => {
            if (val >= 1000000000000) return (val / 1000000000000).toFixed(1) + "T";
            if (val >= 1000000000) return (val / 1000000000).toFixed(1) + "B";
            if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
            return val.toLocaleString();
        },

        // Synchronization Logic.
        /**
         * Resolves the nearest snap index matching a target thrust multiplier.
         * 
         * @param {number} val - The target thrust multiplier.
         * @returns {number} Snap index from the predefined list.
         */
        getThrustIndex: function(val) {
            return this.thrustSnapPoints.reduce((prev, curr, idx) => 
                Math.abs(curr - val) < Math.abs(this.thrustSnapPoints[prev] - val) ? idx : prev, 0);
        },

        /**
         * Resolves the nearest snap index matching a target ceiling.
         * 
         * @param {number} val - The target ceiling value.
         * @returns {number} Snap index from the predefined list.
         */
        getCeilingIndex: function(val) {
            return this.ceilingSnapPoints.reduce((prev, curr, idx) => 
                Math.abs(curr - val) < Math.abs(this.ceilingSnapPoints[prev] - val) ? idx : prev, 0);
        },

        /**
         * Updates thrust multiplier state when synced from slider input.
         * 
         * @param {number} index - Index of the selected snap point.
         */
        syncThrustFromSlider: function(index) {
            if (globalThis.isThrustActive) return;
            const val = this.thrustSnapPoints[index];
            window.opMultiplier = val; localStorage.setItem('geofs-op-mult', val);
            document.getElementById("opMultInput").value = val;
        },

        /**
         * Updates thrust multiplier state when synced from text input.
         * 
         * @param {string} val - Text string input from the user.
         */
        syncThrustFromInput: function(val) {
            if (globalThis.isThrustActive) return;
            const num = parseFloat(val);
            if (isNaN(num)) return;
            window.opMultiplier = num; localStorage.setItem('geofs-op-mult', num);
            document.getElementById("opMultSlider").value = this.getThrustIndex(num);
        },

        /**
         * Updates ceiling limit when synced from slider input.
         * 
         * @param {number} index - Index of the selected snap point.
         */
        syncCeilingFromSlider: function(index) {
            if (globalThis.isCeilingActive) return;
            const val = this.ceilingSnapPoints[index];
            window.opCeiling = val; localStorage.setItem('geofs-op-ceiling', val);
            document.getElementById("opCeilingReadout").textContent = this.formatNumberCompact(val) + " ft";
        },

        // Draggable panel setup.
        /**
         * Initialized draggable panel behavior for user customization.
         * 
         * @param {HTMLElement} el - Element to make draggable.
         */
        initDraggable: function(el) {
            el.onmousedown = (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
                this.state.isDragging = true; el.style.cursor = "grabbing";
                const rect = el.getBoundingClientRect();
                this.state.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                document.onmousemove = (moveE) => {
                    if (!this.state.isDragging) return;
                    requestAnimationFrame(() => {
                        const winW = window.innerWidth, winH = window.innerHeight, elW = rect.width, elH = rect.height;
                        const newX = Math.max(0, Math.min(moveE.clientX - this.state.dragOffset.x, winW - elW));
                        const newY = Math.max(0, Math.min(moveE.clientY - this.state.dragOffset.y, winH - elH));
                        el.style.left = newX + "px"; el.style.top = newY + "px"; el.style.bottom = "auto";
                    });
                };
                document.onmouseup = () => {
                    this.state.isDragging = false; el.style.cursor = "grab";
                    document.onmousemove = null; document.onmouseup = null;
                    localStorage.setItem('geofs-op-pos', JSON.stringify({ left: el.style.left, top: el.style.top }));
                };
            };
            const savedPos = localStorage.getItem('geofs-op-pos');
            if (savedPos) {
                try {
                    const pos = JSON.parse(savedPos);
                    if (pos && typeof pos.left === 'string' && pos.left.includes('px') &&
                        typeof pos.top === 'string' && pos.top.includes('px')) {
                        const leftVal = parseFloat(pos.left);
                        const topVal = parseFloat(pos.top);
                        if (!isNaN(leftVal) && !isNaN(topVal) && 
                            leftVal >= 0 && leftVal < window.innerWidth &&
                            topVal >= 0 && topVal < window.innerHeight) {
                            el.style.left = pos.left;
                            el.style.top = pos.top;
                            el.style.bottom = "auto";
                        }
                    }
                } catch(e) {}
            }
        },

        /**
         * Starts the interactive keyboard listener for hotkey assignment.
         */
        startKeybind: function() {
            this.state.isSettingKey = true;
            document.getElementById("opKeybindBtn").textContent = "...";
            document.getElementById("opKeybindBtn").style.color = "#fff";
            if (window.V40_NOTIF) window.V40_NOTIF.info("🎹 Press any alphanumeric key to bind hotkey...");
        },

        /**
         * Handles the dynamic keyboard key press events for hotkey and toggle triggers.
         * 
         * @param {KeyboardEvent} e - The keyboard event object.
         */
        handleKeyPress: function(e) {
            if (this.state.isSettingKey) {
                const key = e.key.toLowerCase();
                if (/^[a-z0-9]$/.test(key) || ['[', ']', ';', "'", ',', '.', '/'].includes(key)) {
                    this.state.keybind = key; localStorage.setItem('geofs-op-keybind', key);
                    this.state.isSettingKey = false;
                    document.getElementById("opKeybindBtn").textContent = key;
                    document.getElementById("opKeybindBtn").style.color = "#dddddd";
                    document.getElementById("opStatusMsg").textContent = `Press [${key.toUpperCase()}] to toggle Thrust.`;
                    if (window.V40_NOTIF) window.V40_NOTIF.success(`🎹 Hotkey set to [ ${key.toUpperCase()} ]`);
                }
                return;
            }
            if (e.key.toLowerCase() === this.state.keybind && !e.ctrlKey && !e.altKey && !e.metaKey) {
                window.toggleThrustMode();
            }
        },

        /**
         * UI State Orchestrator
         * Synchronizes CSS styles, button states, and interaction locks based 
         * on the current physics mode.
         */
        updatePhysicsUI: (activeState) => {
            const tBtn = document.getElementById("opThrustBtn"), cBtn = document.getElementById("opCeilingBtn"), sBtn = document.getElementById("opSASBtn");
            const tInp = document.getElementById("opMultInput"), tSld = document.getElementById("opMultSlider"), cSld = document.getElementById("opCeilingSlider");
            const isAthrActive = typeof activeState === "boolean" ? activeState : !!(window.geofs?.autothrottle?.on);

            // Thrust Toggle State.
            if (tBtn) {
                tBtn.innerText = globalThis.isThrustActive ? "THRUST: ACTIVE" : "ACTIVATE THRUST";
                tBtn.style.background = globalThis.isThrustActive ? "rgba(76,175,80,0.5)" : "rgba(255,255,255,0.05)";
                tBtn.style.borderColor = globalThis.isThrustActive ? "#4caf50" : "rgba(255,255,255,0.1)";
                tBtn.style.boxShadow = globalThis.isThrustActive ? "0 0 15px rgba(255,255,255,0.2)" : "none";
                tBtn.disabled = isAthrActive;
            }
            // Ceiling Bypass State.
            if (cBtn) {
                cBtn.innerText = globalThis.isCeilingActive ? "CEILING: BYPASSED" : "BYPASS ATMOSPHERE";
                cBtn.style.background = globalThis.isCeilingActive ? "rgba(76,175,80,0.5)" : "rgba(255,255,255,0.05)";
                cBtn.style.borderColor = globalThis.isCeilingActive ? "#4caf50" : "rgba(255,255,255,0.1)";
                cBtn.style.boxShadow = globalThis.isCeilingActive ? "0 0 15px rgba(255, 255, 255, 0.3)" : "none";
                cBtn.disabled = isAthrActive;
            }
            // SAS State.
            if (sBtn) {
                sBtn.style.background = globalThis.isSASActive ? "rgba(76,175,80,0.5)" : "rgba(255, 255, 255, 0.05)";
                sBtn.style.borderColor = globalThis.isSASActive ? "#4caf50" : "rgba(255, 255, 255, 0.15)";
                sBtn.style.boxShadow = globalThis.isSASActive ? "0 0 15px rgba(255, 255, 255, 0.3)" : "none";
                document.getElementById("opSASMsg").style.display = globalThis.isSASActive ? 'block' : 'none';
            }
            
            // Interaction Locks: Prevent modification during active simulation or when A/THR is active.
            if (tInp) { 
                const disableThrustInput = globalThis.isThrustActive || isAthrActive;
                tInp.disabled = disableThrustInput; 
                tInp.style.opacity = disableThrustInput ? "0.4" : "1"; 
            }
            if (tSld) { 
                const disableThrustSlider = globalThis.isThrustActive || isAthrActive;
                tSld.disabled = disableThrustSlider; 
                tSld.style.opacity = disableThrustSlider ? "0.4" : "1"; 
            }
            if (cSld) { 
                const disableCeilingSlider = globalThis.isCeilingActive || isAthrActive;
                cSld.disabled = disableCeilingSlider; 
                cSld.style.opacity = disableCeilingSlider ? "0.4" : "1"; 
            }
        }
    };

    // Legacy Bridge.
    window.toggleOpEngineUI = () => {
        const card = document.getElementById("opEngineCard");
        if (card) {
            const isHidden = card.style.display === "none";
            card.style.display = isHidden ? "block" : "none";
        } else {
            console.warn("[GeoFS-V4.0_Overpowered-Engines] >> Panel card not found, re-initializing UI...");
            if (window.overpoweredEnginesSuite) {
                window.overpoweredEnginesSuite.createUI();
                const reCard = document.getElementById("opEngineCard");
                if (reCard) reCard.style.display = "block";
            }
        }
    };

    // Physics Controls.
    window.toggleThrustMode = () => {
        if (globalThis.isThrustActive) removeThrust(); else applyThrust();
    };

    window.toggleCeilingMode = () => {
        if (globalThis.isCeilingActive) removeCeiling(); else applyCeiling();
    };

    window.toggleSASMode = () => {
        globalThis.isSASActive = !globalThis.isSASActive;
        localStorage.setItem('geofs-op-sas', globalThis.isSASActive);
        if (globalThis.isSASActive) {
            applyTorqueSuppression();
            if (window.V40_NOTIF) window.V40_NOTIF.info("🛡️ SAS Stability System Engaged");
        } else {
            restoreTorque();
            if (window.V40_NOTIF) window.V40_NOTIF.info("🛡️ SAS Stability System Disengaged");
        }
        overpoweredEnginesSuite.updatePhysicsUI();
    };

    /**
     * Physics Engine: Thrust Injection.
     * Modifies the maximum thrust, afterburner, and reverse thrust vectors for 
     * all engine parts in the current aircraft.
     */
    function applyThrust(silent = false) {
        if (geofs?.aircraft?.instance) {
            const ac = geofs.aircraft.instance;
            if (ac.parts) for (const u in ac.parts) {
                const s = ac.parts[u];
                if (s?.thrust !== undefined) {
                    // Logic: Cache original values on first activation to allow clean reversal.
                    if (!t_cache.thrust[u]) t_cache.thrust[u] = { thrust: s.thrust, afterBurnerThrust: s.afterBurnerThrust ?? null, reverseThrust: s.reverseThrust ?? null };
                    const mult = window.opMultiplier || 1;
                    s.thrust = mult * Number(t_cache.thrust[u].thrust);
                    if (s.afterBurnerThrust !== undefined) s.afterBurnerThrust = (t_cache.thrust[u].afterBurnerThrust !== null) ? mult * t_cache.thrust[u].afterBurnerThrust : s.thrust;
                    if (s.reverseThrust !== undefined) s.reverseThrust = mult * Number(t_cache.thrust[u].reverseThrust);
                }
            }
            if (globalThis.isSASActive) applyTorqueSuppression();
        }
        globalThis.isThrustActive = true;
        if (!silent && window.V40_NOTIF) window.V40_NOTIF.success(`Thrust Active: ${window.opMultiplier}x Multiplier`);
        overpoweredEnginesSuite.updatePhysicsUI();
    }

    /**
     * Physics Engine: Thrust Restoration.
     * Restores original physical limits for thrust to the aircraft engines.
     */
    function removeThrust() {
        if (geofs?.aircraft?.instance) {
            const ac = geofs.aircraft.instance;
            if (ac.parts) for (const u in t_cache.thrust) {
                const s = ac.parts[u];
                if (s?.thrust !== undefined) {
                    // Restore original physical properties.
                    s.thrust = t_cache.thrust[u].thrust;
                    if (s.afterBurnerThrust !== undefined) s.afterBurnerThrust = t_cache.thrust[u].afterBurnerThrust;
                    if (s.reverseThrust !== undefined) s.reverseThrust = t_cache.thrust[u].reverseThrust;
                }
            }
        }
        globalThis.isThrustActive = false;
        if (window.V40_NOTIF) window.V40_NOTIF.info("Thrust Multiplier Deactivated.");
        overpoweredEnginesSuite.updatePhysicsUI();
    }

    /**
     * Physics Engine: Atmosphere Bypass.
     * Alters zero-thrust and zero-RPM altitude thresholds to permit high-altitude flight.
     */
    function applyCeiling() {
        if (geofs?.aircraft?.instance) {
            const ac = geofs.aircraft.instance;
            if (t_cache.zeroThrustAltitude === null && ac.definition?.zeroThrustAltitude !== undefined) t_cache.zeroThrustAltitude = ac.definition.zeroThrustAltitude;
            if (t_cache.zeroRPMAltitude === null && ac.definition?.zeroRPMAltitude !== undefined) t_cache.zeroRPMAltitude = ac.definition.zeroRPMAltitude;
            if (ac.definition) { ac.definition.zeroThrustAltitude = window.opCeiling; ac.definition.zeroRPMAltitude = window.opCeiling; }
        }
        globalThis.isCeilingActive = true;
        if (window.V40_NOTIF) window.V40_NOTIF.success(`Ceiling Bypassed: ${overpoweredEnginesSuite.formatNumberCompact(window.opCeiling)} ft`);
        overpoweredEnginesSuite.updatePhysicsUI();
    }

    /**
     * Physics Engine: Atmospheric Restoration.
     * Restores original atmospheric limits to aircraft engines.
     */
    function removeCeiling() {
        if (geofs?.aircraft?.instance) {
            const ac = geofs.aircraft.instance;
            if (ac.definition) {
                if (t_cache.zeroThrustAltitude !== null) ac.definition.zeroThrustAltitude = t_cache.zeroThrustAltitude;
                if (t_cache.zeroRPMAltitude !== null) ac.definition.zeroRPMAltitude = t_cache.zeroRPMAltitude;
            }
        }
        globalThis.isCeilingActive = false;
        if (window.V40_NOTIF) window.V40_NOTIF.info("Standard Atmospheric Limits Restored.");
        overpoweredEnginesSuite.updatePhysicsUI();
    }

    /**
     * Stability System: Torque Suppression.
     * Suppresses torque values on all engines to keep flight trajectory steady.
     */
    function applyTorqueSuppression() {
        if (!geofs?.aircraft?.instance?.parts) return;
        for (const u in geofs.aircraft.instance.parts) {
            const s = geofs.aircraft.instance.parts[u];
            if (s?.torque !== undefined) {
                if (t_cache.torque[u] === undefined) t_cache.torque[u] = s.torque;
                s.torque = 0;
            }
        }
    }

    /**
     * Stability System: Torque Restoration.
     * Restores cached torque limits back to standard aircraft engines.
     */
    function restoreTorque() {
        if (!geofs?.aircraft?.instance?.parts) return;
        for (const u in t_cache.torque) {
            if (geofs.aircraft.instance.parts[u]) geofs.aircraft.instance.parts[u].torque = t_cache.torque[u];
        }
        t_cache.torque = {};
    }

    // Initialize
    overpoweredEnginesSuite.createUI();
    window.overpoweredEnginesSuite = overpoweredEnginesSuite;
    document.addEventListener("keydown", (e) => overpoweredEnginesSuite.handleKeyPress(e));

    if (window.V40_NOTIF) {
        window.V40_NOTIF.success("GeoFS-V4.0_Overpowered-Engines v0.1.0 Loaded.");
    }

    const checkInterval = setInterval(() => {
        if (window.GeoFSV4Core.state !== "ready") {
            clearInterval(checkInterval);
            return;
        }
        const aircraft = geofs?.aircraft?.instance || null;
        if (aircraft !== lastAircraft) {
            t_cache = { thrust: {}, zeroThrustAltitude: null, zeroRPMAltitude: null, torque: {} };
            globalThis.isThrustActive = false; globalThis.isCeilingActive = false;
            lastAircraft = aircraft;
            if (globalThis.isSASActive) applyTorqueSuppression();
            overpoweredEnginesSuite.updatePhysicsUI();
        }
    }, 1000);

    // SAS Ticker loop (50Hz)
    const sasInterval = setInterval(() => {
        if (window.GeoFSV4Core.state !== "ready") {
            clearInterval(sasInterval);
            return;
        }
        overpoweredEnginesSuite.tickSAS();
    }, 20);

    if (window.GeoFSV4Core.state !== "ready") return;

    const autopilotBar = document.getElementsByClassName("geofs-autopilot-bar")[0];
    if (autopilotBar && !document.getElementById("opModBtn")) {
        const bar = document.createElement("div");
        bar.className = "ext-op-bar";
        bar.style.cssText = "white-space: nowrap; display: flex; align-items: flex-start; pointer-events: all;";
        
        const btn = document.createElement("div"); 
        btn.id = "opModBtn"; 
        btn.className = "control-pad";
        btn.style.cssText = "width: 90px; height: 25px; margin: 0px 10px; border-radius: 15px; cursor: pointer !important; border: 1px solid #888; background-color: #000; box-shadow: 0px 0px 5px #000;";
        
        btn.innerHTML = '<div class="control-pad-label transp-pad" style="pointer-events: none; text-align: center; line-height: 25px;">OP ENGINES</div>';
        btn.onclick = () => window.toggleOpEngineUI(); 
        
        bar.appendChild(btn);
        autopilotBar.appendChild(bar);
    }
    }
    window.GeoFSV4Core.initialize('Overpowered-Engines', main).catch(() => {});
})();
