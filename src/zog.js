/**
 * Zog.js v2.0
 * Full reactivity with minimal code size
 * Fixed: Complete array reactivity support
 */

// --- Reactivity Core ---
let activeEffect = null;
const effectStack = [];

class Dep {
    subs = new Set();
    depend() {
        if (activeEffect && !this.subs.has(activeEffect)) {
            this.subs.add(activeEffect);
            activeEffect.deps.push(this);
        }
    }
    notify() {
        this.subs.forEach(e => {
            if (e.scheduler) e.scheduler(e.run.bind(e));
            else e.run();
        });
    }
}

class ReactiveEffect {
    constructor(fn, scheduler = null) {
        this.fn = fn;
        this.scheduler = scheduler;
        this.deps = [];
        this.active = true;
    }

    run() {
        if (!this.active) return;
        try {
            effectStack.push(this);
            activeEffect = this;
            return this.fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    }

    stop() {
        if (this.active) {
            this.deps.forEach(d => d.subs.delete(this));
            this.deps = [];
            this.active = false;
        }
    }
}

export const watchEffect = (fn, opts = {}) => {
    const effect = new ReactiveEffect(fn, opts.scheduler);
    effect.run();
    return () => effect.stop();
};

// --- Deep Reactivity ---
const RAW = Symbol('raw');
const IS_REACTIVE = Symbol('isReactive');
const IS_ARRAY = Symbol('isArray');
const reactiveMap = new WeakMap();
const isObj = v => v && typeof v === 'object';

// Array methods that mutate the array
const arrayMutatingMethods = [
    'push', 'pop', 'shift', 'unshift', 
    'splice', 'sort', 'reverse', 'fill', 'copyWithin'
];

// Array methods that need tracking
const arrayTrackingMethods = [
    'includes', 'indexOf', 'lastIndexOf',
    'find', 'findIndex', 'some', 'every',
    'filter', 'map', 'forEach', 'reduce', 'reduceRight',
    'flat', 'flatMap', 'join', 'slice', 'concat'
];

export const reactive = target => {
    if (!isObj(target) || target[IS_REACTIVE]) return target;

    const existing = reactiveMap.get(target);
    if (existing) return existing;

    const isArray = Array.isArray(target);
    const depsMap = new Map();
    
    // A single dep for the entire array/object (for iteration and length)
    const iterationDep = new Dep();
    
    const getDep = k => {
        let d = depsMap.get(k);
        if (!d) { d = new Dep(); depsMap.set(k, d); }
        return d;
    };

    // Create overridden methods for arrays
    const createArrayInstrumentations = () => {
        const instrumentations = {};

        // Mutating methods - should notify all subscribers
        arrayMutatingMethods.forEach(method => {
            instrumentations[method] = function(...args) {
                // Access the raw array
                const rawTarget = this[RAW];
                
                // Execute the original method
                const result = rawTarget[method].apply(rawTarget, args);
                
                // Notify for changes
                iterationDep.notify();
                getDep('length').notify();
                
                return result;
            };
        });

        // Tracking methods - should create dependencies
        arrayTrackingMethods.forEach(method => {
            instrumentations[method] = function(...args) {
                // Track the entire array
                iterationDep.depend();
                getDep('length').depend();
                
                const rawTarget = this[RAW];
                
                // If arguments are reactive, use their raw version
                const rawArgs = args.map(arg => {
                    if (isObj(arg) && arg[IS_REACTIVE]) {
                        return arg[RAW];
                    }
                    return arg;
                });
                
                const result = rawTarget[method].apply(rawTarget, rawArgs);
                
                // Make result reactive if needed
                if (isObj(result) && !result[IS_REACTIVE]) {
                    return reactive(result);
                }
                return result;
            };
        });

        return instrumentations;
    };

    const arrayInstrumentations = isArray ? createArrayInstrumentations() : null;

    const proxy = new Proxy(target, {
        get: (t, k, receiver) => {
            // Special symbols
            if (k === IS_REACTIVE) return true;
            if (k === RAW) return t;
            if (k === IS_ARRAY) return isArray;

            // If it's an array and we have an overridden method
            if (isArray && arrayInstrumentations && k in arrayInstrumentations) {
                return arrayInstrumentations[k].bind(receiver);
            }

            // For array length, track both itself and iteration
            if (isArray && k === 'length') {
                getDep('length').depend();
                iterationDep.depend();
                return t.length;
            }

            // For Symbol.iterator
            if (k === Symbol.iterator) {
                iterationDep.depend();
                return function* () {
                    const len = t.length;
                    for (let i = 0; i < len; i++) {
                        const val = t[i];
                        yield isObj(val) ? reactive(val) : val;
                    }
                };
            }

            const dep = getDep(k);
            dep.depend();
            
            const res = Reflect.get(t, k, receiver);

            // If it's a ref, return directly
            if (res && res._isRef) return res;
            
            // Make nested objects reactive
            return isObj(res) ? reactive(res) : res;
        },

        set: (t, k, v, receiver) => {
            const old = t[k];
            const hadKey = isArray ? Number(k) < t.length : k in t;
            
            // If new value is reactive, store its raw version
            const rawValue = isObj(v) && v[IS_REACTIVE] ? v[RAW] : v;
            const res = Reflect.set(t, k, rawValue, receiver);

            if (!Object.is(old, rawValue)) {
                getDep(k).notify();
                
                // If a new key was added or length changed
                if (!hadKey || (isArray && k === 'length')) {
                    iterationDep.notify();
                    if (isArray) getDep('length').notify();
                }
            }

            return res;
        },

        deleteProperty: (t, k) => {
            const had = k in t;
            const res = Reflect.deleteProperty(t, k);
            if (had) {
                getDep(k).notify();
                iterationDep.notify();
            }
            return res;
        },

        // For for...in loops
        ownKeys: (t) => {
            iterationDep.depend();
            return Reflect.ownKeys(t);
        },

        // For 'in' operator
        has: (t, k) => {
            iterationDep.depend();
            getDep(k).depend();
            return Reflect.has(t, k);
        }
    });

    reactiveMap.set(target, proxy);
    return proxy;
};

export const ref = val => {
    const dep = new Dep();
    return {
        _isRef: true,
        get value() { dep.depend(); return val; },
        set value(v) { if (!Object.is(v, val)) { val = v; dep.notify(); } },
        toString: () => String(val)
    };
};

// Ref for arrays with full support
export const refArray = initialArray => {
    const arr = reactive(Array.isArray(initialArray) ? [...initialArray] : []);
    return {
        _isRef: true,
        _isArrayRef: true,
        get value() { return arr; },
        set value(v) {
            // Clear current array and add new items
            arr.length = 0;
            if (Array.isArray(v)) {
                arr.push(...v);
            }
        },
        // Helper methods
        push: (...items) => arr.push(...items),
        pop: () => arr.pop(),
        shift: () => arr.shift(),
        unshift: (...items) => arr.unshift(...items),
        splice: (...args) => arr.splice(...args),
        sort: (fn) => arr.sort(fn),
        reverse: () => arr.reverse(),
        toString: () => String(arr)
    };
};

export const computed = getter => {
    let value, dirty = true;
    const dep = new Dep();
    const effect = new ReactiveEffect(getter, () => {
        if (!dirty) { dirty = true; dep.notify(); }
    });

    return {
        _isRef: true,
        get value() {
            if (dirty) { value = effect.run(); dirty = false; }
            dep.depend();
            return value;
        },
        _effect: effect
    };
};

// Watch function for observing changes
export const watch = (source, callback, options = {}) => {
    let getter;
    let oldValue;
    
    if (typeof source === 'function') {
        getter = source;
    } else if (source._isRef) {
        getter = () => source.value;
    } else if (isObj(source)) {
        getter = () => traverse(source);
    } else {
        getter = () => source;
    }

    const job = () => {
        const newValue = effect.run();
        if (options.deep || !Object.is(newValue, oldValue)) {
            callback(newValue, oldValue);
            oldValue = newValue;
        }
    };

    const effect = new ReactiveEffect(getter, job);
    
    if (options.immediate) {
        job();
    } else {
        oldValue = effect.run();
    }

    return () => effect.stop();
};

// Helper function to traverse object
const traverse = (value, seen = new Set()) => {
    if (!isObj(value) || seen.has(value)) return value;
    seen.add(value);
    
    if (Array.isArray(value)) {
        value.forEach(item => traverse(item, seen));
    } else {
        Object.keys(value).forEach(key => traverse(value[key], seen));
    }
    
    return value;
};

// --- Component Scope ---
class Scope {
    constructor(data) {
        this.data = data;
        this.effects = [];
        this.listeners = [];
    }

