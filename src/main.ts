/** Entry point. Everything it does lives in ui/; core/ never sees the page. */
import { mountApp } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root element');
mountApp(root);
