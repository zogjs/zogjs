/**
 * Zog.js - Comprehensive Test Suite
 * Tests all features, edge cases, and real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
    ref,
    reactive,
    computed,
    watchEffect,
    createApp,
    use,
    addHook, removeHook
} from '../src/zog.js';

// Setup DOM environment
let dom;
let document;
let window;

beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true
    });
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
});

afterEach(() => {
    if (dom) {
        dom.window.close();
    }
});

// ============================================
// 1. REACTIVITY CORE TESTS
// ============================================

describe('Reactivity Core', () => {
    describe('ref()', () => {
        it('should create a reactive reference', () => {
            const count = ref(0);
            expect(count.value).toBe(0);
            expect(count._isRef).toBe(true);
        });

        it('should update ref value', () => {
            const count = ref(0);
            count.value = 5;
            expect(count.value).toBe(5);
        });

        it('should trigger effects on change', async () => {
            const count = ref(0);
            let dummy;

            watchEffect(() => {
                dummy = count.value;
            });

            expect(dummy).toBe(0);
            count.value = 7;

            await Promise.resolve();
            expect(dummy).toBe(7);
        });

        it('should not trigger if value is the same', async () => {
            const count = ref(0);
            let runs = 0;

            watchEffect(() => {
                count.value;
                runs++;
            });

            await Promise.resolve();
            const initialRuns = runs;

            count.value = 0; // Same value
            await Promise.resolve();
            expect(runs).toBe(initialRuns);
        });

        it('should work with objects', () => {
            const obj = ref({ a: 1 });
            expect(obj.value.a).toBe(1);
            obj.value = { a: 2 };
            expect(obj.value.a).toBe(2);
        });

        it('should work with arrays', () => {
            const arr = ref([1, 2, 3]);
            expect(arr.value.length).toBe(3);
            arr.value = [4, 5];
            expect(arr.value.length).toBe(2);
        });

        it('should handle null and undefined', () => {
            const nullRef = ref(null);
            const undefinedRef = ref(undefined);

            expect(nullRef.value).toBe(null);
            expect(undefinedRef.value).toBe(undefined);
        });

        it('should toString properly', () => {
            const num = ref(42);
            const str = ref('hello');

            expect(num.toString()).toBe('42');
            expect(str.toString()).toBe('hello');
        });
    });

    describe('reactive()', () => {
        it('should make object reactive', () => {
            const obj = reactive({ count: 0 });
            expect(obj.count).toBe(0);
        });

        it('should trigger effects on property change', async () => {
            const obj = reactive({ count: 0 });
            let dummy;

            watchEffect(() => {
                dummy = obj.count;
            });

            expect(dummy).toBe(0);
            obj.count = 7;

            await Promise.resolve();
            expect(dummy).toBe(7);
        });

        it('should handle nested objects', async () => {
            const obj = reactive({ nested: { count: 0 } });
            let dummy;

            watchEffect(() => {
                dummy = obj.nested.count;
            });

            obj.nested.count = 5;
            await Promise.resolve();
            expect(dummy).toBe(5);
        });

        it('should handle array mutations', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;

            watchEffect(() => {
                dummy = arr.length;
            });

            arr.push(4);
            await Promise.resolve();
            expect(dummy).toBe(4);
            expect(arr[3]).toBe(4);
        });

        it('should track array methods: push', async () => {
            const arr = reactive([]);
            let dummy;

            watchEffect(() => {
                dummy = arr.length;
            });

            arr.push(1);
            await Promise.resolve();
            expect(dummy).toBe(1);
        });

        it('should track array methods: pop', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;

            watchEffect(() => {
                dummy = arr.length;
            });

            arr.pop();
            await Promise.resolve();
            expect(dummy).toBe(2);
        });

        it('should track array methods: shift', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;

            watchEffect(() => {
                dummy = arr.length;
            });

            arr.shift();
            await Promise.resolve();
            expect(dummy).toBe(2);
            expect(arr[0]).toBe(2);
        });

        it('should track array methods: unshift', async () => {
            const arr = reactive([2, 3]);
            let dummy;

            watchEffect(() => {
                dummy = arr.length;
            });

            arr.unshift(1);
            await Promise.resolve();
            expect(dummy).toBe(3);
            expect(arr[0]).toBe(1);
        });

        it('should track array methods: splice', async () => {
            const arr = reactive([1, 2, 3, 4]);
            let dummy;

            watchEffect(() => {
                dummy = arr.length;
            });

            arr.splice(1, 2, 5, 6);
            await Promise.resolve();
            expect(dummy).toBe(4);
            expect(arr).toEqual([1, 5, 6, 4]);
        });

        it('should track array methods: sort', async () => {
            const arr = reactive([3, 1, 2]);
            let dummy;

            watchEffect(() => {
                dummy = arr[0];
            });

            arr.sort();
            await Promise.resolve();
            expect(dummy).toBe(1);
            expect(arr).toEqual([1, 2, 3]);
        });

        it('should track array methods: reverse', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;

            watchEffect(() => {
                dummy = arr[0];
            });

            arr.reverse();
            await Promise.resolve();
            expect(dummy).toBe(3);
        });

        it('should track array iteration methods: forEach', async () => {
            const arr = reactive([1, 2, 3]);
            let sum = 0;

            watchEffect(() => {
                sum = 0;
                arr.forEach(n => sum += n);
            });

            await Promise.resolve();
            expect(sum).toBe(6);

            arr.push(4);
            await Promise.resolve();
            expect(sum).toBe(10);
        });

        it('should track array iteration methods: map', async () => {
            const arr = reactive([1, 2, 3]);
            let mapped;

            watchEffect(() => {
                mapped = arr.map(n => n * 2);
            });

            await Promise.resolve();
            expect(mapped).toEqual([2, 4, 6]);

            arr.push(4);
            await Promise.resolve();
            expect(mapped).toEqual([2, 4, 6, 8]);
        });

        it('should track array methods: filter', async () => {
            const arr = reactive([1, 2, 3, 4]);
            let filtered;

            watchEffect(() => {
                filtered = arr.filter(n => n > 2);
            });

            await Promise.resolve();
            expect(filtered).toEqual([3, 4]);
        });

        it('should track array methods: find', async () => {
            const arr = reactive([1, 2, 3, 4]);
            let found;

            watchEffect(() => {
                found = arr.find(n => n > 2);
            });

            await Promise.resolve();
            expect(found).toBe(3);
        });

        it('should track array methods: includes', async () => {
            const arr = reactive([1, 2, 3]);
            let hasTwo;

            watchEffect(() => {
                hasTwo = arr.includes(2);
            });

            await Promise.resolve();
            expect(hasTwo).toBe(true);

            arr.splice(1, 1);
            await Promise.resolve();
            expect(hasTwo).toBe(false);
        });

        it('should handle property deletion', async () => {
            const obj = reactive({ a: 1, b: 2 });
            let dummy;

            watchEffect(() => {
                dummy = 'a' in obj;
            });

            expect(dummy).toBe(true);
            delete obj.a;

            await Promise.resolve();
            expect(dummy).toBe(false);
        });

        it('should track has operation', async () => {
            const obj = reactive({ a: 1 });
            let dummy;

            watchEffect(() => {
                dummy = 'a' in obj;
            });

            expect(dummy).toBe(true);
        });

        it('should track ownKeys operation', async () => {
            const obj = reactive({ a: 1 });
            let keys;

            watchEffect(() => {
                keys = Object.keys(obj);
            });

            await Promise.resolve();
            expect(keys).toEqual(['a']);

            obj.b = 2;
            await Promise.resolve();
            expect(keys).toEqual(['a', 'b']);
        });

        it('should not make already reactive objects reactive again', () => {
            const original = { count: 0 };
            const observed = reactive(original);
            const observed2 = reactive(observed);

            expect(observed2).toBe(observed);
        });

        it('should handle circular references', () => {
            const obj = reactive({ self: null });
            obj.self = obj;

            expect(obj.self).toBe(obj);
        });

        it('should work with nested arrays', async () => {
            const arr = reactive([[1, 2], [3, 4]]);
            let dummy;

            watchEffect(() => {
                dummy = arr[0][0];
            });

            arr[0][0] = 10;
            await Promise.resolve();
            expect(dummy).toBe(10);
        });

        it('should handle array length changes', async () => {
            const arr = reactive([1, 2, 3]);
            let dummy;

            watchEffect(() => {
                dummy = arr.length;
            });

            arr.length = 0;
            await Promise.resolve();
            expect(dummy).toBe(0);
            expect(arr).toEqual([]);
        });
    });

    describe('computed()', () => {
        it('should return computed value', () => {
            const value = ref(1);
            const cValue = computed(() => value.value + 1);

            expect(cValue.value).toBe(2);
        });

        it('should compute lazily', () => {
            const value = ref(1);
            let runs = 0;

            const cValue = computed(() => {
                runs++;
                return value.value + 1;
            });

            expect(runs).toBe(0);
            expect(cValue.value).toBe(2);
            expect(runs).toBe(1);
            expect(cValue.value).toBe(2);
            expect(runs).toBe(1); // Should not run again
        });

        it('should trigger on dependency change', async () => {
            const value = ref(1);
            const cValue = computed(() => value.value + 1);

            expect(cValue.value).toBe(2);

            value.value = 2;
            await Promise.resolve();

            expect(cValue.value).toBe(3);
        });

        it('should chain computed values', () => {
            const value = ref(1);
            const c1 = computed(() => value.value + 1);
            const c2 = computed(() => c1.value + 1);

            expect(c2.value).toBe(3);

            value.value = 2;
            expect(c2.value).toBe(4);
        });

        it('should work with reactive objects', () => {
            const obj = reactive({ a: 1, b: 2 });
            const sum = computed(() => obj.a + obj.b);

            expect(sum.value).toBe(3);

            obj.a = 2;
            expect(sum.value).toBe(4);
        });

        it('should be marked as ref', () => {
            const c = computed(() => 1);
            expect(c._isRef).toBe(true);
        });
    });

    describe('watchEffect()', () => {
        it('should run immediately', () => {
            let dummy;
            watchEffect(() => {
                dummy = 'ran';
            });

            expect(dummy).toBe('ran');
        });

        it('should track reactive dependencies', async () => {
            const count = ref(0);
            let dummy;

            watchEffect(() => {
                dummy = count.value;
            });

            expect(dummy).toBe(0);
            count.value = 5;

            await Promise.resolve();
            expect(dummy).toBe(5);
        });

        it('should return stop function', () => {
            const count = ref(0);
            let dummy;

            const stop = watchEffect(() => {
                dummy = count.value;
            });

            expect(dummy).toBe(0);
            expect(typeof stop).toBe('function');
        });

        it('should stop tracking after stop is called', async () => {
            const count = ref(0);
            let dummy;

            const stop = watchEffect(() => {
                dummy = count.value;
            });

            expect(dummy).toBe(0);
            stop();

            count.value = 5;
            await Promise.resolve();
            expect(dummy).toBe(0); // Should not update
        });

        it('should work with custom scheduler', async () => {
            const count = ref(0);
            let dummy;
            let schedulerCalled = false;

            watchEffect(() => {
                dummy = count.value;
            }, {
                scheduler: (job) => {
                    schedulerCalled = true;
                    job();
                }
            });

            count.value = 5;
            await Promise.resolve();

            expect(dummy).toBe(5);
            expect(schedulerCalled).toBe(true);
        });

        it('should batch multiple changes', async () => {
            const count = ref(0);
            let runs = 0;

            watchEffect(() => {
                count.value;
                runs++;
            });

            const initialRuns = runs;

            count.value = 1;
            count.value = 2;
            count.value = 3;

            await Promise.resolve();
            expect(runs).toBe(initialRuns + 1); // Only one additional run
        });

        it('should handle nested effects', async () => {
            const count = ref(0);
            let outer = 0;
            let inner = 0;

            watchEffect(() => {
                outer++;
                watchEffect(() => {
                    inner++;
                    count.value;
                });
            });

            await Promise.resolve();
            count.value = 1;
            await Promise.resolve();

            expect(outer).toBeGreaterThan(0);
            expect(inner).toBeGreaterThan(0);
        });

        it('should not cause infinite loops', async () => {
            const count = ref(0);
            let runs = 0;

            watchEffect(() => {
                runs++;
                if (count.value < 2) {
                    // Use setTimeout to avoid batching
                    setTimeout(() => {
                        if (count.value < 2) count.value++;
                    }, 0);
                }
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(runs).toBeLessThan(10); // Should stabilize
            expect(count.value).toBeGreaterThanOrEqual(1);
        });
    });
});

// ============================================
// 2. TEMPLATE COMPILER TESTS
// ============================================

describe('Template Compiler', () => {
    describe('Text Interpolation', () => {
        it('should interpolate simple expressions', async () => {
            document.body.innerHTML = '<div id="app">{{ message }}</div>';

            const app = createApp(() => {
                const message = ref('Hello World');
                return { message };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toBe('Hello World');
        });

        it('should update on data change', async () => {
            document.body.innerHTML = '<div id="app">{{ count }}</div>';

            let countRef;
            const app = createApp(() => {
                countRef = ref(0);
                return { count: countRef };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toBe('0');

            countRef.value = 42;
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toBe('42');
        });

        it('should handle multiple interpolations', async () => {
            document.body.innerHTML = '<div id="app">{{ first }} {{ last }}</div>';

            const app = createApp(() => {
                return { first: ref('John'), last: ref('Doe') };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toBe('John Doe');
        });

        it('should handle expressions', async () => {
            document.body.innerHTML = '<div id="app">{{ count * 2 }}</div>';

            const app = createApp(() => {
                return { count: ref(5) };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toBe('10');
        });
    });

    describe('z-if Directive', () => {
        it('should conditionally render element', async () => {
            document.body.innerHTML = '<div id="app"><div z-if="show">Visible</div></div>';

            let showRef;
            const app = createApp(() => {
                showRef = ref(true);
                return { show: showRef };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toContain('Visible');

            showRef.value = false;
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).not.toContain('Visible');
        });

        it('should work with z-else', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-if="show">If</div>
                    <div z-else>Else</div>
                </div>
            `;

            let showRef;
            const app = createApp(() => {
                showRef = ref(true);
                return { show: showRef };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toContain('If');
            expect(document.querySelector('#app').textContent).not.toContain('Else');

            showRef.value = false;
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).not.toContain('If');
            expect(document.querySelector('#app').textContent).toContain('Else');
        });

        it('should work with z-else-if', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-if="status === 'a'">A</div>
                    <div z-else-if="status === 'b'">B</div>
                    <div z-else>C</div>
                </div>
            `;

            let statusRef;
            const app = createApp(() => {
                statusRef = ref('a');
                return { status: statusRef };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('#app').textContent.trim()).toBe('A');

            statusRef.value = 'b';
            await Promise.resolve();
            expect(document.querySelector('#app').textContent.trim()).toBe('B');

            statusRef.value = 'c';
            await Promise.resolve();
            expect(document.querySelector('#app').textContent.trim()).toBe('C');
        });
    });

    describe('z-for Directive', () => {
        it('should render list', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items">{{ item }}</li>
                    </ul>
                </div>
            `;

            const app = createApp(() => {
                const items = reactive([1, 2, 3]);
                return { items };
            });

            app.mount('#app');
            await Promise.resolve();

            const lis = document.querySelectorAll('li');
            expect(lis.length).toBe(3);
            expect(lis[0].textContent).toBe('1');
            expect(lis[1].textContent).toBe('2');
            expect(lis[2].textContent).toBe('3');
        });

        it('should update on array push', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items">{{ item }}</li>
                    </ul>
                </div>
            `;

            let itemsRef;
            const app = createApp(() => {
                itemsRef = reactive([1, 2]);
                return { items: itemsRef };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelectorAll('li').length).toBe(2);

            itemsRef.push(3);
            await Promise.resolve();

            expect(document.querySelectorAll('li').length).toBe(3);
            expect(document.querySelectorAll('li')[2].textContent).toBe('3');
        });

        it('should handle with index', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="(item, index) in items">{{ index }}: {{ item }}</li>
                    </ul>
                </div>
            `;

            const app = createApp(() => {
                const items = reactive(['a', 'b', 'c']);
                return { items };
            });

            app.mount('#app');
            await Promise.resolve();

            const lis = document.querySelectorAll('li');
            expect(lis[0].textContent).toBe('0: a');
            expect(lis[1].textContent).toBe('1: b');
            expect(lis[2].textContent).toBe('2: c');
        });

        it('should work with :key attribute', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items" :key="item.id">{{ item.name }}</li>
                    </ul>
                </div>
            `;

            let itemsRef;
            const app = createApp(() => {
                itemsRef = reactive([
                    { id: 1, name: 'A' },
                    { id: 2, name: 'B' }
                ]);
                return { items: itemsRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const firstLi = document.querySelectorAll('li')[0];

            // Reverse array
            itemsRef.reverse();
            await Promise.resolve();

            // First li should now have 'B'
            expect(document.querySelectorAll('li')[0].textContent).toBe('B');
        });

        it('should handle array splice', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items">{{ item }}</li>
                    </ul>
                </div>
            `;

            let itemsRef;
            const app = createApp(() => {
                itemsRef = reactive([1, 2, 3, 4]);
                return { items: itemsRef };
            });

            app.mount('#app');
            await Promise.resolve();

            itemsRef.splice(1, 2);
            await Promise.resolve();

            const lis = document.querySelectorAll('li');
            expect(lis.length).toBe(2);
            expect(lis[0].textContent).toBe('1');
            expect(lis[1].textContent).toBe('4');
        });
    });

    describe('z-model Directive', () => {
        it('should bind input value', async () => {
            document.body.innerHTML = '<div id="app"><input z-model="text" /></div>';

            let textRef;
            const app = createApp(() => {
                textRef = ref('');
                return { text: textRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const input = document.querySelector('input');
            expect(input.value).toBe('');

            textRef.value = 'hello';
            await Promise.resolve();

            expect(input.value).toBe('hello');
        });

        it('should update ref on input', async () => {
            document.body.innerHTML = '<div id="app"><input z-model="text" /></div>';

            let textRef;
            const app = createApp(() => {
                textRef = ref('');
                return { text: textRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const input = document.querySelector('input');
            input.value = 'test';
            input.dispatchEvent(new window.Event('input'));

            await Promise.resolve();
            expect(textRef.value).toBe('test');
        });

        it('should work with checkbox', async () => {
            document.body.innerHTML = '<div id="app"><input type="checkbox" z-model="checked" /></div>';

            let checkedRef;
            const app = createApp(() => {
                checkedRef = ref(false);
                return { checked: checkedRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const checkbox = document.querySelector('input');
            expect(checkbox.checked).toBe(false);

            checkedRef.value = true;
            await Promise.resolve();

            expect(checkbox.checked).toBe(true);
        });

        it('should work with select', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <select z-model="selected">
                        <option value="a">A</option>
                        <option value="b">B</option>
                    </select>
                </div>
            `;

            let selectedRef;
            const app = createApp(() => {
                selectedRef = ref('a');
                return { selected: selectedRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const select = document.querySelector('select');
            expect(select.value).toBe('a');

            selectedRef.value = 'b';
            await Promise.resolve();

            expect(select.value).toBe('b');
        });
    });

    describe('Event Handlers', () => {
        it('should handle @click', async () => {
            document.body.innerHTML = '<div id="app"><button @click="handleClick">Click</button></div>';

            let clicked = false;
            const app = createApp(() => {
                const handleClick = () => { clicked = true; };
                return { handleClick };
            });

            app.mount('#app');
            await Promise.resolve();

            const button = document.querySelector('button');
            button.click();

            expect(clicked).toBe(true);
        });

        it('should handle z-on:click', async () => {
            document.body.innerHTML = '<div id="app"><button z-on:click="handleClick">Click</button></div>';

            let clicked = false;
            const app = createApp(() => {
                const handleClick = () => { clicked = true; };
                return { handleClick };
            });

            app.mount('#app');
            await Promise.resolve();

            const button = document.querySelector('button');
            button.click();

            expect(clicked).toBe(true);
        });

        it('should pass event to handler', async () => {
            document.body.innerHTML = '<div id="app"><button @click="handleClick">Click</button></div>';

            let event = null;
            const app = createApp(() => {
                const handleClick = (e) => { event = e; };
                return { handleClick };
            });

            app.mount('#app');
            await Promise.resolve();

            const button = document.querySelector('button');
            button.click();

            expect(event).not.toBe(null);
            expect(event.type).toBe('click');
        });

        it('should handle inline expressions', async () => {
            document.body.innerHTML = '<div id="app"><button @click="count.value++">+</button></div>';

            let countRef;
            const app = createApp(() => {
                countRef = ref(0);
                return { count: countRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const button = document.querySelector('button');
            button.click();

            await Promise.resolve();
            expect(countRef.value).toBe(1);
        });
    });

    describe('Attribute Bindings', () => {
        it('should bind with :attribute', async () => {
            document.body.innerHTML = '<div id="app"><div :id="dynamicId"></div></div>';

            let idRef;
            const app = createApp(() => {
                idRef = ref('test-id');
                return { dynamicId: idRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const div = document.querySelector('#app > div');
            expect(div.getAttribute('id')).toBe('test-id');

            idRef.value = 'new-id';
            await Promise.resolve();

            expect(div.getAttribute('id')).toBe('new-id');
        });

        it('should handle :class with object', async () => {
            document.body.innerHTML = '<div id="app"><div class="static" :class="{ active: isActive }"></div></div>';

            let isActiveRef;
            const app = createApp(() => {
                isActiveRef = ref(false);
                return { isActive: isActiveRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const div = document.querySelector('#app > div');
            expect(div.className).toBe('static');

            isActiveRef.value = true;
            await Promise.resolve();

            expect(div.className).toContain('active');
        });

        it('should handle :style with object', async () => {
            document.body.innerHTML = '<div id="app"><div :style="{ color: textColor }"></div></div>';

            let colorRef;
            const app = createApp(() => {
                colorRef = ref('red');
                return { textColor: colorRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const div = document.querySelector('#app > div');
            expect(div.style.color).toBe('red');

            colorRef.value = 'blue';
            await Promise.resolve();

            expect(div.style.color).toBe('blue');
        });

        it('should handle boolean attributes', async () => {
            document.body.innerHTML = '<div id="app"><button :disabled="isDisabled">Button</button></div>';

            let disabledRef;
            const app = createApp(() => {
                disabledRef = ref(false);
                return { isDisabled: disabledRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const button = document.querySelector('button');
            expect(button.hasAttribute('disabled')).toBe(false);

            disabledRef.value = true;
            await Promise.resolve();

            expect(button.hasAttribute('disabled')).toBe(true);
        });
    });

    describe('z-text and z-html', () => {
        it('should set textContent with z-text', async () => {
            document.body.innerHTML = '<div id="app"><p z-text="message"></p></div>';

            let messageRef;
            const app = createApp(() => {
                messageRef = ref('Hello');
                return { message: messageRef };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('p').textContent).toBe('Hello');

            messageRef.value = 'World';
            await Promise.resolve();

            expect(document.querySelector('p').textContent).toBe('World');
        });

        it('should set innerHTML with z-html', async () => {
            document.body.innerHTML = '<div id="app"><div z-html="html"></div></div>';

            let htmlRef;
            const app = createApp(() => {
                htmlRef = ref('<strong>Bold</strong>');
                return { html: htmlRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const div = document.querySelector('#app > div');
            expect(div.innerHTML).toBe('<strong>Bold</strong>');
            expect(div.querySelector('strong')).not.toBe(null);
        });
    });

    describe('z-show Directive', () => {
        it('should toggle display', async () => {
            document.body.innerHTML = '<div id="app"><div z-show="visible">Content</div></div>';

            let visibleRef;
            const app = createApp(() => {
                visibleRef = ref(true);
                return { visible: visibleRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const div = document.querySelector('#app > div');
            expect(div.style.display).toBe('');

            visibleRef.value = false;
            await Promise.resolve();

            expect(div.style.display).toBe('none');

            visibleRef.value = true;
            await Promise.resolve();

            expect(div.style.display).toBe('');
        });
    });
});

// ============================================
// 3. PLUGIN SYSTEM TESTS
// ============================================

describe('Plugin System', () => {
    it('should install plugin', () => {
        let installed = false;

        const plugin = {
            install(zog, options) {
                installed = true;
            }
        };

        use(plugin);
        expect(installed).toBe(true);
    });

    it('should pass options to plugin', () => {
        let receivedOptions = null;

        const plugin = {
            install(zog, options) {
                receivedOptions = options;
            }
        };

        use(plugin, { test: 'value' });
        expect(receivedOptions).toEqual({ test: 'value' });
    });

    it('should provide Zog APIs to plugin', () => {
        let receivedAPI = null;

        const plugin = {
            install(zog, options) {
                receivedAPI = zog;
            }
        };

        use(plugin);

        expect(receivedAPI).toHaveProperty('reactive');
        expect(receivedAPI).toHaveProperty('ref');
        expect(receivedAPI).toHaveProperty('computed');
        expect(receivedAPI).toHaveProperty('watchEffect');
        expect(receivedAPI).toHaveProperty('createApp');
        expect(receivedAPI).toHaveProperty('utils');
    });

    it('should not install same plugin twice', () => {
        let installCount = 0;

        const plugin = {
            install() {
                installCount++;
            }
        };

        use(plugin);
        use(plugin);

        expect(installCount).toBe(1);
    });

    it('should handle plugin without install method', () => {
        const invalidPlugin = {};

        expect(() => {
            use(invalidPlugin);
        }).not.toThrow();
    });
});

// ============================================
// 4. APP LIFECYCLE TESTS
// ============================================

describe('App Lifecycle', () => {
    it('should mount app', async () => {
        document.body.innerHTML = '<div id="app">{{ message }}</div>';

        const app = createApp(() => {
            return { message: ref('Hello') };
        });

        app.mount('#app');
        await Promise.resolve();

        expect(document.querySelector('#app').textContent).toBe('Hello');
    });

    it('should return app instance from mount', async () => {
        document.body.innerHTML = '<div id="app"></div>';

        const app = createApp(() => ({}));
        const result = app.mount('#app');

        expect(result).toBe(app);
    });

    it('should handle unmount', async () => {
        document.body.innerHTML = '<div id="app"><button @click="handleClick">Click</button></div>';

        let clickCount = 0;
        const app = createApp(() => {
            const handleClick = () => clickCount++;
            return { handleClick };
        });

        app.mount('#app');
        await Promise.resolve();

        const button = document.querySelector('button');
        button.click();
        expect(clickCount).toBe(1);

        app.unmount();

        button.click();
        expect(clickCount).toBe(1); // Should not increase after unmount
    });

    it('should cleanup effects on unmount', async () => {
        document.body.innerHTML = '<div id="app">{{ count }}</div>';

        let countRef;
        const app = createApp(() => {
            countRef = ref(0);
            return { count: countRef };
        });

        app.mount('#app');
        await Promise.resolve();

        app.unmount();

        countRef.value = 5;
        await Promise.resolve();

        // DOM should not update after unmount
        expect(document.querySelector('#app').textContent).toBe('0');
    });

    it('should handle mounting to non-existent selector', () => {
        const app = createApp(() => ({}));

        expect(() => {
            app.mount('#non-existent');
        }).not.toThrow();
    });
});

// ============================================
// 5. EDGE CASES AND REAL-WORLD SCENARIOS
// ============================================

describe('Edge Cases and Real-World Scenarios', () => {
    describe('Complex State Management', () => {
        it('should handle deeply nested reactive objects', async () => {
            const state = reactive({
                user: {
                    profile: {
                        name: 'John',
                        address: {
                            city: 'NYC'
                        }
                    }
                }
            });

            let dummy;
            watchEffect(() => {
                dummy = state.user.profile.address.city;
            });

            await Promise.resolve();
            expect(dummy).toBe('NYC');

            state.user.profile.address.city = 'LA';
            await Promise.resolve();
            expect(dummy).toBe('LA');
        });

        it('should handle mixed arrays and objects', async () => {
            const state = reactive({
                items: [
                    { id: 1, name: 'A' },
                    { id: 2, name: 'B' }
                ]
            });

            let dummy;
            watchEffect(() => {
                dummy = state.items[0].name;
            });

            await Promise.resolve();
            expect(dummy).toBe('A');

            state.items[0].name = 'Updated';
            await Promise.resolve();
            expect(dummy).toBe('Updated');
        });
    });

    describe('Performance Scenarios', () => {
        it('should handle large lists efficiently', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <ul>
                        <li z-for="item in items" :key="item">{{ item }}</li>
                    </ul>
                </div>
            `;

            const largeArray = Array.from({ length: 1000 }, (_, i) => i);
            let itemsRef;

            const app = createApp(() => {
                itemsRef = reactive(largeArray);
                return { items: itemsRef };
            });

            const startTime = Date.now();
            app.mount('#app');
            await Promise.resolve();
            const mountTime = Date.now() - startTime;

            expect(document.querySelectorAll('li').length).toBe(1000);
            expect(mountTime).toBeLessThan(5000); // Should mount in reasonable time
        });

        it('should batch rapid updates', async () => {
            const count = ref(0);
            let runs = 0;

            watchEffect(() => {
                count.value;
                runs++;
            });

            const initialRuns = runs;

            // Rapid updates
            for (let i = 0; i < 100; i++) {
                count.value = i;
            }

            await Promise.resolve();

            // Should only run once more despite 100 updates
            expect(runs - initialRuns).toBeLessThan(5);
        });
    });

    describe('Error Handling', () => {
        it('should handle errors in effects gracefully', async () => {
            const count = ref(0);

            const consoleError = console.error;
            console.error = vi.fn();

            watchEffect(() => {
                if (count.value === 1) {
                    throw new Error('Test error');
                }
            });

            await Promise.resolve();

            count.value = 1;
            await Promise.resolve();

            // Should not crash
            expect(count.value).toBe(1);

            console.error = consoleError;
        });

        it('should handle invalid expressions in templates', async () => {
            document.body.innerHTML = '<div id="app">{{ undefinedVar.property }}</div>';

            const consoleError = console.error;
            console.error = vi.fn();

            const app = createApp(() => ({}));
            app.mount('#app');
            await Promise.resolve();

            // Should not crash
            expect(document.querySelector('#app').textContent).toBe('');

            console.error = consoleError;
        });
    });

    describe('Memory Leak Prevention', () => {
        it('should cleanup effects when stopped', async () => {
            const count = ref(0);
            let dummy;

            const stop = watchEffect(() => {
                dummy = count.value;
            });

            stop();

            const initialValue = dummy;
            count.value = 100;
            await Promise.resolve();

            expect(dummy).toBe(initialValue); // Should not update
        });

        it('should cleanup on unmount', async () => {
            document.body.innerHTML = '<div id="app">{{ count }}</div>';

            let countRef;
            const app = createApp(() => {
                countRef = ref(0);
                return { count: countRef };
            });

            app.mount('#app');
            await Promise.resolve();

            const initialText = document.querySelector('#app').textContent;
            app.unmount();

            countRef.value = 999;
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toBe(initialText);
        });
    });

    describe('Real-World Patterns', () => {
        it('should handle todo list pattern', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <input z-model="newTodo" />
                    <button @click="addTodo">Add</button>
                    <ul>
                        <li z-for="(todo, i) in todos" :key="todo.id">
                            {{ todo.text }}
                            <button @click="removeTodo(i)">X</button>
                        </li>
                    </ul>
                </div>
            `;

            let state;
            const app = createApp(() => {
                state = reactive({
                    todos: [],
                    newTodo: ref(''),
                    nextId: 1
                });

                const addTodo = () => {
                    if (state.newTodo.value.trim()) {
                        state.todos.push({
                            id: state.nextId++,
                            text: state.newTodo.value
                        });
                        state.newTodo.value = '';
                    }
                };

                const removeTodo = (index) => {
                    state.todos.splice(index, 1);
                };

                return {
                    todos: state.todos,
                    newTodo: state.newTodo,
                    addTodo,
                    removeTodo
                };
            });

            app.mount('#app');
            await Promise.resolve();

            // Add todo
            const input = document.querySelector('input');
            input.value = 'Test todo';
            input.dispatchEvent(new window.Event('input'));
            await Promise.resolve();

            const addButton = document.querySelector('button');
            addButton.click();
            await Promise.resolve();

            expect(document.querySelectorAll('li').length).toBe(1);
            expect(document.querySelector('li').textContent).toContain('Test todo');

            // Remove todo
            const removeButton = document.querySelectorAll('li button')[0];
            removeButton.click();
            await Promise.resolve();

            expect(document.querySelectorAll('li').length).toBe(0);
        });

        it('should handle counter with computed', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div>Count: {{ count }}</div>
                    <div>Doubled: {{ doubled }}</div>
                    <button @click="increment">+</button>
                </div>
            `;

            let countRef, doubledRef;
            const app = createApp(() => {
                countRef = ref(0);
                doubledRef = computed(() => countRef.value * 2);

                const increment = () => countRef.value++;

                return { count: countRef, doubled: doubledRef, increment };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.body.textContent).toContain('Count: 0');
            expect(document.body.textContent).toContain('Doubled: 0');

            document.querySelector('button').click();
            await Promise.resolve();

            expect(document.body.textContent).toContain('Count: 1');
            expect(document.body.textContent).toContain('Doubled: 2');
        });

        it('should handle form with validation', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <input z-model="email" />
                    <div z-if="!isValid && email">Invalid email</div>
                    <button :disabled="!isValid" @click="submit">Submit</button>
                </div>
            `;

            let emailRef, isValidRef, submitted;
            const app = createApp(() => {
                emailRef = ref('');
                isValidRef = computed(() => {
                    const email = emailRef.value;
                    return email.includes('@') && email.includes('.');
                });

                submitted = false;
                const submit = () => { submitted = true; };

                return {
                    email: emailRef,
                    isValid: isValidRef,
                    submit
                };
            });

            app.mount('#app');
            await Promise.resolve();

            const input = document.querySelector('input');
            const button = document.querySelector('button');

            // Invalid email
            input.value = 'invalid';
            input.dispatchEvent(new window.Event('input'));
            await Promise.resolve();

            expect(document.body.textContent).toContain('Invalid email');
            expect(button.hasAttribute('disabled')).toBe(true);

            // Valid email
            input.value = 'test@example.com';
            input.dispatchEvent(new window.Event('input'));
            await Promise.resolve();

            expect(document.body.textContent).not.toContain('Invalid email');
            expect(button.hasAttribute('disabled')).toBe(false);

            button.click();
            expect(submitted).toBe(true);
        });
    });

    describe('Concurrent Updates', () => {
        it('should handle multiple reactive sources', async () => {
            const a = ref(1);
            const b = ref(2);
            let result;

            watchEffect(() => {
                result = a.value + b.value;
            });

            await Promise.resolve();
            expect(result).toBe(3);

            a.value = 10;
            b.value = 20;
            await Promise.resolve();

            expect(result).toBe(30);
        });

        it('should handle cascading updates', async () => {
            const source = ref(1);
            const derived1 = computed(() => source.value * 2);
            const derived2 = computed(() => derived1.value + 1);

            let result;
            watchEffect(() => {
                result = derived2.value;
            });

            await Promise.resolve();
            expect(result).toBe(3); // (1 * 2) + 1

            source.value = 5;
            await Promise.resolve();

            expect(result).toBe(11); // (5 * 2) + 1
        });
    });

    describe('Special Characters and Encoding', () => {
        it('should handle special characters in interpolation', async () => {
            document.body.innerHTML = '<div id="app">{{ text }}</div>';

            const app = createApp(() => {
                return { text: ref('<script>alert("xss")</script>') };
            });

            app.mount('#app');
            await Promise.resolve();

            // Should escape as text, not execute
            expect(document.querySelector('#app').textContent).toContain('script');
            expect(document.querySelector('#app').innerHTML).not.toContain('<script>');
        });

        it('should handle unicode characters', async () => {
            document.body.innerHTML = '<div id="app">{{ text }}</div>';

            const app = createApp(() => {
                return { text: ref('Hello 世界 🌍') };
            });

            app.mount('#app');
            await Promise.resolve();

            expect(document.querySelector('#app').textContent).toBe('Hello 世界 🌍');
        });
    });
});

// ============================================
// 6. INTEGRATION TESTS
// ============================================

describe('Integration Tests', () => {
    it('should build a complete interactive app', async () => {
        document.body.innerHTML = `
            <div id="app">
                <h1>{{ title }}</h1>
                <input z-model="searchQuery" placeholder="Search..." />
                <div z-if="filteredItems.length > 0">
                    <ul>
                        <li z-for="item in filteredItems" :key="item.id">
                            <span :class="{ completed: item.done }">{{ item.text }}</span>
                            <button @click="toggleItem(item)">Toggle</button>
                        </li>
                    </ul>
                </div>
                <div z-else>
                    <p>No items found</p>
                </div>
                <div>Total: {{ total }}</div>
            </div>
        `;

        const app = createApp(() => {
            const title = ref('My App');
            const searchQuery = ref('');
            const items = reactive([
                { id: 1, text: 'Task 1', done: false },
                { id: 2, text: 'Task 2', done: true },
                { id: 3, text: 'Another task', done: false }
            ]);

            const filteredItems = computed(() => {
                const query = searchQuery.value.toLowerCase();
                if (!query) return items;
                return items.filter(item =>
                    item.text.toLowerCase().includes(query)
                );
            });

            const total = computed(() => items.length);

            const toggleItem = (item) => {
                item.done = !item.done;
            };

            return {
                title,
                searchQuery,
                filteredItems,
                total,
                toggleItem
            };
        });

        app.mount('#app');
        await Promise.resolve();

        // Check initial render
        expect(document.querySelector('h1').textContent).toBe('My App');
        expect(document.querySelectorAll('li').length).toBe(3);
        expect(document.body.textContent).toContain('Total: 3');

        // Test search
        const input = document.querySelector('input');
        input.value = 'Another';
        input.dispatchEvent(new window.Event('input'));
        await Promise.resolve();

        expect(document.querySelectorAll('li').length).toBe(1);
        expect(document.querySelector('li').textContent).toContain('Another task');

        // Test toggle
        const toggleButton = document.querySelector('button');
        toggleButton.click();
        await Promise.resolve();

        // Clear search to show all
        input.value = '';
        input.dispatchEvent(new window.Event('input'));
        await Promise.resolve();

        expect(document.querySelectorAll('li').length).toBe(3);
    });
});








describe('z-for directive', () => {
    let container;
    let app;


    describe('key=0 bug fix', () => {
        it('should render item with index 0 when using :key="index"', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(item, index) in items" :key="index">{{ index }}-{{ item }}</div>
                </div>
            `;
            app = createApp(() => ({
                items: ref(['a', 'b', 'c'])
            })).mount('#app');
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            console.info('#divs:', divs)
            expect(divs.length).toBe(3);
            expect(divs[0].textContent).toBe('0-a');
            expect(divs[1].textContent).toBe('1-b');
            expect(divs[2].textContent).toBe('2-c');
        });

        it('should render single item at index 0', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <span z-for="(item, i) in list" :key="i">{{ item }}</span>
                </div>
            `;
            app = createApp(() => ({
                list: ref(['only-one'])
            })).mount('#app');
            await Promise.resolve();

            const spans = document.body.querySelectorAll('#app > span');
            expect(spans.length).toBe(1);
            expect(spans[0].textContent).toBe('only-one');
        });

        it('should handle numeric key values including 0', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="item in items" :key="item.id">{{ item.name }}</div>
                </div>
            `;
            app = createApp(() => ({
                items: ref([
                    { id: 0, name: 'zero' },
                    { id: 1, name: 'one' },
                    { id: 2, name: 'two' }
                ])
            })).mount('#app');
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            expect(divs.length).toBe(3);
            expect(divs[0].textContent).toBe('zero');
            expect(divs[1].textContent).toBe('one');
            expect(divs[2].textContent).toBe('two');
        });
    });

    describe('falsy key values', () => {
        it('should handle empty string as key', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="item in items" :key="item.key">{{ item.val }}</div>
                </div>
            `;
            app = createApp(() => ({
                items: ref([
                    { key: '', val: 'empty' },
                    { key: 'a', val: 'letter' }
                ])
            })).mount('#app');
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            expect(divs.length).toBe(2);
            expect(divs[0].textContent).toBe('empty');
        });

        it('should handle null/undefined keys gracefully', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(item, i) in items" :key="item.id">{{ i }}-{{ item.name }}</div>
                </div>
            `;
            app = createApp(() => ({
                items: ref([
                    { id: null, name: 'null-key' },
                    { id: undefined, name: 'undef-key' },
                    { id: 1, name: 'normal' }
                ])
            })).mount('#app');
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            expect(divs.length).toBe(3);
        });
    });

    describe('reactivity with index 0', () => {
        it('should update item at index 0 reactively', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(item, index) in items" :key="index">{{ item }}</div>
                </div>
            `;
            const items = ref(['first', 'second']);
            app = createApp(() => ({ items })).mount('#app');
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div')[0].textContent).toBe('first');

            items.value = ['updated-first', 'second'];
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div')[0].textContent).toBe('updated-first');
        });

        it('should handle prepending items (shift all indexes)', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(item, index) in items" :key="index">{{ index }}-{{ item }}</div>
                </div>
            `;
            const items = ref(['a', 'b']);
            app = createApp(() => ({ items })).mount('#app');
            await Promise.resolve();

            items.value = ['new', 'a', 'b'];
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            expect(divs.length).toBe(3);
            expect(divs[0].textContent).toBe('0-new');
            expect(divs[1].textContent).toBe('1-a');
            expect(divs[2].textContent).toBe('2-b');
        });

        it('should handle removing item at index 0', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(item, i) in items" :key="i">{{ item }}</div>
                </div>
            `;
            const items = ref(['remove-me', 'keep', 'also-keep']);
            app = createApp(() => ({ items })).mount('#app');
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div').length).toBe(3);

            items.value = ['keep', 'also-keep'];
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            expect(divs.length).toBe(2);
            expect(divs[0].textContent).toBe('keep');
        });
    });

    describe('z-for without key', () => {
        it('should work without explicit key (uses index internally)', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <span z-for="item in items">{{ item }}</span>
                </div>
            `;
            app = createApp(() => ({
                items: ref(['x', 'y', 'z'])
            })).mount('#app');
            await Promise.resolve();

            const spans = document.body.querySelectorAll('#app > span');
            expect(spans.length).toBe(3);
            expect(spans[0].textContent).toBe('x');
        });

        it('should render first item without key', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="n in nums">{{ n }}</div>
                </div>
            `;
            app = createApp(() => ({
                nums: ref([100, 200, 300])
            })).mount('#app');
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            expect(divs.length).toBe(3);
            expect(divs[0].textContent).toBe('100');
        });
    });

    describe('empty and edge cases', () => {
        it('should handle empty array', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(item, i) in items" :key="i">{{ item }}</div>
                </div>
            `;
            app = createApp(() => ({
                items: ref([])
            })).mount('#app');
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div').length).toBe(0);
        });

        it('should handle array becoming empty', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(item, i) in items" :key="i">{{ item }}</div>
                </div>
            `;
            const items = ref(['a', 'b']);
            app = createApp(() => ({ items })).mount('#app');
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div').length).toBe(2);

            items.value = [];
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div').length).toBe(0);
        });

        it('should handle array growing from empty', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(x, i) in arr" :key="i">{{ x }}</div>
                </div>
            `;
            const arr = ref([]);
            app = createApp(() => ({ arr })).mount('#app');
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div').length).toBe(0);

            arr.value = ['first'];
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            expect(divs.length).toBe(1);
            expect(divs[0].textContent).toBe('first');
        });
    });

    describe('nested data with index 0', () => {
        it('should handle objects at index 0', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(user, i) in users" :key="i">{{ user.name }}: {{ user.age }}</div>
                </div>
            `;
            app = createApp(() => ({
                users: ref([
                    { name: 'Alice', age: 30 },
                    { name: 'Bob', age: 25 }
                ])
            })).mount('#app');
            await Promise.resolve();

            const divs = document.body.querySelectorAll('#app > div');
            expect(divs.length).toBe(2);
            expect(divs[0].textContent).toBe('Alice: 30');
        });

        it('should handle reactive objects in array', async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div z-for="(item, i) in items" :key="item.id">{{ item.text }}</div>
                </div>
            `;
            const items = reactive([
                { id: 0, text: 'zero' },
                { id: 1, text: 'one' }
            ]);
            app = createApp(() => ({ items })).mount('#app');
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div')[0].textContent).toBe('zero');

            items[0].text = 'ZERO';
            await Promise.resolve();

            expect(document.body.querySelectorAll('#app > div')[0].textContent).toBe('ZERO');
        });
    });
});


describe('z-for index name collision', () => {
    let app;

    afterEach(() => {
        app?.unmount();
    });

    it('should handle object with "index" property when using index as loop variable', async () => {
        document.body.innerHTML = `
            <div id="app" class="pb-1 px-2">
                <select z-if="items.length > 1" id="select-q" class="select select-ghost select-sm" >
                    <option :data-id="none" value="">Select</option>
                    <option z-for="(q, index) in items" :key="index" :data-id="q.id" :value="q.id">
                        {{ q.label }}
                    </option>
                </select>
            </div>
        `;

        const items = ref([
            { index: 0, id: '2', label: '480p' },
            { index: 1, id: '0', label: '720p' }
        ]);

        app = createApp(() => ({ items })).mount('#app');
        await Promise.resolve();

        const divs = document.body.querySelectorAll('select>option');
        console.log('divs count:', divs.length);
        console.log('div 0:', divs[0]?.textContent, divs[0]?.getAttribute('data-id'));
        console.log('div 1:', divs[1]?.textContent.trim(), divs[1]?.getAttribute('data-id').trim());
        console.log('div 2:', divs[2]?.textContent.trim(), divs[2]?.getAttribute('data-id').trim());

        expect(divs.length).toBe(3);
        expect(divs[1].textContent.trim()).toBe('480p');
        expect(divs[2].textContent.trim()).toBe('720p');
    });

    it('should work when using different variable name for index', async () => {
        document.body.innerHTML = `
            <div id="app">
                <div z-for="(q, idx) in items" :key="idx" :data-id="q.id">{{ q.label }}</div>
            </div>
        `;

        const items = ref([
            { index: 0, id: '2', label: '480p' },
            { index: 1, id: '0', label: '720p' }
        ]);

        app = createApp(() => ({ items })).mount('#app');
        await Promise.resolve();

        const divs = document.body.querySelectorAll('#app > div');
        expect(divs.length).toBe(2);
    });

    it('should work when using object property as key', async () => {
        document.body.innerHTML = `
            <div id="app">
                <div z-for="q in items" :key="q.index" :data-id="q.id">{{ q.label }}</div>
            </div>
        `;

        const items = ref([
            { index: 0, id: '2', label: '480p' },
            { index: 1, id: '0', label: '720p' }
        ]);

        app = createApp(() => ({ items })).mount('#app');
        await Promise.resolve();

        const divs = document.body.querySelectorAll('#app > div');
        expect(divs.length).toBe(2);
    });
});



describe('evalExp cache collision bug', () => {
    let app;

    afterEach(() => {
        app?.unmount();
    });

    it('should handle "index" expression in different scopes', async () => {
        document.body.innerHTML = `
            <div id="app">
                <div :data-idx="index"></div>
                <span z-for="(q, index) in items" :key="index">{{ q.label }}</span>
            </div>
        `;

        const index = ref(99);
        const items = ref([
            { id: '1', label: 'A', index: 0 },
            { id: '2', label: 'B', index: 1 }
        ]);

        app = createApp(() => ({ index, items })).mount('#app');
        await Promise.resolve();

        const div = document.body.querySelector('#app > div');
        const spans = document.body.querySelectorAll('#app > span');

        // div should use outer scope index (99)
        expect(div.getAttribute('data-idx')).toBe('99');

        // spans should render both items
        expect(spans.length).toBe(2);
        expect(spans[0].textContent.trim()).toBe('A');
        expect(spans[1].textContent.trim()).toBe('B');
    });
});


describe('Support Object in z-model', () => {
    let app;

    afterEach(() => {
        app?.unmount();
    });
    it('should support nested object paths in z-model', async () => {
        document.body.innerHTML = `
        <div id="app">
            <input type="text" z-model="form.name" />
            <input type="email" z-model="form.contact.email" />
        </div>
    `;

        const form = reactive({
            name: 'John',
            contact: { email: 'john@example.com' }
        });

        app = createApp(() => ({ form })).mount('#app');
        await Promise.resolve();

        const nameInput = document.body.querySelector('input[type="text"]');
        const emailInput = document.body.querySelector('input[type="email"]');

        // Initial values should be bound
        expect(nameInput.value).toBe('John');
        expect(emailInput.value).toBe('john@example.com');

        // Simulate user input
        nameInput.value = 'Jane';
        nameInput.dispatchEvent(new Event('input'));
        emailInput.value = 'jane@test.com';
        emailInput.dispatchEvent(new Event('input'));

        await Promise.resolve();

        // Reactive object should be updated
        expect(form.name).toBe('Jane');
        expect(form.contact.email).toBe('jane@test.com');
    });
});


/**
 * Zog.js v0.3.0 - Hook System and Plugin Tests (FIXED)
 */

