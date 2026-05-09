/* 
模块：应用入口（主题配置）
定位：通过 Antd ConfigProvider 统一主题，挂载 AppRouterProvider
要点：统一品牌色、圆角、控件尺寸与分页等组件样式，搭配全局 CSS 微调
*/
import { ConfigProvider, App as AntdApp } from 'antd';
import { AppRouterProvider } from './router';
import 'antd/dist/reset.css';
import './style/base.css';
import './style/summary.css';

function App() {
  return (
    // 配置主题
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#5b9cf0',
          colorInfo: '#5b9cf0',
          colorSuccess: '#67c23a',
          colorText: '#1f2937',
          colorBorder: '#b7b7b7',
          borderRadius: 14,
          fontFamily: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
        },
        components: {
          Button: {
            borderRadius: 14,
            controlHeight: 48,
            controlHeightLG: 52,
            defaultBorderColor: '#222222',
            defaultColor: '#1f2937',
            defaultBg: '#ffffff',
            primaryColor: '#1f2937',
            primaryShadow: 'none',
          },
          Input: {
            controlHeight: 48,
            controlHeightLG: 52,
            activeShadow: 'none',
            hoverBorderColor: '#a9a9a9',
            activeBorderColor: '#a9a9a9',
          },
          Select: {
            controlHeight: 48,
            controlHeightLG: 52,
            activeBorderColor: '#a9a9a9',
            hoverBorderColor: '#a9a9a9',
            activeOutlineColor: 'transparent',
          },
          Card: {
            borderRadiusLG: 20,
          },
          Modal: {
            borderRadiusLG: 20,
          },
          Pagination: {
            itemActiveBg: '#dbeafe',
          },
          Dropdown: {
            borderRadiusLG: 14,
          },
        },
      }}
    >
      <AntdApp>
        <AppRouterProvider />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
