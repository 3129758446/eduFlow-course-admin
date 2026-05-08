import { ConfigProvider, App as AntdApp } from 'antd';
import { AppRouterProvider } from './router';
import 'antd/dist/reset.css';
import './style/base.css';
import './style/summary.css';

function App() {
  return (
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
