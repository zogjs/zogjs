import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createApp, ref, reactive, computed, watchEffect, nextTick } from '../src/zog.js';

describe('Edge Cases and Bug Detection', () => {
    let dom;
    let document;
    let container;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
        global.document = dom.window.document;
        global.window = dom.window;
        document = dom.window.document;
        container = document.getElementById('app');
    });

    afterEach(() => {
        if (container) {
            container.innerHTML = '';
        }
    });

    describe('z-for with Reactive Objects (Main Bug Fix)', () => {
        it('should allow user.age++ directly in z-for with reactive array', async () => {
            container.innerHTML = `
                <div z-for="user in users" :key="user.id">
                    <span class="name">{{ user.name }}</span>
                    <span class="age">{{ user.age }}</span>
                    <button @click="user.age++">Birthday</button>
                </div>
            `;
            let users;
            const app = createApp(() => {
                users = reactive([
                    { id: 1, name: 'Ali', age: 20 },
                    { id: 2, name: 'Hassan', age: 25 }
                ]);
                return { users };
            });
            app.mount(container);

            const buttons = container.querySelectorAll('button');
            const ageSpans = container.querySelectorAll('.age');
            
            expect(ageSpans[0].textContent).toBe('20');
            expect(ageSpans[1].textContent).toBe('25');

            // Click first button
            buttons[0].click();
            await new Promise(resolve => setTimeout(resolve, 0));
            
            expect(users[0].age).toBe(21);
            expect(container.querySelectorAll('.age')[0].textContent).toBe('21');
        });

        it('should NOT require user.value.age in z-for', () => {
            container.innerHTML = `
                <div z-for="user in users">
                    <button @click="user.age++">{{ user.age }}</button>
                </div>
            `;
            let users;
            const app = createApp(() => {
                users = reactive([{ id: 1, name: 'Ali', age: 20 }]);
                return { users };
            });
            
            expect(() => app.mount(container)).not.toThrow();
            const button = container.querySelector('button');
            expect(() => button.click()).not.toThrow();
        });

        it('should work with method calls on reactive objects in z-for', () => {
            container.innerHTML = `
                <div z-for="(user, index) in users" :key="user.id">
                    <button @click="incrementAge(user, index)">Increment</button>
                </div>
            `;
            let users;
            const app = createApp(() => {
                users = reactive([
                    { id: 1, name: 'Ali', age: 20 },
                    { id: 2, name: 'Hassan', age: 25 }
                ]);
                const incrementAge = (user, index) => {
                    user.age++;
                    expect(typeof user.age).toBe('number');
                    expect(typeof index).toBe('number'); // or could be ref
                };
                return { users, incrementAge };
            });
            app.mount(container);
            
            const buttons = container.querySelectorAll('button');
            expect(() => buttons[0].click()).not.toThrow();
        });
    });

    describe('z-for Index Access (Potential Bug)', () => {
        it('should provide index as accessible value', () => {
            container.innerHTML = `
                <div z-for="(item, index) in items">
                    <span class="index">{{ index }}</span>
                    <span class="item">{{ item }}</span>
                </div>
            `;
            const app = createApp(() => {
                const items = reactive([10, 20, 30]);
                return { items };
            });
            app.mount(container);

            const indexSpans = container.querySelectorAll('.index');
            expect(indexSpans[0].textContent).toBe('0');
            expect(indexSpans[1].textContent).toBe('1');
            expect(indexSpans[2].textContent).toBe('2');
        });

        it('should update index when array changes', async () => {
            container.innerHTML = `
                <div z-for="(item, index) in items">{{ index }}: {{ item }}</div>
            `;
            let items;
            const app = createApp(() => {
                items = reactive([10, 20, 30]);
                return { items };
            });
            app.mount(container);

            items.unshift(5);
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const divs = container.querySelectorAll('div');
            expect(divs[0].textContent).toBe('0: 5');
            expect(divs[1].textContent).toBe('1: 10');
            expect(divs[2].textContent).toBe('2: 20');
        });

        it('should pass correct index to functions', () => {
            container.innerHTML = `
                <div z-for="(item, index) in items">
                    <button @click="logIndex(index)">Log</button>
                </div>
            `;
            const logs = [];
            const app = createApp(() => {
                const items = reactive([10, 20, 30]);
                const logIndex = (idx) => {
                    // Check if index needs .value or not
                    const actualIndex = typeof idx === 'object' && idx._isRef ? idx.value : idx;
                    logs.push(actualIndex);
                };
                return { items, logIndex };
            });
            app.mount(container);

            const buttons = container.querySelectorAll('button');
            buttons[0].click();
            buttons[1].click();
            buttons[2].click();

            expect(logs).toEqual([0, 1, 2]);
        });
    });

    describe('z-for with Primitive Arrays', () => {
        it('should work with array of numbers', async () => {
            container.innerHTML = `
                <div z-for="num in numbers">{{ num }}</div>
            `;
            let numbers;
            const app = createApp(() => {
                numbers = reactive([1, 2, 3]);
                return { numbers };
            });
            app.mount(container);

            const divs = container.querySelectorAll('div');
            expect(divs.length).toBe(3);
            expect(divs[0].textContent).toBe('1');
        });

        it('should handle incrementing primitive values in z-for', async () => {
            container.innerHTML = `
                <div z-for="num in numbers">
                    <span>{{ num }}</span>
                    <button @click="num.value++">++</button>
                </div>
            `;
            let numbers;
            const app = createApp(() => {
                numbers = reactive([1, 2, 3]);
                return { numbers };
            });
            app.mount(container);

            const button = container.querySelector('button');
            const span = container.querySelector('span');
            
            expect(span.textContent).toBe('1');
            button.click();
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // For primitive values, we need .value
            expect(span.textContent).toBe('2');
        });
    });

    describe('ref with Objects/Arrays (Should Throw)', () => {
        it('should throw when creating ref with object', () => {
            expect(() => {
                ref({ name: 'test' });
            }).toThrow('ref() cannot be used with objects or arrays');
        });

        it('should throw when creating ref with array', () => {
            expect(() => {
                ref([1, 2, 3]);
            }).toThrow('ref() cannot be used with objects or arrays');
        });

        it('should throw when setting ref value to object', () => {
            const count = ref(0);
            expect(() => {
                count.value = { x: 1 };
            }).toThrow();
        });

        it('should throw when setting ref value to array', () => {
            const count = ref(0);
            expect(() => {
                count.value = [1, 2, 3];
            }).toThrow();
        });

        it('should warn before throwing', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            expect(() => ref({ x: 1 })).toThrow();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    describe('Memory Leaks and Cleanup', () => {
        it('should cleanup effects when scope is destroyed', async () => {
            container.innerHTML = `
                <div z-if="show">
                    <div>{{ message }}</div>
                </div>
            `;
            let show, message;
            let effectCount = 0;
            const app = createApp(() => {
                show = ref(true);
                message = ref('Hello');
                return { show, message };
            });
            app.mount(container);

            // Effect is active
            message.value = 'World';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.textContent.includes('World')).toBe(true);

            // Hide the element
            show.value = false;
            await new Promise(resolve => setTimeout(resolve, 0));

            // Effect should be cleaned up
            const oldValue = message.value;
            message.value = 'Should not update';
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Show again
            show.value = true;
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.textContent.includes('Should not update')).toBe(true);
        });

        it('should cleanup event listeners when unmounted', () => {
            container.innerHTML = '<button @click="increment">Click</button>';
            let count;
            const app = createApp(() => {
                count = ref(0);
                const increment = () => count.value++;
                return { count, increment };
            });
            app.mount(container);

            const button = container.querySelector('button');
            button.click();
            expect(count.value).toBe(1);

            app.unmount();
            button.click();
            expect(count.value).toBe(1); // Should not increment after unmount
        });

        it('should cleanup z-for items when array becomes empty', async () => {
            container.innerHTML = `
                <div z-for="item in items">{{ item }}</div>
            `;
            let items;
            const app = createApp(() => {
                items = reactive([1, 2, 3]);
                return { items };
            });
            app.mount(container);

            expect(container.querySelectorAll('div').length).toBe(3);

            items.length = 0; // Clear array
            await new Promise(resolve => setTimeout(resolve, 0));
            
            expect(container.querySelectorAll('div').length).toBe(0);
        });
    });

    describe('Nested Reactivity', () => {
        it('should track deeply nested object changes', async () => {
            container.innerHTML = '<div>{{ user.address.city }}</div>';
            let user;
            const app = createApp(() => {
                user = reactive({
                    name: 'Ali',
                    address: {
                        city: 'Tehran',
                        country: 'Iran'
                    }
                });
                return { user };
            });
            app.mount(container);

            expect(container.querySelector('div').textContent).toBe('Tehran');
            user.address.city = 'Isfahan';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelector('div').textContent).toBe('Isfahan');
        });

        it('should track nested arrays', async () => {
            container.innerHTML = '<div>{{ matrix[0][0] }}</div>';
            let matrix;
            const app = createApp(() => {
                matrix = reactive([[1, 2], [3, 4]]);
                return { matrix };
            });
            app.mount(container);

            expect(container.querySelector('div').textContent).toBe('1');
            matrix[0][0] = 10;
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelector('div').textContent).toBe('10');
        });
    });

    describe('Performance and Optimization', () => {
        it('should not trigger unnecessary updates', async () => {
            container.innerHTML = '<div>{{ count }}</div>';
            let count;
            let renderCount = 0;
            const app = createApp(() => {
                count = ref(0);
                return { count };
            });
            app.mount(container);

            // Set to same value
            count.value = 0;
            count.value = 0;
            count.value = 0;
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Should only render once initially
            const div = container.querySelector('div');
            expect(div.textContent).toBe('0');
        });

        it('should batch multiple synchronous updates', async () => {
            container.innerHTML = '<div>{{ count }}</div>';
            let count;
            let updateCount = 0;
            const app = createApp(() => {
                count = ref(0);
                return { count };
            });
            app.mount(container);

            // Multiple synchronous updates
            count.value = 1;
            count.value = 2;
            count.value = 3;
            
            // Should batch into single update
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelector('div').textContent).toBe('3');
        });

        it('should handle large arrays efficiently', async () => {
            container.innerHTML = `
                <div z-for="item in items">{{ item }}</div>
            `;
            let items;
            const app = createApp(() => {
                items = reactive(Array.from({ length: 100 }, (_, i) => i));
                return { items };
            });
            
            const startTime = Date.now();
            app.mount(container);
            const mountTime = Date.now() - startTime;

            expect(container.querySelectorAll('div').length).toBe(100);
            expect(mountTime).toBeLessThan(1000); // Should mount in less than 1 second
        });
    });

    describe('Expression Evaluation Edge Cases', () => {
        it('should handle complex expressions', () => {
            container.innerHTML = '<div>{{ (a + b) * c }}</div>';
            const app = createApp(() => {
                const a = ref(2);
                const b = ref(3);
                const c = ref(4);
                return { a, b, c };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('20');
        });

        it('should handle ternary operators', () => {
            container.innerHTML = '<div>{{ age >= 18 ? "Adult" : "Minor" }}</div>';
            const app = createApp(() => {
                const age = ref(20);
                return { age };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('Adult');
        });

        it('should handle method calls', () => {
            container.innerHTML = '<div>{{ getName() }}</div>';
            const app = createApp(() => {
                const getName = () => 'Ali';
                return { getName };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('Ali');
        });

        it('should handle undefined gracefully', () => {
            container.innerHTML = '<div>{{ missing.property }}</div>';
            const app = createApp(() => {
                return {};
            });
            expect(() => app.mount(container)).not.toThrow();
            expect(container.querySelector('div').textContent).toBe('');
        });

        it('should handle null access gracefully', () => {
            container.innerHTML = '<div>{{ user?.name }}</div>';
            const app = createApp(() => {
                const user = ref(null);
                return { user };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('');
        });
    });

    describe('Circular References', () => {
        it('should handle circular object references', async () => {
            const obj = reactive({ value: 1 });
            obj.self = obj;
            
            let dummy;
            watchEffect(() => {
                dummy = obj.self.value;
            });
            
            expect(dummy).toBe(1);
            obj.value = 2;
            await nextTick()
            expect(dummy).toBe(2);
        });

        it('should not cause infinite loops with circular refs', () => {
            const obj = reactive({ value: 1 });
            obj.self = obj;
            
            expect(() => {
                watchEffect(() => {
                    obj.self.self.self.value;
                });
            }).not.toThrow();
        });
    });

    describe('Special Characters and Values', () => {
        it('should handle special characters in strings', () => {
            container.innerHTML = '<div>{{ message }}</div>';
            const app = createApp(() => {
                const message = ref('Hello "World" & <Test>');
                return { message };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toContain('Hello');
        });

        it('should handle emojis', () => {
            container.innerHTML = '<div>{{ emoji }}</div>';
            const app = createApp(() => {
                const emoji = ref('🚀 🎉 ✨');
                return { emoji };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('🚀 🎉 ✨');
        });

        it('should handle NaN correctly', () => {
            const value = ref(NaN);
            let dummy;
            watchEffect(() => {
                dummy = value.value;
            });
            expect(Number.isNaN(dummy)).toBe(true);
        });

        it('should handle Infinity', () => {
            container.innerHTML = '<div>{{ value }}</div>';
            const app = createApp(() => {
                const value = ref(Infinity);
                return { value };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('Infinity');
        });
    });

    describe('Computed Edge Cases', () => {
        it('should not recompute if dependencies unchanged', () => {
            const count = ref(1);
            let computeCount = 0;
            const double = computed(() => {
                computeCount++;
                return count.value * 2;
            });

            double.value;
            double.value;
            double.value;
            expect(computeCount).toBe(1);
        });

        it('should handle computed with multiple deps', () => {
            const a = ref(1);
            const b = ref(2);
            const c = ref(3);
            const sum = computed(() => a.value + b.value + c.value);
            
            expect(sum.value).toBe(6);
            a.value = 2;
            expect(sum.value).toBe(7);
        });

        it('should handle nested computed', () => {
            const count = ref(1);
            const double = computed(() => count.value * 2);
            const quadruple = computed(() => double.value * 2);
            
            expect(quadruple.value).toBe(4);
            count.value = 2;
            expect(quadruple.value).toBe(8);
        });
    });
});
