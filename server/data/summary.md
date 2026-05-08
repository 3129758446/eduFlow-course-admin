# 前端开发学习总结

## 一、学习路线

我按照从基础到框架、从语法到项目实战的顺序，系统学习了 **HTML、CSS、JavaScript、Axios、Vue、React、Vite** 等内容。通过不断练习页面布局、接口请求、组件封装、状态管理和项目搭建。

## 二、HTML 学习总结

HTML是网页的结构基础，这个阶段对 HTML 的语法、标签、属性、结构、语义化、兼容性、SEO 等内容学习。

## 三、CSS 学习总结

CSS主要负责页面样式，包括颜色、字体、间距、边框、布局、动画和响应式效果。我重点学习了盒模型、选择器、Flex 布局、Grid 布局、定位、过渡动画。

## 四、JavaScript 学习总结

Js是前端交互和业务逻辑的核心。我学习了变量、数据类型、函数、数组、对象、DOM 操作、事件绑定、Promise、async/await 等内容。

### 1. 变量与函数

```js
const username = "admin";

function sayHello(name) {
  return `你好，${name}`;
}

console.log(sayHello(username));
```

### 2. 数组方法

```js
const courses = [
  { id: 1, name: "HTML 基础", status: "published" },
  { id: 2, name: "CSS 布局", status: "draft" },
  { id: 3, name: "JavaScript 入门", status: "published" },
];

const publishedCourses = courses.filter(
  (course) => course.status === "published"
);

console.log(publishedCourses);
```

### 3. DOM 事件

```js
const button = document.querySelector("#loginBtn");

button.addEventListener("click", () => {
  alert("点击了登录按钮");
});
```

### 4. 异步编程

```js
function fetchData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("数据加载完成");
    }, 1000);
  });
}

async function init() {
  const result = await fetchData();
  console.log(result);
}

init();
```

### 5. 学习体会

JavaScript 是前端学习中最关键的一部分。刚开始学习异步、回调、Promise 和 async/await 时比较难理解，但在接口请求和项目实战中反复使用后，逐渐明白了它们的实际作用。


## 五、Axios 学习总结

Axios是前端项目中常用的 HTTP 请求库，主要用于前端和后端接口进行数据交互。登录、列表查询、新增、编辑、删除等功能都离不开 Axios。

### 1. 基本 GET 请求

```js
import axios from "axios";

axios.get("/api/courses").then((res) => {
  console.log(res.data);
});
```

### 2. async/await 写法

```js
import axios from "axios";

async function getCourses() {
  try {
    const res = await axios.get("/api/courses");
    console.log(res.data);
  } catch (error) {
    console.error("获取课程失败", error);
  }
}

getCourses();
```

### 3. 封装请求实例

```js
import axios from "axios";

const request = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

request.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export default request;
```

### 4. API 模块封装

```js
import request from "./request";

export function fetchCourses(params) {
  return request.get("/courses", { params });
}

export function createCourse(data) {
  return request.post("/courses", data);
}

export function updateCourse(id, data) {
  return request.put(`/courses/${id}`, data);
}

export function deleteCourse(id) {
  return request.delete(`/courses/${id}`);
}
```

### 5. 学习体会

Axios的重点不只是会发请求，更重要的是会封装。统一封装请求实例和 API 方法后，页面组件会更加简洁，项目结构也更清晰。


## 六、Vue 学习总结

Vue是我学习的第一个框架，它是一个渐进式前端框架，适合快速开发业务页面和后台管理系统。我学习了模板语法、数据绑定、事件绑定、条件渲染、列表渲染、组件通信、生命周期和组合式 API。

### 1. 基础示例

```vue
<template>
  <div>
    <h2>{{ title }}</h2>
    <button @click="count++">点击次数：{{ count }}</button>
  </div>
</template>

<script setup>
import { ref } from "vue";

const title = ref("Vue 学习示例");
const count = ref(0);
</script>
```

### 2. 列表渲染

```vue
<template>
  <ul>
    <li v-for="course in courses" :key="course.id">
      {{ course.name }}
    </li>
  </ul>
</template>

<script setup>
import { ref } from "vue";

const courses = ref([
  { id: 1, name: "HTML 基础" },
  { id: 2, name: "CSS 布局" },
  { id: 3, name: "JavaScript 入门" },
]);
</script>
```

### 3. 组件传参

```vue
<!-- Parent.vue -->
<template>
  <CourseCard title="Vue 项目实战" />
</template>

<script setup>
import CourseCard from "./CourseCard.vue";
</script>
```

```vue
<!-- CourseCard.vue -->
<template>
  <div class="course-card">
    {{ title }}
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
});
</script>
```

### 4. 学习体会

Vue上手比较友好，模板语法清晰，双向绑定和组合式 API 能够提高开发效率。通过 Vue 的学习，我理解了组件化开发思想，也知道了如何把页面拆分成多个可复用的小组件。


## 七、React 学习总结

React相比Vue难很多，核心思想是组件化和状态驱动视图。我学习了 JSX、函数组件、Props、State、事件处理、条件渲染、列表渲染、Hooks 和组件拆分。

### 1. 函数组件

```jsx
function CourseCard({ title, teacher }) {
  return (
    <div className="course-card">
      <h3>{title}</h3>
      <p>讲师：{teacher}</p>
    </div>
  );
}

export default CourseCard;
```

### 2. useState

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      点击次数：{count}
    </button>
  );
}

export default Counter;
```

### 3. useEffect 请求数据

```jsx
import { useEffect, useState } from "react";
import { fetchCourses } from "./api";

function CourseList() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    async function loadCourses() {
      const result = await fetchCourses();
      setCourses(result.list || []);
    }

    loadCourses();
  }, []);

  return (
    <div>
      {courses.map((course) => (
        <div key={course.id}>{course.name}</div>
      ))}
    </div>
  );
}

export default CourseList;
```

### 4. 受控表单

```jsx
import { useState } from "react";

function LoginForm() {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <form>
      <input
        name="username"
        value={form.username}
        onChange={handleChange}
        placeholder="请输入用户名"
      />

      <input
        name="password"
        type="password"
        value={form.password}
        onChange={handleChange}
        placeholder="请输入密码"
      />
    </form>
  );
}

export default LoginForm;
```

### 5. 学习体会

React更强调 Js 能力和组件设计能力。刚开始写 JSX 时会觉得 HTML 和 JS 混在一起不太习惯，但熟悉以后会发现这种方式很灵活。React 的难点主要在于状态管理、组件通信和 Hooks 的使用。