    addEffect(stop) { this.effects.push(stop); }
    addListener(el, ev, fn) { this.listeners.push({ el, ev, fn }); }

    cleanup() {
        this.effects.forEach(s => s());
        this.listeners.forEach(({el, ev, fn}) => el.removeEventListener(ev, fn));
        this.effects = [];
        this.listeners = [];
    }
}

// --- Expression Evaluator ---
const evalExp = (exp, scope) => {
    try {
        const keys = Object.keys(scope);
        const vals = keys.map(k => {
            const v = scope[k];
            if (v?._isRef) return v.value;
            return v;
        });
        return Function(...keys, `"use strict";return(${exp})`)(...vals);
    } catch (err) {
        if (typeof console !== 'undefined') console.error('evalExp error:', err, 'exp:', exp);
        return undefined;
    }
};

// --- Compiler ---
const compile = (el, scope, cs) => {
    if (!el) return;

    // Text nodes
    if (el.nodeType === 3) {
        const txt = el.textContent;
        if (txt.includes('{{')) {
            cs.addEffect(watchEffect(() => {
                el.textContent = txt.replace(/{{\s*(.*?)\s*}}/g, (_, e) => evalExp(e, scope) ?? '');
            }));
        }
        return;
    }

    if (el.nodeType !== 1) return;

    // z-if
    if (el.hasAttribute('z-if')) {
        const branches = [];
        let curr = el, parent = el.parentNode;
        if (!parent) return;

        const ph = document.createComment('z-if');
        parent.insertBefore(ph, el);

        while (curr) {
            const type = ['z-if', 'z-else-if', 'z-else'].find(t => curr.hasAttribute(t));
            if (!type) break;
            const exp = curr.getAttribute(type);
            curr.removeAttribute(type);
            branches.push({ el: curr, exp, type, scope: null });
            const next = curr.nextElementSibling;
            curr.remove();
            curr = next;
        }

        cs.addEffect(watchEffect(() => {
            const match = branches.find(b => b.type === 'z-else' || evalExp(b.exp, scope));
            branches.forEach(b => {
                if (b === match) {
                    if (!b.el.parentNode) {
                        parent.insertBefore(b.el, ph);
                        if (!b.scope) {
                            b.scope = new Scope({ ...scope });
                            compile(b.el, b.scope.data, b.scope);
                        }
                    }
                } else {
                    if (b.el.parentNode) b.el.remove();
                    if (b.scope) { b.scope.cleanup(); b.scope = null; }
                }
            });
        }));

        cs.addEffect(() => branches.forEach(b => b.scope?.cleanup()));
        return;
    }

    if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;

    // z-for with better array support
    if (el.hasAttribute('z-for')) {
        const rawFor = el.getAttribute('z-for');
        const forMatch = rawFor.match(/^\s*(?:\((\w+)\s*,\s*(\w+)\)|(?:(\w+)))\s+(?:in|of)\s+(.*)$/);
        let itemName = 'item', indexName = 'index', listExp = rawFor;
        
        if (forMatch) {
            itemName = forMatch[1] || forMatch[3] || 'item';
            indexName = forMatch[2] || 'index';
            listExp = forMatch[4];
        } else {
            const parts = rawFor.split(/\s+in\s+|\s+of\s+/);
            if (parts.length === 2) {
                itemName = parts[0].trim();
                listExp = parts[1].trim();
            }
        }

        const parent = el.parentNode;
        if (!parent) return;

        const ph = document.createComment('z-for');
        parent.insertBefore(ph, el);
        el.remove();
        el.removeAttribute('z-for');

        let items = [];
        
        // Function to handle array updates
        const updateList = () => {
            // Cleanup previous items
            items.forEach(({clone, scope: s}) => { 
                clone.remove(); 
                s.cleanup(); 
            });
            items = [];

            // Get new array
            let arr = evalExp(listExp, scope);
            
            // If it's a ref, get its value
            if (arr && arr._isRef) {
                arr = arr.value;
            }
            
            // Don't use RAW for reactive arrays to preserve reactivity
            if (!arr) arr = [];
            if (!Array.isArray(arr)) arr = [];

            arr.forEach((v, i) => {
                const clone = el.cloneNode(true);
                parent.insertBefore(clone, ph);
                
                // Create refs for item and index
                const itemRef = ref(v);
                const indexRef = ref(i);
                
                const s = new Scope({ 
                    ...scope, 
                    [itemName]: itemRef, 
                    [indexName]: indexRef 
                });
                
                compile(clone, s.data, s);
                items.push({ clone, scope: s, itemRef, indexRef });
            });
        };

        cs.addEffect(watchEffect(updateList));
        cs.addEffect(() => items.forEach(({scope: s}) => s.cleanup()));
        return;
    }

    // Directives
    Array.from(el.attributes).forEach(({ name, value }) => {
        // Events
        if (name.startsWith('@') || name.startsWith('z-on:')) {
            const ev = name.startsWith('@') ? name.slice(1) : name.slice(5);
            el.removeAttribute(name);
            const fn = e => {
                const handler = scope[value];
                typeof handler === 'function' ? handler(e) : evalExp(value, scope);
            };
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
        }
        // z-model
        else if (name === 'z-model') {
            el.removeAttribute(name);
            const isCheck = el.type === 'checkbox' || el.type === 'radio';
            const prop = isCheck ? 'checked' : 'value';
            const ev = isCheck || el.tagName === 'SELECT' ? 'change' : 'input';

            const fn = () => {
                const val = el[prop];
                if (el.type === 'radio' && !el.checked) return;
                const target = scope[value];
                if (target?._isRef) target.value = val;
                else if (scope[value] !== undefined) scope[value] = val;
            };

            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                el.type === 'radio' ? el.checked = String(el.value) === String(res) : el[prop] = res;
            }));
        }
        // Bindings
        else if (name.startsWith(':') || name.startsWith('z-')) {
            const attr = name.startsWith(':') ? name.slice(1) : name;
            el.removeAttribute(name);
            const staticClass = attr === 'class' ? el.className : '';

            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                if (attr === 'z-text') el.textContent = res ?? '';
                else if (attr === 'z-html') el.innerHTML = res ?? '';
                else if (attr === 'z-show') el.style.display = res ? '' : 'none';
                else if (attr === 'style' && isObj(res)) Object.assign(el.style, res);
                else if (attr === 'class' && isObj(res)) {
                    const dynamic = Object.keys(res).filter(k => res[k]).join(' ');
                    el.className = (staticClass + ' ' + dynamic).trim();
                } else {
                    const setName = attr.startsWith('z-') ? attr.slice(2) : attr;
                    el.setAttribute(setName, res ?? '');
                }
            }));
        }
    });

    Array.from(el.childNodes).forEach(child => compile(child, scope, cs));
};

