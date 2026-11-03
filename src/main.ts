import './styles.css';
import { createApp } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('#app root missing');

createApp(root);
