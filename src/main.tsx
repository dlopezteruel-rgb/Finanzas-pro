import {createRoot} from 'react-dom/client';
import { Root } from './app/Root';
import './styles/tokens.css';
import './index.css';
import './responsive.css';
import './styles/experience.css';

const node=document.getElementById('root')!;
if(import.meta.env.VITE_NATIVE_BUILD==='true'){
 void import('./platform/native/bootstrap').then(module=>module.mountNative(node)).catch(()=>createRoot(node).render(<Root blockedContainer/>));
}else createRoot(node).render(<Root />);
