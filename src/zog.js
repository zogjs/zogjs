/**
 * Zog.js Library (The Definitive Version)
 * A minimal reactive framework inspired by Vue.js, ready for production build.
 */

// --- 1. Reactivity System (No changes needed) ---
let activeEffect = null;

class Dep {
    constructor() { this.subs = new Set(); }
    depend() { if (activeEffect) this.subs.add(activeEffect); }
    notify() { this.subs.forEach(effect => effect()); }
}

export function watchEffect(effect) {
    const prev = activeEffect;
    activeEffect = effect;
    try {
        effect();
    } finally {
        activeEffect = prev;
    }
}

export function ref(val) {
    const dep = new Dep();
    return {
        _isRef: true,
        get value() { dep.depend(); return val; },
        set value(newVal) {
            if (newVal !== val) {
                val = newVal;
                dep.notify();
            }
        },
        toString() { return val; }
    };
}

// --- 2. Compiler & Runtime ---

const evalExp = (exp, scope) => {
    try {
        const keys = Object.keys(scope);
        const values = keys.map(k => scope[k]?._isRef ? scope[k].value : scope[k]);
        return new Function(...keys, `return ${exp}`)(...values);
    } catch { return undefined; }
};

const compile = (el, scope) => {
    if (!el) return;

    // 1. Handle Text Interpolation: {{ val }}
    if (el.nodeType === 3) {
        const content = el.textContent;
        if (content.includes('{{')) {
            watchEffect(() => {
                el.textContent = content.replace(/{{\s*(.*?)\s*}}/g, (_, exp) => evalExp(exp, scope));
            });
        }
        return;
    }

    if (el.nodeType !== 1) return;

    // --- CRITICAL FIX APPLIED HERE (z-if Logic) ---
    if (el.hasAttribute('z-if')) {
        const branches = [];
        let curr = el;
        const parent = el.parentNode; // Store parent reference

        if (!parent) return; // Safety check if root element is z-if, though should be mounted

        // 1. Create and insert placeholder *before* removing elements
        const placeholder = document.createComment('z-if');
        parent.insertBefore(placeholder, el); // Insert placeholder using el as reference point

        // 2. Collect and remove branches from DOM
        while (curr) {
            const type = ['z-if', 'z-else-if', 'z-else'].find(t => curr.hasAttribute(t));
            if (!type) break;

            const exp = curr.getAttribute(type);
            curr.removeAttribute(type);

            branches.push({ el: curr, exp, type });

            const next = curr.nextElementSibling;
            curr.remove(); // Now safe to remove
            curr = next;
        }

        watchEffect(() => {
            const match = branches.find(b => b.type === 'z-else' || evalExp(b.exp, scope));

            branches.forEach(b => {
                if (b === match) {
                    if (!document.contains(b.el)) {
                        parent.insertBefore(b.el, placeholder.nextSibling); // Insert match after placeholder

                        if (!b.el._isCompiled) {
                            b.el._isCompiled = true;
                            compile(b.el, scope);
                        }
                    }
                } else if (document.contains(b.el)) {
                    b.el.remove();
                }
            });
        });
        return;
    }

    if (el.hasAttribute('z-else-if') || el.hasAttribute('z-else')) return;

    // --- CRITICAL FIX APPLIED HERE (z-for Logic) ---
    if (el.hasAttribute('z-for')) {
        const [item, listName] = el.getAttribute('z-for').split(' in ').map(s => s.trim());
        const parent = el.parentNode; // Store parent reference

        if (!parent) return; // Safety check

        const placeholder = document.createComment('z-for');
        parent.insertBefore(placeholder, el); // Insert placeholder using el as reference point

        el.remove();
        el.removeAttribute('z-for');

        let clones = [];
        watchEffect(() => {
            clones.forEach(c => c.remove());
            clones = [];
            const list = evalExp(listName, scope) || [];

            if (Array.isArray(list)) {
                list.forEach((val, index) => {
                    const clone = el.cloneNode(true);
                    parent.insertBefore(clone, placeholder); // Insert clone before placeholder
                    clones.push(clone);
                    const childScope = { ...scope, [item]: { value: val, _isRef: true }, index };
                    compile(clone, childScope);
                });
            }
        });
        return;
    }

    // 4. Handle Attributes & Directives (با پشتیبانی z-on:)
    Array.from(el.attributes).forEach(({ name, value }) => {

        if (name.startsWith('@') || name.startsWith('z-on:')) {
            const event = name.startsWith('@') ? name.slice(1) : name.slice(5);
            el.removeAttribute(name);
            el.addEventListener(event, (e) => {
                const handler = scope[value];
                typeof handler === 'function' ? handler(e) : evalExp(value, scope);
            });
        }
        else if (name === 'z-model') {
            el.removeAttribute(name);
            const isCheckable = el.type === 'checkbox' || el.type === 'radio';
            const prop = isCheckable ? 'checked' : 'value';
            const event = isCheckable || el.tagName === 'SELECT' ? 'change' : 'input';

            el.addEventListener(event, () => {
                let val = el[prop];
                if (el.type === 'radio' && !el.checked) return;
                if (scope[value]) scope[value].value = val;
            });

            watchEffect(() => {
                const res = evalExp(value, scope);
                if (el.type === 'radio') el.checked = (String(el.value) === String(res));
                else el[prop] = res;
            });
        }
        else if (name.startsWith(':') || name.startsWith('z-')) {
            const attr = name.startsWith(':') ? name.slice(1) : name;
            const staticClass = (attr === 'class') ? el.className : '';
            if (name.startsWith(':')) el.removeAttribute(name);
            
            watchEffect(() => {
                const res = evalExp(value, scope);

                if (attr === 'z-text') el.textContent = res;
                else if (attr === 'z-html') el.innerHTML = res;
                else if (attr === 'z-show') el.style.display = res ? '' : 'none';
                else if (attr === 'style' && typeof res === 'object') Object.assign(el.style, res);

                else if (attr === 'class' && typeof res === 'object') {
                    const dynamicClasses = Object.keys(res).filter(k => res[k]).join(' ');
                    el.className = (staticClass + ' ' + dynamicClasses).trim();
                }

                else el.setAttribute(attr, res);
            });
        }

    });

    el.childNodes.forEach(child => compile(child, scope));
};

// --- 4. Built-in Minimal Router ---

const isBrowser = typeof window !== 'undefined';

const getQueryObj = () =>
    isBrowser
        ? Object.fromEntries(new URLSearchParams(window.location.search))
        : {};

const _r = {
    h: ref(isBrowser ? window.location.hash : ''),
    p: ref(isBrowser ? window.location.pathname : ''),
    q: ref(getQueryObj())
};

const syncRoute = () => {
    if (!isBrowser) return;
    _r.h.value = window.location.hash;
    _r.p.value = window.location.pathname;
    _r.q.value = getQueryObj();
};

if (isBrowser) {
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
}

export const route = {
    get hash() { return _r.h.value; },
    get path() { return _r.p.value; },
    get query() { return _r.q.value; }
};


// --- 3. App Creator (No changes needed) ---
export function createApp(setup) {
    return {
        mount(selector) {
            const root = document.querySelector(selector);
            const scope = setup();
            compile(root, scope);
        }
    };
}