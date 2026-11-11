import {createRoot} from 'react-dom/client';
import { Root } from './app/Root';
import './styles/tokens.css';
import './index.css';
import './responsive.css';
import './styles/experience.css';

createRoot(document.getElementById('root')!).render(<Root />);