// --- Router ---
const isBrowser = typeof window !== 'undefined';
const getQuery = () => isBrowser ? Object.fromEntries(new URLSearchParams(location.search)) : {};

const _r = {
    h: ref(isBrowser ? location.hash : ''),
    p: ref(isBrowser ? location.pathname : ''),
    q: ref(isBrowser ? getQuery() : {})
};

const sync = () => {
    if (!isBrowser) return;
    _r.h.value = location.hash;
    _r.p.value = location.pathname;
    _r.q.value = getQuery();
};

if (isBrowser) {
    addEventListener('hashchange', sync);
    addEventListener('popstate', sync);
}

export const route = {
    get hash() { return _r.h.value; },
    get path() { return _r.p.value; },
    get query() { return _r.q.value; }
};

// --- App ---
export const createApp = setup => {
    let rootScope = null;
    return {
        mount(sel) {
            const root = document.querySelector(sel);
            if (!root) return console.error(`Target not found: ${sel}`);
            const data = setup();
            rootScope = new Scope(data);
            compile(root, data, rootScope);
            return this;
        },
        unmount() {
            if (rootScope) { rootScope.cleanup(); rootScope = null; }
        }
    };
};

// --- Utils ---
export const nextTick = fn => Promise.resolve().then(fn);
export const unref = v => v?._isRef ? v.value : v;
export const toRef = (obj, key) => {
    const val = obj[key];
    if (val?._isRef) return val;
    return {
        _isRef: true,
        get value() { return obj[key]; },
        set value(v) { obj[key] = v; }
    };
};

// Helper function to access the raw object
export const toRaw = (observed) => {
    return observed && observed[RAW] ? observed[RAW] : observed;
};

// Function to check if value is reactive
export const isReactive = (value) => {
    return value ? !!value[IS_REACTIVE] : false;
};

// Function to check if value is a ref
export const isRef = (value) => {
    return value ? !!value._isRef : false;
};

// Object to access symbols
export const symbols = { RAW, IS_REACTIVE, IS_ARRAY };