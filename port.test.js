const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Lightweight DOM shim without external dependencies
function createMockElement(tagName) {
    const children = [];
    const listeners = {};
    return {
        tagName: tagName.toUpperCase(),
        children,
        style: {},
        attributes: {},
        innerHTML: '',
        value: '',
        id: '',
        className: '',
        textContent: '',
        appendChild(child) {
            children.push(child);
            return child;
        },
        setAttribute(name, val) {
            this.attributes[name] = String(val);
        },
        getAttribute(name) {
            return this.attributes[name] || null;
        },
        addEventListener(event, fn) {
            listeners[event] = listeners[event] || [];
            listeners[event].push(fn);
        },
        dispatchEvent(event) {
            const handlers = listeners[event.type] || [];
            handlers.forEach(fn => fn(event));
        },
        click() {
            if (this.onclick) this.onclick();
            this.dispatchEvent({ type: 'click' });
        }
    };
}

const elementsById = new Map();
const autopilotBar = createMockElement('div');
autopilotBar.className = 'geofs-autopilot-bar';

const documentMock = {
    createElement(tag) {
        return createMockElement(tag);
    },
    getElementById(id) {
        return elementsById.get(id) || null;
    },
    getElementsByClassName(className) {
        if (className === 'geofs-autopilot-bar') return [autopilotBar];
        return [];
    },
    querySelector(sel) {
        if (sel === '#opModBtn') return elementsById.get('opModBtn') || null;
        if (sel === '#opEngineCard') return elementsById.get('opEngineCard') || null;
        return null;
    },
    querySelectorAll() {
        return [];
    },
    addEventListener(event, fn) {
        eventListeners[event] = eventListeners[event] || [];
        eventListeners[event].push(fn);
    },
    dispatchEvent(event) {
        const handlers = eventListeners[event.type] || [];
        handlers.forEach(fn => fn(event));
    },
    body: createMockElement('body')
};

const eventListeners = {};

const part = { thrust: 100, afterBurnerThrust: 0, reverseThrust: 0, torque: 3 };
const ac = {
    parts: { engine: part },
    definition: { zeroThrustAltitude: 1000, zeroRPMAltitude: 2000 },
    rigidBody: {
        setAngularVelocity() {},
        getAngularVelocity() { return [1, 1, 1]; }
    }
};

const storage = {};
const localStorageMock = {
    getItem(k) { return storage[k] ?? null; },
    setItem(k, v) { storage[k] = String(v); },
    removeItem(k) { delete storage[k]; }
};

const sandbox = {
    window: {},
    globalThis: {},
    document: documentMock,
    localStorage: localStorageMock,
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: () => 1,
    clearInterval: () => {},
    console: console,
    CustomEvent: class CustomEvent {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
        }
    }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.geofs = {
    version: '4.0',
    aircraft: { instance: ac },
    animation: { values: {} }
};
sandbox.V40_NOTIF = {
    success() {},
    warn() {},
    info() {},
    critical() {},
    show() {}
};

// Intercept elements created and added with IDs
const origCreate = documentMock.createElement;
documentMock.createElement = function(tag) {
    const el = origCreate(tag);
    return new Proxy(el, {
        set(target, prop, value) {
            target[prop] = value;
            if (prop === 'id' && value) {
                elementsById.set(value, target);
            }
            return true;
        }
    });
};

const scriptCode = fs.readFileSync(__dirname + '/overpowered-engines_standalone.user.js', 'utf8');
vm.runInNewContext(scriptCode, sandbox);

// Verification assertions
assert.ok(sandbox.overpoweredEnginesSuite, 'overpoweredEnginesSuite should be registered on window');
assert.equal(typeof sandbox.toggleOpEngineUI, 'function', 'toggleOpEngineUI should be defined');
assert.equal(typeof sandbox.toggleThrustMode, 'function', 'toggleThrustMode should be defined');
assert.equal(typeof sandbox.toggleCeilingMode, 'function', 'toggleCeilingMode should be defined');
assert.equal(typeof sandbox.toggleSASMode, 'function', 'toggleSASMode should be defined');

// Verify UI toggle
sandbox.toggleOpEngineUI();
assert.equal(sandbox.overpoweredEnginesSuite.createUI !== undefined, true);

// Verify Thrust scaling
sandbox.opMultiplier = 2;
sandbox.toggleThrustMode();
assert.equal(part.thrust, 200);

// Verify V40_opMultiplierUpdated event
sandbox.opMultiplier = 3;
sandbox.document.dispatchEvent(new sandbox.CustomEvent('V40_opMultiplierUpdated', { detail: { value: 3 } }));
assert.equal(part.thrust, 300);

// Toggle Thrust off
sandbox.toggleThrustMode();
assert.equal(part.thrust, 100);

// Verify Ceiling toggle
sandbox.toggleCeilingMode();
assert.equal(ac.definition.zeroThrustAltitude, 3000000);
sandbox.toggleCeilingMode();
assert.equal(ac.definition.zeroThrustAltitude, 1000);

// Verify SAS toggle
sandbox.toggleSASMode();
assert.equal(part.torque, 0);
sandbox.toggleSASMode();
assert.equal(part.torque, 3);

console.log('✔ All OP Engines V4.0 port checks passed successfully (self-contained shim without external jsdom).');
