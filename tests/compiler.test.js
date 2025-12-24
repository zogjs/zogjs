import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createApp, ref, reactive, computed } from '../src/zog.js';

describe('Compiler and Directives', () => {
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

    describe('Mustache Interpolation {{ }}', () => {
        it('should render simple value', () => {
            container.innerHTML = '<div>{{ message }}</div>';
            const app = createApp(() => {
                const message = ref('Hello');
                return { message };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('Hello');
        });

        it('should update when value changes', async () => {
            container.innerHTML = '<div>{{ message }}</div>';
            let message;
            const app = createApp(() => {
                message = ref('Hello');
                return { message };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('Hello');
            message.value = 'World';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelector('div').textContent).toBe('World');
        });

        it('should work with expressions', () => {
            container.innerHTML = '<div>{{ count * 2 }}</div>';
            const app = createApp(() => {
                const count = ref(5);
                return { count };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('10');
        });

        it('should work with reactive objects', async () => {
            container.innerHTML = '<div>{{ user.name }}</div>';
            let user;
            const app = createApp(() => {
                user = reactive({ name: 'Ali' });
                return { user };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('Ali');
            user.name = 'Hassan';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelector('div').textContent).toBe('Hassan');
        });

        it('should handle multiple interpolations', () => {
            container.innerHTML = '<div>{{ firstName }} {{ lastName }}</div>';
            const app = createApp(() => {
                const firstName = ref('Ali');
                const lastName = ref('Rezaei');
                return { firstName, lastName };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('Ali Rezaei');
        });

        it('should handle undefined gracefully', () => {
            container.innerHTML = '<div>{{ missing }}</div>';
            const app = createApp(() => {
                return {};
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('');
        });
    });

    describe('z-text directive', () => {
        it('should set text content', () => {
            container.innerHTML = '<div z-text="message"></div>';
            const app = createApp(() => {
                const message = ref('Hello');
                return { message };
            });
            app.mount(container);
            expect(container.querySelector('div').textContent).toBe('Hello');
        });

        it('should update when value changes', async () => {
            container.innerHTML = '<div z-text="message"></div>';
            let message;
            const app = createApp(() => {
                message = ref('Hello');
                return { message };
            });
            app.mount(container);
            message.value = 'World';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelector('div').textContent).toBe('World');
        });
    });

    describe('z-html directive', () => {
        it('should set innerHTML', () => {
            container.innerHTML = '<div z-html="html"></div>';
            const app = createApp(() => {
                const html = ref('<strong>Bold</strong>');
                return { html };
            });
            app.mount(container);
            expect(container.querySelector('div').innerHTML).toBe('<strong>Bold</strong>');
        });
    });

    describe('z-show directive', () => {
        it('should show element when true', () => {
            container.innerHTML = '<div z-show="visible">Content</div>';
            const app = createApp(() => {
                const visible = ref(true);
                return { visible };
            });
            app.mount(container);
            expect(container.querySelector('div').style.display).toBe('');
        });

        it('should hide element when false', () => {
            container.innerHTML = '<div z-show="visible">Content</div>';
            const app = createApp(() => {
                const visible = ref(false);
                return { visible };
            });
            app.mount(container);
            expect(container.querySelector('div').style.display).toBe('none');
        });

        it('should toggle visibility', async () => {
            container.innerHTML = '<div z-show="visible">Content</div>';
            let visible;
            const app = createApp(() => {
                visible = ref(true);
                return { visible };
            });
            app.mount(container);
            expect(container.querySelector('div').style.display).toBe('');
            visible.value = false;
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelector('div').style.display).toBe('none');
        });
    });

    describe('z-if / z-else-if / z-else directives', () => {
        it('should render z-if when true', () => {
            container.innerHTML = `
                <div z-if="show">Visible</div>
            `;
            const app = createApp(() => {
                const show = ref(true);
                return { show };
            });
            app.mount(container);
            expect(container.textContent.trim()).toBe('Visible');
        });

        it('should not render z-if when false', () => {
            container.innerHTML = `
                <div z-if="show">Visible</div>
            `;
            const app = createApp(() => {
                const show = ref(false);
                return { show };
            });
            app.mount(container);
            expect(container.textContent.trim()).toBe('');
        });

        it('should toggle z-if', async () => {
            container.innerHTML = `
                <div z-if="show">Visible</div>
            `;
            let show;
            const app = createApp(() => {
                show = ref(true);
                return { show };
            });
            app.mount(container);
            expect(container.textContent.trim()).toBe('Visible');
            show.value = false;
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.textContent.trim()).toBe('');
        });

        it('should work with z-else', async () => {
            container.innerHTML = `
                <div z-if="show">True</div>
                <div z-else>False</div>
            `;
            let show;
            const app = createApp(() => {
                show = ref(true);
                return { show };
            });
            app.mount(container);
            expect(container.textContent.trim()).toBe('True');
            show.value = false;
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.textContent.trim()).toBe('False');
        });

        it('should work with z-else-if', async () => {
            container.innerHTML = `
                <div z-if="type === 'A'">A</div>
                <div z-else-if="type === 'B'">B</div>
                <div z-else>C</div>
            `;
            let type;
            const app = createApp(() => {
                type = ref('A');
                return { type };
            });
            app.mount(container);
            expect(container.textContent.trim()).toBe('A');
            type.value = 'B';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.textContent.trim()).toBe('B');
            type.value = 'C';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.textContent.trim()).toBe('C');
        });
    });

    describe('z-for directive', () => {
        it('should render list with reactive array', () => {
            container.innerHTML = `
                <div z-for="item in items">{{ item }}</div>
            `;
            const app = createApp(() => {
                const items = reactive([1, 2, 3]);
                return { items };
            });
            app.mount(container);
            const divs = container.querySelectorAll('div');
            expect(divs.length).toBe(3);
            expect(divs[0].textContent).toBe('1');
            expect(divs[1].textContent).toBe('2');
            expect(divs[2].textContent).toBe('3');
        });

        it('should update when array changes', async () => {
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
            items.push(4);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelectorAll('div').length).toBe(4);
        });

        it('should work with (item, index) syntax', () => {
            container.innerHTML = `
                <div z-for="(item, index) in items">{{ index }}: {{ item }}</div>
            `;
            const app = createApp(() => {
                const items = reactive(['a', 'b', 'c']);
                return { items };
            });
            app.mount(container);
            const divs = container.querySelectorAll('div');
            expect(divs[0].textContent).toBe('0: a');
            expect(divs[1].textContent).toBe('1: b');
            expect(divs[2].textContent).toBe('2: c');
        });

        it('should work with reactive objects in array', async () => {
            container.innerHTML = `
                <div z-for="user in users">{{ user.name }}</div>
            `;
            let users;
            const app = createApp(() => {
                users = reactive([
                    { name: 'Ali' },
                    { name: 'Hassan' }
                ]);
                return { users };
            });
            app.mount(container);
            const divs = container.querySelectorAll('div');
            expect(divs[0].textContent).toBe('Ali');
            expect(divs[1].textContent).toBe('Hassan');
            users[0].name = 'Changed';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelectorAll('div')[0].textContent).toBe('Changed');
        });

        it('should handle array mutations', async () => {
            container.innerHTML = `
                <div z-for="item in items">{{ item }}</div>
            `;
            let items;
            const app = createApp(() => {
                items = reactive([1, 2, 3]);
                return { items };
            });
            app.mount(container);
            
            items.pop();
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelectorAll('div').length).toBe(2);
            
            items.unshift(0);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelectorAll('div').length).toBe(3);
            expect(container.querySelectorAll('div')[0].textContent).toBe('0');
        });

        it('should work with :key attribute', async () => {
            container.innerHTML = `
                <div z-for="user in users" :key="user.id">{{ user.name }}</div>
            `;
            let users;
            const app = createApp(() => {
                users = reactive([
                    { id: 1, name: 'Ali' },
                    { id: 2, name: 'Hassan' }
                ]);
                return { users };
            });
            app.mount(container);
            const divs = container.querySelectorAll('div');
            expect(divs.length).toBe(2);
            
            // Reverse array
            users.reverse();
            await new Promise(resolve => setTimeout(resolve, 0));
            const divsAfter = container.querySelectorAll('div');
            expect(divsAfter[0].textContent).toBe('Hassan');
            expect(divsAfter[1].textContent).toBe('Ali');
        });

        it('should handle empty array', () => {
            container.innerHTML = `
                <div z-for="item in items">{{ item }}</div>
            `;
            const app = createApp(() => {
                const items = reactive([]);
                return { items };
            });
            app.mount(container);
            expect(container.querySelectorAll('div').length).toBe(0);
        });
    });

    describe('z-model directive', () => {
        it('should bind input value', () => {
            container.innerHTML = '<input z-model="text">';
            const app = createApp(() => {
                const text = ref('Hello');
                return { text };
            });
            app.mount(container);
            expect(container.querySelector('input').value).toBe('Hello');
        });

        it('should update on input', async () => {
            container.innerHTML = '<input z-model="text">';
            let text;
            const app = createApp(() => {
                text = ref('Hello');
                return { text };
            });
            app.mount(container);
            const input = container.querySelector('input');
            input.value = 'World';
            input.dispatchEvent(new dom.window.Event('input'));
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(text.value).toBe('World');
        });

        it('should work with checkbox', () => {
            container.innerHTML = '<input type="checkbox" z-model="checked">';
            const app = createApp(() => {
                const checked = ref(true);
                return { checked };
            });
            app.mount(container);
            expect(container.querySelector('input').checked).toBe(true);
        });

        it('should update checkbox on change', async () => {
            container.innerHTML = '<input type="checkbox" z-model="checked">';
            let checked;
            const app = createApp(() => {
                checked = ref(false);
                return { checked };
            });
            app.mount(container);
            const input = container.querySelector('input');
            input.checked = true;
            input.dispatchEvent(new dom.window.Event('change'));
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(checked.value).toBe(true);
        });

        it('should work with reactive object properties', async () => {
            container.innerHTML = '<input z-model="user.name">';
            let user;
            const app = createApp(() => {
                user = reactive({ name: 'Ali' });
                return { user };
            });
            app.mount(container);
            const input = container.querySelector('input');
            expect(input.value).toBe('Ali');
            input.value = 'Hassan';
            input.dispatchEvent(new dom.window.Event('input'));
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(user.name).toBe('Hassan');
        });
    });

    describe('Event Handlers (@click, @input, etc)', () => {
        it('should handle @click events', () => {
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
        });

        it('should handle inline expressions', () => {
            container.innerHTML = '<button @click="count.value++">Click</button>';
            let count;
            const app = createApp(() => {
                count = ref(0);
                return { count };
            });
            app.mount(container);
            const button = container.querySelector('button');
            button.click();
            expect(count.value).toBe(1);
        });

        it('should pass event object', () => {
            container.innerHTML = '<button @click="handleClick">Click</button>';
            let eventType;
            const app = createApp(() => {
                const handleClick = (e) => {
                    eventType = e.type;
                };
                return { handleClick };
            });
            app.mount(container);
            const button = container.querySelector('button');
            button.click();
            expect(eventType).toBe('click');
        });

        it('should work with reactive objects', () => {
            container.innerHTML = '<button @click="user.count++">Click</button>';
            let user;
            const app = createApp(() => {
                user = reactive({ count: 0 });
                return { user };
            });
            app.mount(container);
            const button = container.querySelector('button');
            button.click();
            expect(user.count).toBe(1);
        });
    });

    describe('Attribute Binding (:attr)', () => {
        it('should bind attributes', () => {
            container.innerHTML = '<div :id="divId"></div>';
            const app = createApp(() => {
                const divId = ref('myDiv');
                return { divId };
            });
            app.mount(container);
            expect(container.querySelector('div').id).toBe('myDiv');
        });

        it('should update attribute when value changes', async () => {
            container.innerHTML = '<div :id="divId"></div>';
            let divId;
            const app = createApp(() => {
                divId = ref('myDiv');
                return { divId };
            });
            app.mount(container);
            divId.value = 'newDiv';
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(container.querySelector('div').id).toBe('newDiv');
        });

        it('should handle boolean attributes', () => {
            container.innerHTML = '<button :disabled="isDisabled">Button</button>';
            const app = createApp(() => {
                const isDisabled = ref(true);
                return { isDisabled };
            });
            app.mount(container);
            expect(container.querySelector('button').hasAttribute('disabled')).toBe(true);
        });

        it('should bind class with object', () => {
            container.innerHTML = '<div :class="{ active: isActive, disabled: isDisabled }"></div>';
            const app = createApp(() => {
                const isActive = ref(true);
                const isDisabled = ref(false);
                return { isActive, isDisabled };
            });
            app.mount(container);
            const div = container.querySelector('div');
            expect(div.classList.contains('active')).toBe(true);
            expect(div.classList.contains('disabled')).toBe(false);
        });

        it('should bind style with object', async () => {
            container.innerHTML = '<div :style="styleObj"></div>';
            const app = createApp(() => {
                const styleObj = reactive({ color: 'red', fontSize: '20px' });
                return { styleObj };
            });
            app.mount(container);
            const div = container.querySelector('div');
            expect(div.style.color).toBe('red');
            expect(div.style.fontSize).toBe('20px');
        });
    });

    describe('App Lifecycle', () => {
        it('should mount app successfully', () => {
            container.innerHTML = '<div>{{ message }}</div>';
            const app = createApp(() => {
                const message = ref('Hello');
                return { message };
            });
            const result = app.mount(container);
            expect(result).toBeDefined();
            expect(container.querySelector('div').textContent).toBe('Hello');
        });

        it('should unmount app and cleanup', async () => {
            container.innerHTML = '<div>{{ message }}</div>';
            let message;
            const app = createApp(() => {
                message = ref('Hello');
                return { message };
            });
            app.mount(container);
            app.unmount();
            message.value = 'World';
            await new Promise(resolve => setTimeout(resolve, 0));
            // Content should not update after unmount
            expect(container.querySelector('div').textContent).toBe('Hello');
        });

        it('should handle mount selector not found', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const app = createApp(() => ({}));
            app.mount('#nonexistent');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });
});
