import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { Home } from '../features/events/Home';
export default function App(){return <HashRouter><header className="topbar"><Link className="brand" to="/">智能排桌助手</Link><Link to="/">本地活动</Link></header><main><Routes><Route path="*" element={<Home/>}/></Routes></main><footer className="site-footer">智能排桌助手 V0.1 · 圆桌活动 · 数据仅保存在当前浏览器</footer></HashRouter>;}
