/* 
模块：应用挂载点
定位：创建根节点并在 StrictMode 下渲染 App
要点：挂载点为 index.html 的 #root
*/
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