describe('Hook System', () => {
    let app;
    let hooks = [];

    beforeEach(() => {
        hooks = [];
    });

    afterEach(() => {
        app?.unmount();
        // Clean up hooks by removing them
        hooks.forEach(({ name, fn }) => removeHook(name, fn));
    });

    const registerHook = (name, fn) => {
        hooks.push({ name, fn });
        addHook(name, fn);
        return fn;
    };

    describe('beforeCompile Hook', () => {
        it('should call beforeCompile hook for root element', async () => {
            const hookCalls = [];
            
            const hook = registerHook('beforeCompile', (el, scope, cs) => {
                if (el.nodeType === 1) {
                    hookCalls.push(el.tagName);
                }
                // Don't return anything to continue compilation
            });

            document.body.innerHTML = `
                <div id="app">
                    <span>Test</span>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            // Hook is called on the root div
            expect(hookCalls.length).toBeGreaterThan(0);
            expect(hookCalls[0]).toBe('DIV');
        });

        it('should stop compilation when hook returns false', async () => {
            let hookCalled = false;

            const hook = registerHook('beforeCompile', (el, scope, cs) => {
                if (el.id === 'app') {
                    hookCalled = true;
                    el.innerHTML = 'Handled by hook';
                    return false; // Stop compilation
                }
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>{{ message }}</div>
                </div>
            `;

            const message = ref('Original');
            app = createApp(() => ({ message })).mount('#app');
            await Promise.resolve();

            const appEl = document.getElementById('app');

            expect(hookCalled).toBe(true);
            expect(appEl.textContent).toBe('Handled by hook');
            // Message should not be interpolated because compilation stopped
            expect(appEl.textContent).not.toContain('Original');
        });

        it('should receive correct parameters in beforeCompile', async () => {
            let receivedEl = null;
            let receivedScope = null;
            let receivedCs = null;
            let callCount = 0;

            const hook = registerHook('beforeCompile', (el, scope, cs) => {
                // Hook might be called multiple times as compile recurses
                // Capture the app element specifically
                if (el.id === 'app' || callCount === 0) {
                    receivedEl = el;
                    receivedScope = scope;
                    receivedCs = cs;
                }
                callCount++;
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>{{ value }}</div>
                </div>
            `;

            const value = ref('test');
            app = createApp(() => ({ value })).mount('#app');
            await Promise.resolve();

            // Hook should have been called
            expect(callCount).toBeGreaterThan(0);
            
            // Should have received element
            expect(receivedEl).not.toBeNull();
            expect(receivedEl.tagName).toBe('DIV');
            
            // Should have received scope with value
            expect(receivedScope).not.toBeNull();
            expect(receivedScope).toHaveProperty('value');
            expect(receivedScope.value).toBe(value);
            
            // Should have received component scope
            expect(receivedCs).not.toBeNull();
            expect(receivedCs).toHaveProperty('effects');
            expect(receivedCs).toHaveProperty('addEffect');
            expect(typeof receivedCs.addEffect).toBe('function');
        });

        it('should allow hook to modify element before compilation', async () => {
            const hook = registerHook('beforeCompile', (el, scope, cs) => {
                if (el.id === 'app') {
                    el.setAttribute('data-hooked', 'true');
                }
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>Content</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            const appEl = document.getElementById('app');
            expect(appEl.getAttribute('data-hooked')).toBe('true');
        });
    });

    describe('afterCompile Hook', () => {
        it('should call afterCompile after element compilation', async () => {
            const afterCompileCalls = [];

            const hook = registerHook('afterCompile', (el, scope, cs) => {
                if (el.nodeType === 1) {
                    afterCompileCalls.push(el.tagName);
                }
            });

            document.body.innerHTML = `
                <div id="app">
                    <span>Test</span>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(afterCompileCalls.length).toBeGreaterThan(0);
        });

        it('should allow DOM manipulation in afterCompile', async () => {
            const hook = registerHook('afterCompile', (el, scope, cs) => {
                if (el.id === 'app') {
                    el.setAttribute('data-enhanced', 'true');
                }
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>Content</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            const appEl = document.getElementById('app');
            expect(appEl.getAttribute('data-enhanced')).toBe('true');
        });
    });

    describe('beforeEffect Hook', () => {
        it('should call beforeEffect when effects run', async () => {
            const effectCalls = [];

            const hook = registerHook('beforeEffect', (effect) => {
                effectCalls.push({
                    id: effect.id,
                    active: effect.active
                });
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>{{ counter }}</div>
                </div>
            `;

            const counter = ref(0);
            app = createApp(() => ({ counter })).mount('#app');
            await Promise.resolve();

            const initialCalls = effectCalls.length;
            expect(initialCalls).toBeGreaterThan(0);
            
            counter.value = 1;
            await Promise.resolve();

            expect(effectCalls.length).toBeGreaterThan(initialCalls);
        });

        it('should track effect execution with reactive updates', async () => {
            const effectIds = new Set();

            const hook = registerHook('beforeEffect', (effect) => {
                effectIds.add(effect.id);
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>{{ value }}</div>
                </div>
            `;

            const value = ref(0);
            app = createApp(() => ({ value })).mount('#app');
            await Promise.resolve();

            expect(effectIds.size).toBeGreaterThan(0);

            value.value = 1;
            await Promise.resolve();
            
            value.value = 2;
            await Promise.resolve();

            expect(effectIds.size).toBeGreaterThan(0);
        });
    });

    describe('onError Hook', () => {
        it('should handle errors gracefully', async () => {
            const errors = [];

            const hook = registerHook('onError', (err, context, data) => {
                errors.push({
                    message: err.message,
                    context: context
                });
            });

            // onError hook is called when hooks themselves throw errors
            const errorHook = registerHook('beforeCompile', (el) => {
                if (el.classList?.contains('error-trigger')) {
                    throw new Error('Test error in hook');
                }
            });

            document.body.innerHTML = `
                <div id="app">
                    <div class="error-trigger">Test</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].message).toBe('Test error in hook');
        });
    });

    describe('Hook Management', () => {
        it('should allow adding multiple hooks for same event', async () => {
            const calls = [];

            const hook1 = registerHook('beforeCompile', () => { 
                calls.push('hook1'); 
            });
            
            const hook2 = registerHook('beforeCompile', () => { 
                calls.push('hook2'); 
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>Test</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(calls).toContain('hook1');
            expect(calls).toContain('hook2');
        });

        it('should allow removing hooks', async () => {
            const calls = [];

            const hook = (el) => { 
                if (el.id === 'app') calls.push('called'); 
            };

            addHook('beforeCompile', hook);

            document.body.innerHTML = `<div id="app"><div>Test1</div></div>`;
            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            const callsAfterFirst = calls.length;
            expect(callsAfterFirst).toBeGreaterThan(0);
            
            removeHook('beforeCompile', hook);
            
            app.unmount();
            document.body.innerHTML = `<div id="app"><div>Test2</div></div>`;
            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            // Should not have called hook again
            expect(calls.length).toBe(callsAfterFirst);
        });
    });

    describe('Hook Execution Order', () => {
        it('should execute hooks in order: beforeCompile -> afterCompile', async () => {
            const order = [];

            const beforeHook = registerHook('beforeCompile', (el) => {
                if (el.id === 'app') order.push('before');
            });

            const afterHook = registerHook('afterCompile', (el) => {
                if (el.id === 'app') order.push('after');
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>Test</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(order).toEqual(['before', 'after']);
        });

        it('should call beforeEffect before effect execution', async () => {
            const order = [];

            const hook = registerHook('beforeEffect', () => {
                order.push('hook');
            });

            document.body.innerHTML = `
                <div id="app">
                    <div>{{ value }}</div>
                </div>
            `;

            const value = ref(0);
            app = createApp(() => {
                order.push('setup');
                return { value };
            }).mount('#app');
            
            await Promise.resolve();

            expect(order[0]).toBe('setup');
            expect(order).toContain('hook');
        });
    });
});

describe('Plugin System', () => {
    let app;
    let hooks = [];

    beforeEach(() => {
        hooks = [];
    });

    afterEach(() => {
        app?.unmount();
        hooks.forEach(({ name, fn }) => removeHook(name, fn));
    });

    describe('Plugin Installation', () => {
        it('should install plugin with correct API', () => {
            let receivedAPI = null;

            const TestPlugin = {
                install(api, options) {
                    receivedAPI = api;
                }
            };

            use(TestPlugin);

            expect(receivedAPI).toHaveProperty('reactive');
            expect(receivedAPI).toHaveProperty('ref');
            expect(receivedAPI).toHaveProperty('computed');
            expect(receivedAPI).toHaveProperty('watchEffect');
            expect(receivedAPI).toHaveProperty('addHook');
            expect(receivedAPI).toHaveProperty('removeHook');
            expect(receivedAPI).toHaveProperty('utils');
        });

        it('should pass options to plugin', () => {
            let receivedOptions = null;

            const TestPlugin = {
                install(api, options) {
                    receivedOptions = options;
                }
            };

            const testOptions = { foo: 'bar', num: 42 };
            use(TestPlugin, testOptions);

            expect(receivedOptions).toEqual(testOptions);
        });

        it('should provide utils to plugins', () => {
            let receivedUtils = null;

            const TestPlugin = {
                install(api) {
                    receivedUtils = api.utils;
                }
            };

            use(TestPlugin);

            expect(receivedUtils).toHaveProperty('isObj');
            expect(receivedUtils).toHaveProperty('evalExp');
            expect(receivedUtils).toHaveProperty('Dep');
            expect(receivedUtils).toHaveProperty('ReactiveEffect');
            expect(receivedUtils).toHaveProperty('Scope');
            expect(receivedUtils).toHaveProperty('compile');
        });

        it('should not install same plugin twice', () => {
            let installCount = 0;

            const TestPlugin = {
                install() {
                    installCount++;
                }
            };

            use(TestPlugin);
            use(TestPlugin);
            use(TestPlugin);

            expect(installCount).toBe(1);
        });

        it('should handle plugin installation errors', () => {
            const ErrorPlugin = {
                install() {
                    throw new Error('Installation failed');
                }
            };

            expect(() => use(ErrorPlugin)).not.toThrow();
        });
    });

    describe('Plugin Functionality', () => {
        it('should allow plugin to add custom behavior via hooks', async () => {
            let pluginExecuted = false;

            const CustomPlugin = {
                install({ addHook }) {
                    addHook('beforeCompile', (el) => {
                        if (el.hasAttribute('data-plugin-target')) {
                            pluginExecuted = true;
                            el.setAttribute('data-plugin-processed', 'true');
                        }
                    });
                }
            };

            use(CustomPlugin);

            document.body.innerHTML = `
                <div id="app" data-plugin-target>
                    <div>Content</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(pluginExecuted).toBe(true);
            const appEl = document.getElementById('app');
            expect(appEl.getAttribute('data-plugin-processed')).toBe('true');
        });

        it('should allow plugin to track performance', async () => {
            const stats = {
                compileCount: 0,
                effectCount: 0
            };

            const PerformancePlugin = {
                install({ addHook }) {
                    addHook('beforeCompile', (el) => {
                        if (el.nodeType === 1) stats.compileCount++;
                    });

                    addHook('beforeEffect', () => {
                        stats.effectCount++;
                    });
                }
            };

            use(PerformancePlugin);

            document.body.innerHTML = `
                <div id="app">
                    <div>{{ count }}</div>
                </div>
            `;

            const count = ref(0);
            app = createApp(() => ({ count })).mount('#app');
            await Promise.resolve();

            expect(stats.compileCount).toBeGreaterThan(0);
            expect(stats.effectCount).toBeGreaterThan(0);

            const initialEffectCount = stats.effectCount;
            count.value = 1;
            await Promise.resolve();

            expect(stats.effectCount).toBeGreaterThan(initialEffectCount);
        });

        it('should allow plugin to add global error handling', async () => {
            const errors = [];

            const ErrorHandlerPlugin = {
                install({ addHook }) {
                    addHook('onError', (err, context, data) => {
                        errors.push({
                            message: err.message,
                            context: context
                        });
                    });
                    
                    // Add a hook that throws an error
                    addHook('beforeCompile', (el) => {
                        if (el.classList?.contains('error-trigger')) {
                            throw new Error('Plugin caught error');
                        }
                    });
                }
            };

            use(ErrorHandlerPlugin);

            document.body.innerHTML = `
                <div id="app">
                    <div class="error-trigger">Content</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].message).toBe('Plugin caught error');
        });
    });

    describe('Multiple Plugins Interaction', () => {
        it('should work with multiple plugins installed', async () => {
            const calls = [];

            const Plugin1 = {
                install({ addHook }) {
                    addHook('beforeCompile', (el) => {
                        if (el.id === 'app') calls.push('plugin1');
                    });
                }
            };

            const Plugin2 = {
                install({ addHook }) {
                    addHook('beforeCompile', (el) => {
                        if (el.id === 'app') calls.push('plugin2');
                    });
                }
            };

            use(Plugin1);
            use(Plugin2);

            document.body.innerHTML = `
                <div id="app">
                    <div>Content</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(calls).toContain('plugin1');
            expect(calls).toContain('plugin2');
        });

        it('should allow plugins to cooperate via hooks', async () => {
            let plugin1Data = null;
            let plugin2Data = null;

            const Plugin1 = {
                install({ addHook }) {
                    addHook('beforeCompile', (el) => {
                        if (el.id === 'app') {
                            plugin1Data = 'plugin1-processed';
                            el.setAttribute('data-plugin1', 'true');
                        }
                    });
                }
            };

            const Plugin2 = {
                install({ addHook }) {
                    addHook('afterCompile', (el) => {
                        if (el.id === 'app' && el.hasAttribute('data-plugin1')) {
                            plugin2Data = 'plugin2-saw-plugin1';
                        }
                    });
                }
            };

            use(Plugin1);
            use(Plugin2);

            document.body.innerHTML = `
                <div id="app">
                    <div>Content</div>
                </div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(plugin1Data).toBe('plugin1-processed');
            expect(plugin2Data).toBe('plugin2-saw-plugin1');
        });
    });

    describe('Plugin API Usage', () => {
        it('should allow plugin to use reactive API', async () => {
            let pluginState = null;

            const StatePlugin = {
                install({ reactive, ref }) {
                    pluginState = reactive({
                        count: ref(0),
                        items: []
                    });
                }
            };

            use(StatePlugin);

            expect(pluginState).not.toBeNull();
            expect(pluginState.count).toHaveProperty('value');
            expect(pluginState.count.value).toBe(0);

            pluginState.count.value = 5;
            expect(pluginState.count.value).toBe(5);

            pluginState.items.push('item1');
            expect(pluginState.items).toContain('item1');
        });

        it('should allow plugin to use compile function', async () => {
            let compileCalled = false;

            const CompilerPlugin = {
                install({ utils, addHook }) {
                    const { compile, Scope } = utils;

                    addHook('beforeCompile', (el, scope, cs) => {
                        if (el.id === 'app') {
                            compileCalled = true;
                            
                            const div = document.createElement('div');
                            div.className = 'plugin-added';
                            div.textContent = 'Plugin content';
                            
                            el.appendChild(div);
                        }
                    });
                }
            };

            use(CompilerPlugin);

            document.body.innerHTML = `
                <div id="app"></div>
            `;

            app = createApp(() => ({})).mount('#app');
            await Promise.resolve();

            expect(compileCalled).toBe(true);
            const pluginContent = document.querySelector('.plugin-added');
            expect(pluginContent).not.toBeNull();
            expect(pluginContent.textContent).toBe('Plugin content');
        });
    });
});

describe('Real-World Plugin Examples', () => {
    let app;
    let installedPlugins = [];

    afterEach(() => {
        app?.unmount();
        installedPlugins.forEach(plugin => {
            if (plugin.cleanup) plugin.cleanup();
        });
        installedPlugins = [];
    });

    it('should create a logging plugin', async () => {
        const logs = [];

        const LoggingPlugin = {
            install({ addHook }) {
                addHook('beforeCompile', (el) => {
                    if (el.nodeType === 1) {
                        logs.push(`Compiling: ${el.tagName}`);
                    }
                });
            }
        };

        use(LoggingPlugin);

        document.body.innerHTML = `
            <div id="app">
                <div>Test</div>
            </div>
        `;

        app = createApp(() => ({})).mount('#app');
        await Promise.resolve();

        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0]).toContain('Compiling:');
    });

    it('should create a simple analytics plugin', async () => {
        const events = [];

        const AnalyticsPlugin = {
            install({ addHook }) {
                addHook('beforeCompile', (el) => {
                    if (el.hasAttribute('data-track')) {
                        const eventName = el.getAttribute('data-track');
                        events.push({ event: eventName, element: el.tagName });
                    }
                });
            }
        };

        use(AnalyticsPlugin);

        document.body.innerHTML = `
            <div id="app">
                <button data-track="button-click">Click</button>
            </div>
        `;

        app = createApp(() => ({})).mount('#app');
        await Promise.resolve();

        expect(events.length).toBeGreaterThan(0);
        expect(events[0].event).toBe('button-click');
    });
});