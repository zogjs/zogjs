
# 🚀 Zog.js Documentation, JavaScript library

**Zog.js** is a minimal, reactive JavaScript framework inspired by Vue.js. It allows you to declaratively render and manage your DOM by connecting reactive data to the HTML structure.

## 📦 Installation

Zog.js can be used directly in the browser via CDN or installed as an npm package.

### Via CDN (Recommended for Demos and Simple Projects)

Include the script tag using the CDN link in your HTML file.

```html
<script type="module">
    import { createApp, ref, watchEffect } from 'https://cdn.jsdelivr.net/npm/zogjs/dist/zog.es.js';

    // Your Zog.js application code here
    createApp(() => {
        // ...
    }).mount('#app');
</script>
```

### Via npm (Recommended for Production/Bundled Projects)

Install Zog.js using npm:

```bash
npm i zogjs
```

Then import the necessary functions in your JavaScript modules:

```javascript
import { createApp, ref, watchEffect } from 'zogjs';
```

-----

## 🧭 Core Concepts

### 1\. The Reactive Data (`ref`)

The `ref` function creates a reactive variable. Whenever its value changes, any part of the DOM or any `watchEffect` function that relies on it will automatically update.

  * **Access/Mutate:** Always use the **`.value`** property to access or change the data.

<!-- end list -->

```javascript
import { ref } from 'zogjs';

const count = ref(0);
console.log(count.value); // Access: 0

count.value = 1; // Mutation: triggers updates
```

### 2\. The Application Instance (`createApp`)

`createApp` initializes the framework. It accepts a `setupFunction` where you define your reactive data (`ref`s) and methods.

```javascript
import { createApp, ref } from 'zogjs';

createApp(() => {
    // Define reactive state
    const message = ref("Hello Zog!");
    
    // Define methods
    const reverseMessage = () => {
        message.value = message.value.split('').reverse().join('');
    };

    // Return the state and methods you want exposed to the template
    return {
        message,
        reverseMessage
    };
}).mount('#app'); // Mounts the application to the element with id="app"
```

### 3\. Automatic Effect (`watchEffect`)

`watchEffect` is used to define side effects that automatically re-run whenever any reactive dependency inside the function changes. This is useful for manual DOM manipulation or advanced logic that doesn't fit directly into a directive.

```javascript
import { ref, watchEffect } from 'zogjs';

const width = ref(100);
const boxStyle = ref("");

// This effect re-runs every time 'width.value' changes
watchEffect(() => {
    boxStyle.value = `width: ${width.value}px; background: blue;`;
});
```

-----

## 📜 Directives Reference

Zog.js supports a minimal set of powerful directives:

### 1\. Data Binding

| Directive | Purpose | Example Usage |
| :--- | :--- | :--- |
| `{{ ... }}` | **Text Interpolation.** Displays the computed result of a JavaScript expression. | `<h1>Count: {{ count + 1 }}</h1>` |
| `:attribute` | **Dynamic Attributes.** Binds an HTML attribute (like `id`, `src`, `style`, `class`) to a reactive value. | `<div :id="userId"></div>` |
| `@event` | **Event Handling.** Attaches an event listener to call a method or evaluate an expression. | `<button @click="incrementCount">Click</button>` |

### 2\. Two-Way Binding

| Directive | Purpose | Supported Elements |
| :--- | :--- | :--- |
| `z-model` | **Two-Way Binding.** Connects form input values directly to a reactive data property. | `input` (text, range, etc.), `textarea`, `select`, `input type="checkbox"`, `input type="radio"` |

**z-model Example:**

```html
<input type="text" z-model="userName">

<input type="checkbox" z-model="isChecked">

<input type="radio" name="theme" value="dark" z-model="theme">
<input type="radio" name="theme" value="light" z-model="theme">

<select z-model="selectedOption">
    <option value="A">Option A</option>
</select>
```

### 3\. Rendering Directives

| Directive | Purpose | Notes |
| :--- | :--- | :--- |
| `z-if` | **Conditional Rendering.** Renders the element only if the expression evaluates to truthy. | The element is fully removed from the DOM if false. |
| `z-else` | **Else Block.** Must immediately follow an element with `z-if`. | Renders if the preceding `z-if` expression is falsy. |
| `z-for` | **List Rendering.** Renders an element and its content multiple times based on a list (array). | Syntax: `item in items`. The `index` variable is also available in the scope. |

**z-for Example:**

```html
<ul z-if="list.length > 0">
    <li z-for="item in list">{{ item }}</li>
</ul>
<div z-else>No items found.</div>
```

### 4\. Content Directives

| Directive | Purpose |
| :--- | :--- |
| `z-text` | **Text Content.** Updates the element's `textContent` with the reactive value. Safer than interpolation as it avoids HTML injection. |
| `z-html` | **HTML Content.** Updates the element's `innerHTML` with the reactive value. Use with caution to prevent XSS attacks. |
| `z-show` | **Conditional Display.** Toggles the element's visibility by setting `display: none` via CSS, keeping it in the DOM. |
