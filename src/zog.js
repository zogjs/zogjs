/**
 * Zog.js v0.4.1 - Full reactivity with minimal code size + Hook System
 * Fixes: error handling, z-for index bug, beforeEffect hook
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
        new Set(this.subs).forEach(e => {
            if (e !== activeEffect) e.scheduler ? e.scheduler(e.run.bind(e)) : queueEffect(e);
        });
    }
}

let effectQueue = [], isFlushing = false;

const queueEffect = effect => {
    if (!effectQueue.includes(effect)) {
        effectQueue.push(effect);
        if (!isFlushing) { isFlushing = true; Promise.resolve().then(flushEffects); }
    }
};

const flushEffects = () => {
    try {
        for (let i = 0; i < effectQueue.length; i++) {
            const e = effectQueue[i];
            if (e.active) try { e.run(); } catch (err) { console.error?.('Effect error:', err); runHooks('onError', err, 'effect', e); }
        }
    } finally {
        effectQueue.length = 0;
        isFlushing = false;
    }
};

let effectId = 0;

class ReactiveEffect {
    constructor(fn, scheduler = null) {
        this.id = effectId++;
        this.fn = fn;
        this.scheduler = scheduler;
        this.deps = [];
        this.active = true;
    }
    run() {
        if (!this.active) return this.fn();
        this.cleanup();
        try {
            effectStack.push(this);
            activeEffect = this;
            runHooks('beforeEffect', this);
            return this.fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    }
    stop() {
        if (this.active) {
            this.cleanup();
            this.active = false;
        }
    }
    cleanup() {
        for (const dep of this.deps) dep.subs.delete(this);
        this.deps.length = 0;
    }
}

export const watchEffect = (fn, opts = {}) => {
    const effect = new ReactiveEffect(fn, opts.scheduler);
    effect.run();
    return () => effect.stop();
};

// --- Deep Reactivity ---
const RAW = Symbol('raw'), IS_REACTIVE = Symbol('isReactive');
const reactiveMap = new WeakMap();
const isObj = v => v && typeof v === 'object';

const arrayMutators = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
const arrayIterators = new Set(['includes', 'indexOf', 'lastIndexOf', 'find', 'findIndex', 'findLast', 'findLastIndex', 'every', 'some', 'forEach', 'map', 'filter', 'reduce', 'reduceRight', 'flat', 'flatMap', 'values', 'entries', 'keys', Symbol.iterator]);

export const reactive = target => {
    if (!isObj(target) || target[IS_REACTIVE]) return target;
    const existing = reactiveMap.get(target);
    if (existing) return existing;

    const isArray = Array.isArray(target);
    const depsMap = new Map(), iterationDep = new Dep();
    const getDep = k => { let d = depsMap.get(k); return d || (depsMap.set(k, d = new Dep()), d); };

    const createArrayMethod = method => {
        const isMut = arrayMutators.has(method);
        const isIter = arrayIterators.has(method);

        return function (...args) {
            const raw = this[RAW];

            // Track iteration
            if (!isMut && isIter) iterationDep.depend();

            let res;
            if (method === 'includes' || method === 'indexOf' || method === 'lastIndexOf') {
                const dep = getDep('length');
                dep.depend();
                for (let i = 0; i < raw.length; i++) getDep(String(i)).depend();
                const targetVal = args[0];
                const wrapped = targetVal && targetVal[RAW] ? targetVal[RAW] : targetVal;
                res = Array.prototype[method].call(raw, wrapped, ...args.slice(1));
            } else {
                res = Array.prototype[method].apply(raw, args);
            }

            if (isMut) {
                iterationDep.notify();
                getDep('length').notify();
                if (method === 'sort' || method === 'reverse')
                    for (let i = 0; i < raw.length; i++) getDep(String(i)).notify();
            }

            return isObj(res) && !res[IS_REACTIVE] ? reactive(res) : res;
        };
    };

    const arrayMethods = isArray ? Object.fromEntries([...arrayMutators, ...arrayIterators].map(m => [m, createArrayMethod(m)])) : null;

    const proxy = new Proxy(target, {
        get(t, k, r) {
            if (k === RAW) return t;
            if (k === IS_REACTIVE) return true;
            if (isArray && arrayMethods && k in arrayMethods) return arrayMethods[k];

            const dep = getDep(k);
            dep.depend();
            const res = Reflect.get(t, k, r);
            return isObj(res) ? (res[IS_REACTIVE] ? res : reactive(res)) : res;
        },
        set(t, k, v, r) {
            const old = t[k];
            const hadKey = Object.prototype.hasOwnProperty.call(t, k);
            const res = Reflect.set(t, k, v, r);
            if (!hadKey || !Object.is(old, v)) {
                const dep = getDep(k);
                dep.notify();
                if (isArray && (k === 'length' || String(+k) === k)) iterationDep.notify();
            }
            return res;
        },
        deleteProperty(t, k) {
            const hadKey = Object.prototype.hasOwnProperty.call(t, k);
            const res = Reflect.deleteProperty(t, k);
            if (hadKey) {
                const dep = getDep(k);
                dep.notify();
                if (isArray) iterationDep.notify();
            }
            return res;
        },
        ownKeys(t) {
            iterationDep.depend();
            return Reflect.ownKeys(t);
        },
        has(t, k) {
            const dep = getDep(k);
            dep.depend();
            return Reflect.has(t, k);
        }
    });

    reactiveMap.set(target, proxy);
    return proxy;
};

// --- ref / computed ---
export const ref = val => {
    let v = isObj(val) && !val[IS_REACTIVE] ? reactive(val) : val;
    const dep = new Dep();
    return {
        _isRef: true,
        get value() { dep.depend(); return v; },
        set value(nv) {
            const next = isObj(nv) && !nv[IS_REACTIVE] ? reactive(nv) : nv;
            if (!Object.is(next, v)) { v = next; dep.notify(); }
        },
        toString: () => String(v)
    };
};

export const computed = getter => {
    let value, dirty = true;
    const dep = new Dep();
    const effect = new ReactiveEffect(getter, () => { if (!dirty) { dirty = true; dep.notify(); } });
    return {
        _isRef: true,
        get value() { if (dirty) { value = effect.run(); dirty = false; } dep.depend(); return value; },
        _effect: effect
    };
};

// --- Component Scope ---
class Scope {
    constructor(data) { this.data = data; this.effects = []; this.listeners = []; }
    addEffect(stop) { this.effects.push(stop); }
    addListener(el, ev, fn) { this.listeners.push({ el, ev, fn }); }
    cleanup() {
        this.effects.forEach(stop => stop && stop());
        this.effects.length = 0;
        this.listeners.forEach(({ el, ev, fn }) => el.removeEventListener(ev, fn));
        this.listeners.length = 0;
    }
}

// --- Expression Eval with Caching ---
const expCache = new Map();

const evalExp = (exp, scope) => {
    try {
        const keys = Object.keys(scope);
        const cacheKey = exp + '|' + keys.join(',');
        let cached = expCache.get(cacheKey);
        if (!cached) {
            cached = Function(...keys, `"use strict";return(${exp})`);
            if (expCache.size > 200) expCache.delete(expCache.keys().next().value);
            expCache.set(cacheKey, cached);
        }
        return cached(...keys.map(k => { const v = scope[k]; return v?._isRef ? v.value : v; }));
    } catch { return undefined; }
};

// --- Hook System ---
const hooks = {
    beforeCompile: [],
    afterCompile: [],
    beforeEffect: [],
    onError: []
};

export const addHook = (name, fn) => {
    if (!hooks[name]) hooks[name] = [];
    hooks[name].push(fn);
};

export const removeHook = (name, fn) => {
    if (!hooks[name]) return;
    hooks[name] = hooks[name].filter(h => h !== fn);
};

const runHooks = (name, ...args) => {
    if (!hooks[name]) return false;
    try {
        return hooks[name].some(fn => fn(...args) === false);
    } catch (err) {
        runHooks('onError', err, name, args);
        return false;
    }
};

// --- Compiler ---
export const compile = (el, scope, cs) => {
    if (!el) return;

    if (el.nodeType === 3) {
        const txt = el.textContent;
        if (!txt || !txt.includes('{{')) return;
        const original = txt;
        cs.addEffect(watchEffect(() => {
            el.textContent = original.replace(/{{\s*(.*?)\s*}}/g, (_, e) => {
                const res = evalExp(e, scope);
                return res == null ? '' : res;
            });
        }));
        return;
    }
    if (el.nodeType !== 1) return;

    if (runHooks('beforeCompile', el, scope, cs)) return;

    // z-if / z-else-if / z-else
    if (el.hasAttribute('z-if')) {
        const branches = [], parent = el.parentNode;
        if (!parent) return;
        const ph = document.createComment('z-if');
        parent.insertBefore(ph, el);

        let curr = el;
        while (curr) {
            const type = ['z-if', 'z-else-if', 'z-else'].find(t => curr.hasAttribute(t));
            if (!type) break;
            const exp = curr.getAttribute(type);
            curr.removeAttribute(type);
            branches.push({ template: curr.cloneNode(true), exp, type, el: null, scope: null });
            const next = curr.nextElementSibling;
            parent.removeChild(curr);
            curr = next;
        }

        const update = () => {
            let chosen = null;
            for (const b of branches) {
                if (b.type === 'z-else' || evalExp(b.exp, scope)) { chosen = b; break; }
            }

            branches.forEach(b => {
                if (b === chosen) {
                    if (!b.el) {
                        b.el = b.template.cloneNode(true);
                        b.scope = new Scope({ ...scope });
                        parent.insertBefore(b.el, ph.nextSibling);
                        compile(b.el, b.scope.data, b.scope);
                    }
                } else {
                    if (b.el?.parentNode) b.el.parentNode.removeChild(b.el);
                    if (b.scope) { b.scope.cleanup(); b.scope = null; b.el = null; }
                }
            });
        };

        cs.addEffect(watchEffect(update));
        cs.addEffect(() => branches.forEach(b => b.scope?.cleanup()));
        runHooks('afterCompile', el, scope, cs);
        return;
    }

    if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;

    // z-for
    if (el.hasAttribute('z-for')) {
        const rawFor = el.getAttribute('z-for');
        const forMatch = rawFor.match(/^\s*(?:\((\w+)\s*,\s*(\w+)\)|(\w+))\s+(?:in|of)\s+(.*)$/);
        let itemName = 'item', indexName = 'index', listExp = rawFor;

        if (forMatch) { itemName = forMatch[1] || forMatch[3]; indexName = forMatch[2] || 'index'; listExp = forMatch[4]; }
        else {
            const p = rawFor.split(/\s+(?:in|of)\s+/);
            if (p.length === 2) { itemName = p[0].trim(); listExp = p[1].trim(); }
        }

        const parent = el.parentNode;
        if (!parent) return;
        const ph = document.createComment('z-for');
        parent.insertBefore(ph, el);
        el.remove();
        el.removeAttribute('z-for');

        const keyAttr = el.getAttribute(':key') || el.getAttribute('z-key');
        if (keyAttr) { el.removeAttribute(':key'); el.removeAttribute('z-key'); }

        let itemsMap = new Map();

        const updateList = () => {
            let arr = evalExp(listExp, scope);
            if (arr?._isRef) arr = arr.value;
            if (!Array.isArray(arr)) arr = [];

            const newItemsMap = new Map(), newKeys = [];
            arr.forEach((v, i) => {
                const key = '_' + (keyAttr ? evalExp(keyAttr, { ...scope, [itemName]: { _isRef: true, value: v }, [indexName]: i }) : i);
                newKeys.push(key);
                const existing = itemsMap.get(key);
                const val = isObj(v) ? reactive(v) : v;

                if (existing) {
                    existing.itemRef.value = val;
                    existing.indexRef.value = i;
                    newItemsMap.set(key, existing);
                } else {
                    const clone = el.cloneNode(true), itemRef = ref(val), indexRef = ref(i);
                    const s = new Scope({ ...scope, [itemName]: itemRef, [indexName]: indexRef });
                    compile(clone, s.data, s);
                    newItemsMap.set(key, { clone, scope: s, itemRef, indexRef });
                }
            });

            for (const [key, item] of itemsMap) if (!newItemsMap.has(key)) { item.clone.remove(); item.scope.cleanup(); }

            let prevNode = ph;
            for (const key of newKeys) {
                const item = newItemsMap.get(key);
                if (item.clone.previousSibling !== prevNode) parent.insertBefore(item.clone, prevNode.nextSibling);
                prevNode = item.clone;
            }
            itemsMap = newItemsMap;
        };

        cs.addEffect(watchEffect(updateList));
        cs.addEffect(() => { for (const item of itemsMap.values()) item.scope.cleanup(); itemsMap.clear(); });
        runHooks('afterCompile', el, scope, cs);
        return;
    }

    // Directives
    for (const { name, value } of [...el.attributes]) {
        if (name.startsWith('@') || name.startsWith('z-on:')) {
            const ev = name[0] === '@' ? name.slice(1) : name.slice(5);
            el.removeAttribute(name);
            const fn = e => {
                const handler = scope[value];
                if (typeof handler === 'function') handler(e);
                else try {
                    const keys = Object.keys(scope);
                    const args = keys.map(k => {
                        const v = scope[k];
                        return v && v._isRef ? v.value : v;
                    });
                    Function(...keys, 'e', `"use strict";${value}`)(...args, e);
                } catch (err) {
                    console.error?.('Event error:', err);
                    runHooks('onError', err, 'event', { name, value });
                }
            };
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
        }
        else if (name === 'z-model') {
            el.removeAttribute(name);
            const isCheck = el.type === 'checkbox' || el.type === 'radio';
            const prop = isCheck ? 'checked' : 'value';
            const ev = isCheck || el.tagName === 'SELECT' ? 'change' : 'input';
            const fn = () => {
                if (el.type === 'radio' && !el.checked) return;
                scope[value]?._isRef ? scope[value].value = el[prop] : evalExp(value + '=_v', { ...scope, _v: el[prop] });
            };
            el.addEventListener(ev, fn);
            cs.addListener(el, ev, fn);
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                el.type === 'radio' ? el.checked = String(el.value) === String(res) : el[prop] = res;
            }));
        }
        else if (name === 'z-text' || name === 'z-html' || name === 'z-show' || name.startsWith(':') || name.startsWith('z-')) {
            const attr = name[0] === ':' ? name.slice(1) : name;
            el.removeAttribute(name);
            const staticClass = attr === 'class' ? (el.getAttribute('class') || '') : '';
            cs.addEffect(watchEffect(() => {
                const res = evalExp(value, scope);
                if (attr === 'z-text') el.textContent = res ?? '';
                else if (attr === 'z-html') el.innerHTML = res ?? '';
                else if (attr === 'z-show') el.style.display = res ? '' : 'none';
                else if (attr === 'style' && isObj(res)) Object.assign(el.style, res);
                else if (attr === 'class') {
                    const classValue = isObj(res) ? (staticClass + ' ' + Object.keys(res).filter(k => res[k]).join(' ')).trim()
                        : typeof res === 'string' ? (staticClass + ' ' + res).trim() : staticClass;
                    el.setAttribute('class', classValue);
                }
                else {
                    const setName = attr.startsWith('z-') ? attr.slice(2) : attr;
                    typeof res === 'boolean' ? (res ? el.setAttribute(setName, '') : el.removeAttribute(setName))
                        : res == null ? el.removeAttribute(setName) : el.setAttribute(setName, res);
                }
            }));
        }
    }

    [...el.childNodes].forEach(child => compile(child, scope, cs));
    runHooks('afterCompile', el, scope, cs);
};

export const nextTick = fn => Promise.resolve().then(fn);

// --- App ---
export const createApp = setup => {
    let rootScope = null;
    const appContext = { plugins: new Set() };

    return {
        use(plugin, options = {}) {
            if (appContext.plugins.has(plugin)) return this;
            if (typeof plugin.install !== 'function') { console.error?.('Plugin must have an install(app, options) method'); return this; }
            plugin.install(this, options);
            appContext.plugins.add(plugin);
            return this;
        },
        mount(root) {
            const el = typeof root === 'string' ? document.querySelector(root) : root;
            if (!el) { console.error?.('Root element not found:', root); return; }

            const data = (setup && setup()) || {};
            rootScope = new Scope(data);
            try {
                compile(el, rootScope.data, rootScope);
            } catch (err) {
                console.error?.('Compile error:', err);
                runHooks('onError', err, 'compile', { el, scope: rootScope });
            }
            return this;
        },
        unmount() {
            if (!rootScope) return;
            rootScope.cleanup();
            rootScope = null;
        }
    };
};
